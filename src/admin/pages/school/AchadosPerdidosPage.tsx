import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageSearch, Loader2, Check, ChevronLeft, ChevronRight,
  Search, MapPin, Calendar, Trash2, User, Clock, X,
  AlertTriangle, Camera, Settings,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { SelectDropdown } from '../../components/FormField';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { LostFoundItem, LostFoundEvent, LostFoundStatus } from '../../types/admin.types';
import { LOST_FOUND_STATUS_LABELS, LOST_FOUND_STATUS_COLORS } from '../../types/admin.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const DEFAULT_TYPES = ['Mochila', 'Estojo', 'Casaco', 'Óculos', 'Garrafa', 'Livro', 'Tênis', 'Chave', 'Celular', 'Documento', 'Outros'];
const DEFAULT_FOUND_LOCATIONS = ['Pátio', 'Sala de Aula', 'Corredor', 'Quadra', 'Refeitório', 'Biblioteca', 'Banheiro', 'Entrada', 'Estacionamento'];
const DEFAULT_STORAGE_LOCATIONS = ['Secretaria', 'Portaria', 'Coordenação', 'Sala dos Professores'];

const DISCARD_REASONS = [
  { value: 'doação',      label: 'Doação' },
  { value: 'descarte',    label: 'Descarte' },
  { value: 'devolução',   label: 'Devolução' },
];

type SaveState = 'idle' | 'saving' | 'saved';
type DrawerMode = 'register' | 'view';

// ── Use shared LostFoundEvent from types ─────────────────────────────────────
// (re-imported from admin.types, see import block above)

interface StudentOption {
  id: string;
  full_name: string;
  enrollment?: string | null;
}

// ── Form initial state ────────────────────────────────────────────────────────

function emptyForm() {
  return {
    type: '',
    description: '',
    found_location: '',
    storage_location: '',
    found_at: new Date().toISOString().slice(0, 16),
    notes: '',
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch { return iso; }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
}

function statusBadgeClass(status: LostFoundStatus): string {
  return LOST_FOUND_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AchadosPerdidosPage() {
  const { profile } = useAdminAuth();
  const { can } = usePermissions();

  // Settings / config
  const [types, setTypes]                     = useState<string[]>(DEFAULT_TYPES);
  const [foundLocations, setFoundLocations]   = useState<string[]>(DEFAULT_FOUND_LOCATIONS);
  const [storageLocations, setStorageLocations] = useState<string[]>(DEFAULT_STORAGE_LOCATIONS);

  // List state
  const [rows, setRows]       = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const [total, setTotal]     = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState<LostFoundStatus | ''>('');
  const [search, setSearch]             = useState('');

  // Drawer
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [drawerMode, setDrawerMode]   = useState<DrawerMode>('register');
  const [selected, setSelected]       = useState<LostFoundItem | null>(null);
  const [saveState, setSaveState]     = useState<SaveState>('idle');

  // Register form
  const [form, setForm]             = useState(emptyForm());
  const [photoFile, setPhotoFile]   = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // View mode extras
  const [events, setEvents]             = useState<LostFoundEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Delivery sub-form
  const [showDelivery, setShowDelivery]     = useState(false);
  const [studentSearch, setStudentSearch]   = useState('');
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [deliverySaveState, setDeliverySaveState] = useState<SaveState>('idle');

  // Discard sub-form
  const [showDiscard, setShowDiscard]         = useState(false);
  const [discardReason, setDiscardReason]     = useState('doação');
  const [discardNotes, setDiscardNotes]       = useState('');
  const [discardSaveState, setDiscardSaveState] = useState<SaveState>('idle');

  // Edit mode inside view
  const [editing, setEditing]   = useState(false);
  const [editForm, setEditForm] = useState(emptyForm());

  // ── Load settings ────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'general')
      .in('key', ['lost_found_types', 'lost_found_found_locations', 'lost_found_storage_locations'])
      .then(({ data }) => {
        if (!data) return;
        data.forEach((row: { key: string; value: unknown }) => {
          if (row.key === 'lost_found_types' && Array.isArray(row.value)) setTypes(row.value as string[]);
          if (row.key === 'lost_found_found_locations' && Array.isArray(row.value)) setFoundLocations(row.value as string[]);
          if (row.key === 'lost_found_storage_locations' && Array.isArray(row.value)) setStorageLocations(row.value as string[]);
        });
      });
  }, []);

  // ── Fetch list ───────────────────────────────────────────────────────────────

  const loadRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('lost_found_items')
      .select(
        `id, type, description, photo_url, found_location, storage_location,
         found_at, registered_by, notes, status,
         claimed_by_type, claimed_by_id, claimed_at,
         delivered_at, delivered_by, delivery_student_id, delivery_manual,
         discarded_at, discard_reason, created_at, updated_at,
         delivery_student:students!delivery_student_id(id, full_name),
         registrant:profiles!registered_by(id, full_name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterStatus) q = q.eq('status', filterStatus);
    if (search.trim()) q = q.ilike('description', `%${search.trim()}%`);

    const { data, count, error } = await q;
    if (!error && data) {
      setRows(data as unknown as LostFoundItem[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, filterStatus, search]);

  useEffect(() => { loadRows(); }, [loadRows]);

  // ── Load events for selected item ────────────────────────────────────────────

  const loadEvents = useCallback(async (itemId: string) => {
    setEventsLoading(true);
    const { data } = await supabase
      .from('lost_found_events')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true });
    setEvents((data as unknown as LostFoundEvent[]) ?? []);
    setEventsLoading(false);
  }, []);

  // ── Student search ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (studentSearch.trim().length < 2) { setStudentResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, enrollment')
        .or(`full_name.ilike.%${studentSearch}%,enrollment.ilike.%${studentSearch}%`)
        .limit(8);
      setStudentResults((data ?? []) as StudentOption[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  // ── Drawer helpers ────────────────────────────────────────────────────────────

  function openRegister() {
    setDrawerMode('register');
    setSelected(null);
    setForm(emptyForm());
    setPhotoFile(null);
    setPhotoPreview(null);
    setSaveState('idle');
    setDrawerOpen(true);
  }

  function openView(item: LostFoundItem) {
    setDrawerMode('view');
    setSelected(item);
    setSaveState('idle');
    setShowDelivery(false);
    setShowDiscard(false);
    setEditing(false);
    setStudentSearch('');
    setSelectedStudent(null);
    setDiscardReason('doação');
    setDiscardNotes('');
    setDrawerOpen(true);
    loadEvents(item.id);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => {
      setSelected(null);
      setSaveState('idle');
      setShowDelivery(false);
      setShowDiscard(false);
      setEditing(false);
      setEvents([]);
    }, 300);
  }

  // ── Photo handling ────────────────────────────────────────────────────────────

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `lost-found/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('school-assets').upload(path, file, { upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  // ── Save register ─────────────────────────────────────────────────────────────

  async function handleRegister() {
    if (!profile) return;
    if (!form.type || !form.description || !form.found_location || !form.storage_location || !photoFile) return;
    setSaveState('saving');

    let photo_url: string | null = null;
    if (photoFile) {
      photo_url = await uploadPhoto(photoFile);
    }

    const payload = {
      type: form.type,
      description: form.description,
      found_location: form.found_location,
      storage_location: form.storage_location,
      found_at: new Date(form.found_at).toISOString(),
      notes: form.notes || null,
      photo_url,
      registered_by: profile.id,
      status: 'available' as LostFoundStatus,
    };

    const { data, error } = await supabase
      .from('lost_found_items')
      .insert(payload)
      .select('id')
      .single();

    if (error || !data) { setSaveState('idle'); return; }

    // Insert event
    await supabase.from('lost_found_events').insert({
      item_id: data.id,
      event: 'registered',
      actor_type: 'admin',
      actor_id: profile.id,
      actor_name: profile.full_name ?? null,
      metadata: null,
    });

    await logAudit({
      action: 'create',
      module: 'lost-found',
      recordId: data.id,
      description: `Objeto "${form.type}" registrado`,
    });

    setSaveState('saved');
    setTimeout(() => {
      closeDrawer();
      loadRows();
    }, 900);
  }

  // ── Save edit ─────────────────────────────────────────────────────────────────

  async function handleEdit() {
    if (!selected || !profile) return;
    setSaveState('saving');

    const { error } = await supabase
      .from('lost_found_items')
      .update({
        type: editForm.type,
        description: editForm.description,
        found_location: editForm.found_location,
        storage_location: editForm.storage_location,
        found_at: new Date(editForm.found_at).toISOString(),
        notes: editForm.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (error) { setSaveState('idle'); return; }

    await logAudit({
      action: 'update',
      module: 'lost-found',
      recordId: selected.id,
      description: `Objeto "${editForm.type}" editado`,
    });

    setSaveState('saved');
    setTimeout(() => {
      setEditing(false);
      setSaveState('idle');
      loadRows();
      // Refresh selected
      supabase
        .from('lost_found_items')
        .select('*')
        .eq('id', selected.id)
        .single()
        .then(({ data }) => {
          if (data) setSelected(data as unknown as LostFoundItem);
        });
    }, 900);
  }

  // ── Delivery ──────────────────────────────────────────────────────────────────

  async function handleDelivery() {
    if (!selected || !profile) return;
    setDeliverySaveState('saving');
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lost_found_items')
      .update({
        status: 'delivered' as LostFoundStatus,
        delivered_at: now,
        delivered_by: profile.id,
        delivery_student_id: selectedStudent?.id ?? null,
        delivery_manual: true,
        updated_at: now,
      })
      .eq('id', selected.id);

    if (error) { setDeliverySaveState('idle'); return; }

    await supabase.from('lost_found_events').insert({
      item_id: selected.id,
      event: 'delivered',
      actor_type: 'admin',
      actor_id: profile.id,
      actor_name: profile.full_name ?? null,
      metadata: selectedStudent ? { student_name: selectedStudent.full_name } : null,
    });

    await logAudit({
      action: 'update',
      module: 'lost-found',
      recordId: selected.id,
      description: `Objeto entregue${selectedStudent ? ` para ${selectedStudent.full_name}` : ''}`,
    });

    setDeliverySaveState('saved');
    setTimeout(() => {
      closeDrawer();
      loadRows();
    }, 900);
  }

  // ── Discard ───────────────────────────────────────────────────────────────────

  async function handleDiscard() {
    if (!selected || !profile) return;
    setDiscardSaveState('saving');
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lost_found_items')
      .update({
        status: 'discarded' as LostFoundStatus,
        discarded_at: now,
        discard_reason: discardReason,
        notes: discardNotes || selected.notes,
        updated_at: now,
      })
      .eq('id', selected.id);

    if (error) { setDiscardSaveState('idle'); return; }

    await supabase.from('lost_found_events').insert({
      item_id: selected.id,
      event: 'discarded',
      actor_type: 'admin',
      actor_id: profile.id,
      actor_name: profile.full_name ?? null,
      metadata: { reason: discardReason, notes: discardNotes || null },
    });

    await logAudit({
      action: 'update',
      module: 'lost-found',
      recordId: selected.id,
      description: `Objeto descartado (${discardReason})`,
    });

    setDiscardSaveState('saved');
    setTimeout(() => {
      closeDrawer();
      loadRows();
    }, 900);
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const canCreate = can('lost-found', 'create');

  const statusTabs: Array<{ value: LostFoundStatus | ''; label: string }> = [
    { value: '',          label: 'Todos' },
    { value: 'available', label: 'Disponível' },
    { value: 'claimed',   label: 'Reivindicado' },
    { value: 'delivered', label: 'Entregue' },
    { value: 'discarded', label: 'Descartado' },
  ];

  // ── Drawer footer ─────────────────────────────────────────────────────────────

  function renderRegisterFooter() {
    const canSave = form.type && form.description && form.found_location && form.storage_location && !!photoFile;
    return (
      <div className="flex gap-3">
        <button
          onClick={closeDrawer}
          disabled={saveState === 'saving'}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                     text-sm text-gray-600 dark:text-gray-300
                     hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleRegister}
          disabled={saveState !== 'idle' || !canSave}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                      text-sm font-medium transition-all
                      ${saveState === 'saved'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}
        >
          {saveState === 'saving' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
          ) : saveState === 'saved' ? (
            <><Check className="w-4 h-4" /> Salvo!</>
          ) : (
            <><PackageSearch className="w-4 h-4" /> Registrar</>
          )}
        </button>
      </div>
    );
  }

  function renderEditFooter() {
    const canSave = editForm.type && editForm.description && editForm.found_location && editForm.storage_location;
    return (
      <div className="flex gap-3">
        <button
          onClick={() => { setEditing(false); setSaveState('idle'); }}
          disabled={saveState === 'saving'}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                     text-sm text-gray-600 dark:text-gray-300
                     hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleEdit}
          disabled={saveState !== 'idle' || !canSave}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                      text-sm font-medium transition-all
                      ${saveState === 'saved'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}
        >
          {saveState === 'saving' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
          ) : saveState === 'saved' ? (
            <><Check className="w-4 h-4" /> Salvo!</>
          ) : (
            <><PackageSearch className="w-4 h-4" /> Salvar Edição</>
          )}
        </button>
      </div>
    );
  }

  function renderViewFooter() {
    return (
      <div>
        <button
          onClick={closeDrawer}
          className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                     text-sm text-gray-600 dark:text-gray-300
                     hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Fechar
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Achados e Perdidos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Controle de objetos encontrados e devoluções
          </p>
        </div>
        <Link
          to="/admin/configuracoes?tab=ferramentas"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors"
        >
          <Settings className="w-4 h-4 text-brand-secondary" />
          Configurações
        </Link>
      </div>

      {/* Filters bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((t) => (
            <button
              key={t.value}
              onClick={() => { setFilterStatus(t.value as LostFoundStatus | ''); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                filterStatus === t.value
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + New button */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar por descrição…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                         bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                         placeholder-gray-400 outline-none focus:border-brand-primary transition-colors"
            />
          </div>
          {canCreate && (
            <button
              onClick={openRegister}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-dark
                         text-white text-sm font-medium transition-colors flex-shrink-0"
            >
              <PackageSearch className="w-4 h-4" />
              Novo Objeto
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700
                        p-12 text-center">
          <PackageSearch className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-medium text-sm mb-1">Nenhum objeto registrado</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Objetos encontrados na escola aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((item) => (
            <LostFoundCard key={item.id} item={item} onClick={() => openView(item)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700
                       text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700
                       text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Drawer ─────────────────────────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={
          drawerMode === 'register'
            ? 'Registrar Objeto'
            : editing
            ? 'Editar Objeto'
            : 'Detalhes do Objeto'
        }
        icon={PackageSearch}
        badge={
          selected && !editing
            ? (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(selected.status)}`}>
                {LOST_FOUND_STATUS_LABELS[selected.status]}
              </span>
            )
            : undefined
        }
        footer={
          drawerMode === 'register'
            ? renderRegisterFooter()
            : editing
            ? renderEditFooter()
            : renderViewFooter()
        }
        width="w-[440px]"
      >
        {/* ── REGISTER MODE ─────────────────────────────────────────────────────── */}
        {drawerMode === 'register' && (
          <>
            <DrawerCard title="Informações do Objeto" icon={PackageSearch}>
              <div className="space-y-3">
                {/* Type */}
                <SelectDropdown label="Tipo *" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="">Selecione o tipo</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </SelectDropdown>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descrição *</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="Descreva o objeto encontrado…"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                               bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                               outline-none focus:border-brand-primary transition-colors resize-none"
                  />
                </div>

                {/* Found at */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data/Hora Encontrado *</label>
                  <input
                    type="datetime-local"
                    value={form.found_at}
                    onChange={(e) => setForm((f) => ({ ...f, found_at: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                               bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                               outline-none focus:border-brand-primary transition-colors"
                  />
                </div>
              </div>
            </DrawerCard>

            <DrawerCard title="Localização" icon={MapPin}>
              <div className="space-y-3">
                {/* Found location */}
                <SelectDropdown label="Onde foi encontrado *" value={form.found_location} onChange={(e) => setForm((f) => ({ ...f, found_location: e.target.value }))}>
                  <option value="">Selecione o local</option>
                  {foundLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                </SelectDropdown>

                {/* Storage location */}
                <SelectDropdown label="Onde está guardado *" value={form.storage_location} onChange={(e) => setForm((f) => ({ ...f, storage_location: e.target.value }))}>
                  <option value="">Selecione o local</option>
                  {storageLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                </SelectDropdown>
              </div>
            </DrawerCard>

            <DrawerCard title="Foto *" icon={Camera}>
              <div className="space-y-2">
                {photoPreview && (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                    <img src={photoPreview} alt="Pré-visualização" className="w-full h-full object-contain" />
                    <button
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-white/80 text-gray-600 hover:bg-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="w-full text-sm text-gray-600 dark:text-gray-400
                             file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                             file:text-xs file:font-medium file:bg-brand-primary/10
                             file:text-brand-primary hover:file:bg-brand-primary/20"
                />
              </div>
            </DrawerCard>

            <DrawerCard title="Observações" icon={PackageSearch}>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Observações adicionais (opcional)…"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                           bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                           outline-none focus:border-brand-primary transition-colors resize-none"
              />
            </DrawerCard>
          </>
        )}

        {/* ── VIEW MODE ──────────────────────────────────────────────────────────── */}
        {drawerMode === 'view' && selected && !editing && (
          <>
            {/* Photo */}
            {selected.photo_url && (
              <DrawerCard title="Foto">
                <div className="w-full aspect-video rounded-xl overflow-hidden">
                  <img src={selected.photo_url} alt={selected.type} className="w-full h-full object-contain" />
                </div>
              </DrawerCard>
            )}

            <DrawerCard title="Informações do Objeto" icon={PackageSearch}>
              <div className="space-y-2 text-sm">
                <Row label="Tipo" value={selected.type} />
                <Row label="Descrição" value={selected.description} />
                <Row label="Encontrado em" value={fmtDateTime(selected.found_at)} />
              </div>
            </DrawerCard>

            <DrawerCard title="Localização" icon={MapPin}>
              <div className="space-y-2 text-sm">
                <Row label="Onde achado" value={selected.found_location} />
                <Row label="Guardado em" value={selected.storage_location} />
              </div>
            </DrawerCard>

            {selected.notes && (
              <DrawerCard title="Observações">
                <p className="text-sm text-gray-700 dark:text-gray-300">{selected.notes}</p>
              </DrawerCard>
            )}

            {/* Delivery info */}
            {selected.status === 'delivered' && (
              <DrawerCard title="Entrega">
                <div className="space-y-2 text-sm">
                  {selected.delivered_at && <Row label="Entregue em" value={fmtDateTime(selected.delivered_at)} />}
                  {selected.delivery_student && (
                    <Row label="Aluno" value={(selected.delivery_student as { full_name: string }).full_name} />
                  )}
                </div>
              </DrawerCard>
            )}

            {/* Discard info */}
            {selected.status === 'discarded' && (
              <DrawerCard title="Descarte">
                <div className="space-y-2 text-sm">
                  {selected.discarded_at && <Row label="Descartado em" value={fmtDateTime(selected.discarded_at)} />}
                  {selected.discard_reason && <Row label="Motivo" value={selected.discard_reason} />}
                </div>
              </DrawerCard>
            )}

            {/* ── Actions ────────────────────────────────────────────────────────── */}
            {(selected.status === 'available' || selected.status === 'claimed') && (
              <DrawerCard title="Ações">
                <div className="space-y-3">
                  {/* Edit (available only) */}
                  {selected.status === 'available' && !showDelivery && !showDiscard && (
                    <button
                      onClick={() => {
                        setEditForm({
                          type: selected.type,
                          description: selected.description,
                          found_location: selected.found_location,
                          storage_location: selected.storage_location,
                          found_at: selected.found_at.slice(0, 16),
                          notes: selected.notes ?? '',
                        });
                        setEditing(true);
                      }}
                      className="w-full py-2 rounded-xl border border-gray-200 dark:border-gray-700
                                 text-sm text-gray-600 dark:text-gray-300
                                 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Editar informações
                    </button>
                  )}

                  {/* Register delivery */}
                  {!showDelivery && !showDiscard && (
                    <button
                      onClick={() => setShowDelivery(true)}
                      className="w-full py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20
                                 text-sm text-emerald-700 dark:text-emerald-400 font-medium
                                 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2"
                    >
                      <User className="w-4 h-4" /> Registrar Entrega
                    </button>
                  )}

                  {/* Delivery sub-form */}
                  {showDelivery && (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-3 space-y-3 bg-emerald-50/50 dark:bg-emerald-900/10">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Entrega</p>

                      {/* Student search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={(e) => { setStudentSearch(e.target.value); setSelectedStudent(null); }}
                          placeholder="Buscar aluno por nome ou matrícula…"
                          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                                     bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                                     outline-none focus:border-brand-primary transition-colors"
                        />
                      </div>

                      {/* Results */}
                      {studentResults.length > 0 && !selectedStudent && (
                        <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                          {studentResults.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => { setSelectedStudent(s); setStudentSearch(s.full_name); setStudentResults([]); }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300
                                         hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                                         border-b border-gray-100 dark:border-gray-700 last:border-0"
                            >
                              {s.full_name}
                              {s.enrollment && <span className="text-gray-400 ml-2 text-xs">#{s.enrollment}</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedStudent && (
                        <div className="flex items-center gap-2 text-xs bg-white dark:bg-gray-900 rounded-xl px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-gray-700 dark:text-gray-300 flex-1">{selectedStudent.full_name}</span>
                          <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} className="text-gray-400 hover:text-gray-600">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowDelivery(false); setStudentSearch(''); setSelectedStudent(null); setStudentResults([]); }}
                          className="flex-1 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700
                                     text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDelivery}
                          disabled={deliverySaveState !== 'idle'}
                          className={`flex-1 py-2 text-xs rounded-xl font-medium transition-all flex items-center justify-center gap-1.5
                                      ${deliverySaveState === 'saved'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'}`}
                        >
                          {deliverySaveState === 'saving' ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>
                          ) : deliverySaveState === 'saved' ? (
                            <><Check className="w-3 h-3" /> Salvo!</>
                          ) : (
                            <><Check className="w-3 h-3" /> Confirmar Entrega</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Discard */}
                  {!showDelivery && !showDiscard && (
                    <button
                      onClick={() => setShowDiscard(true)}
                      className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-900/20
                                 text-sm text-red-600 dark:text-red-400 font-medium
                                 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Descartar Objeto
                    </button>
                  )}

                  {/* Discard sub-form */}
                  {showDiscard && (
                    <div className="rounded-xl border border-red-200 dark:border-red-800 p-3 space-y-3 bg-red-50/50 dark:bg-red-900/10">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Confirmar Descarte</p>
                      </div>

                      <SelectDropdown label="Motivo" value={discardReason} onChange={(e) => setDiscardReason(e.target.value)}>
                        {DISCARD_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </SelectDropdown>

                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Observações (opcional)</label>
                        <input
                          type="text"
                          value={discardNotes}
                          onChange={(e) => setDiscardNotes(e.target.value)}
                          placeholder="Ex.: doado para instituição…"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                                     bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                                     outline-none focus:border-brand-primary transition-colors"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowDiscard(false); setDiscardNotes(''); setDiscardReason('doação'); }}
                          className="flex-1 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700
                                     text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDiscard}
                          disabled={discardSaveState !== 'idle'}
                          className={`flex-1 py-2 text-xs rounded-xl font-medium transition-all flex items-center justify-center gap-1.5
                                      ${discardSaveState === 'saved'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'}`}
                        >
                          {discardSaveState === 'saving' ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>
                          ) : discardSaveState === 'saved' ? (
                            <><Check className="w-3 h-3" /> Salvo!</>
                          ) : (
                            <><Trash2 className="w-3 h-3" /> Confirmar Descarte</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </DrawerCard>
            )}

            {/* Timeline */}
            <DrawerCard title="Histórico" icon={Clock}>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum evento registrado.</p>
              ) : (
                <div className="space-y-3">
                  {events.map((ev, i) => (
                    <div key={ev.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-brand-primary mt-1" />
                        {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1 min-h-[16px]" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">{ev.event}</p>
                        {ev.actor_name && (
                          <p className="text-xs text-gray-400">por {ev.actor_name}</p>
                        )}
                        {ev.metadata && typeof ev.metadata === 'object' && Object.keys(ev.metadata).length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {Object.entries(ev.metadata)
                              .filter(([, v]) => v != null && v !== '')
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(', ')}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">{fmtDateTime(ev.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DrawerCard>
          </>
        )}

        {/* ── EDIT MODE ─────────────────────────────────────────────────────────── */}
        {drawerMode === 'view' && selected && editing && (
          <>
            <DrawerCard title="Informações do Objeto" icon={PackageSearch}>
              <div className="space-y-3">
                <SelectDropdown label="Tipo *" value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="">Selecione o tipo</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </SelectDropdown>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descrição *</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                               bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                               outline-none focus:border-brand-primary transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data/Hora Encontrado *</label>
                  <input
                    type="datetime-local"
                    value={editForm.found_at}
                    onChange={(e) => setEditForm((f) => ({ ...f, found_at: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                               bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                               outline-none focus:border-brand-primary transition-colors"
                  />
                </div>
              </div>
            </DrawerCard>

            <DrawerCard title="Localização" icon={MapPin}>
              <div className="space-y-3">
                <SelectDropdown label="Onde foi encontrado *" value={editForm.found_location} onChange={(e) => setEditForm((f) => ({ ...f, found_location: e.target.value }))}>
                  <option value="">Selecione o local</option>
                  {foundLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                </SelectDropdown>
                <SelectDropdown label="Onde está guardado *" value={editForm.storage_location} onChange={(e) => setEditForm((f) => ({ ...f, storage_location: e.target.value }))}>
                  <option value="">Selecione o local</option>
                  {storageLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                </SelectDropdown>
              </div>
            </DrawerCard>

            <DrawerCard title="Observações">
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Observações adicionais (opcional)…"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                           bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                           outline-none focus:border-brand-primary transition-colors resize-none"
              />
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

function LostFoundCard({ item, onClick }: { item: LostFoundItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700
                 p-4 text-left hover:border-brand-primary/40 hover:shadow-sm transition-all w-full"
    >
      {/* Thumbnail */}
      <div className="w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 mb-3 flex items-center justify-center">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.type} className="w-full h-full object-contain" />
        ) : (
          <PackageSearch className="w-8 h-8 text-gray-300 dark:text-gray-600" />
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {item.type}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(item.status)}`}>
          {LOST_FOUND_STATUS_LABELS[item.status]}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium line-clamp-2 mb-2">
        {item.description}
      </p>

      {/* Meta */}
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{item.found_location} → {item.storage_location}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          {fmtDate(item.found_at)}
        </p>
      </div>
    </button>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 dark:text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-800 dark:text-gray-200 flex-1 break-words">{value}</span>
    </div>
  );
}
