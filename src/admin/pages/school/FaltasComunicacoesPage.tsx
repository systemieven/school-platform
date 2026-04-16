import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquareDot, Loader2, Check, X, Search,
  ChevronLeft, ChevronRight, CalendarDays, User,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import type {
  AbsenceCommunication,
  AbsenceCommunicationStatus,
} from '../../types/admin.types';
import {
  ABSENCE_COMM_STATUS_LABELS,
  ABSENCE_COMM_STATUS_COLORS,
} from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';

// ── Colour helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const TYPE_BADGE: Record<string, string> = {
  planned:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  justification: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const TYPE_LABELS: Record<string, string> = {
  planned:       'Programada',
  justification: 'Justificativa',
};

const PAGE_SIZE = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiaryAttendanceOption {
  id: string;
  student_id: string;
  status: string;
  diary_entry?: { entry_date: string } | null;
}

type SaveState = 'idle' | 'saving' | 'saved';

// ── Component ─────────────────────────────────────────────────────────────────

export default function FaltasComunicacoesPage() {
  const { profile } = useAdminAuth();

  // List state
  const [rows, setRows]       = useState<AbsenceCommunication[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const [total, setTotal]     = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState<AbsenceCommunicationStatus | ''>('');
  const [filterFrom, setFilterFrom]     = useState('');
  const [filterTo, setFilterTo]         = useState('');
  const [searchStudent, setSearchStudent] = useState('');

  // Review drawer
  const [selected, setSelected]         = useState<AbsenceCommunication | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [action, setAction]             = useState<'accept' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saveState, setSaveState]       = useState<SaveState>('idle');

  // Diary attendance link
  const [diaryOptions, setDiaryOptions]             = useState<DiaryAttendanceOption[]>([]);
  const [selectedDiaryId, setSelectedDiaryId]       = useState('');
  const [loadingDiary, setLoadingDiary]             = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const loadRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('absence_communications')
      .select(
        `id, student_id, guardian_id, type, absence_date, reason_key, notes, attachment_url, status,
         reviewed_by, reviewed_at, rejection_reason, diary_attendance_id,
         created_at, updated_at,
         student:students(id, full_name),
         guardian:guardian_profiles(id, name),
         reason:absence_reason_options(id, key, label, icon, color, is_active, position, description)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterStatus) q = q.eq('status', filterStatus);
    if (filterFrom)   q = q.gte('absence_date', filterFrom);
    if (filterTo)     q = q.lte('absence_date', filterTo);

    const { data, count, error } = await q;

    if (!error && data) {
      let filtered = data as unknown as AbsenceCommunication[];
      if (searchStudent.trim()) {
        const lower = searchStudent.toLowerCase();
        filtered = filtered.filter((r) =>
          r.student?.full_name?.toLowerCase().includes(lower)
        );
      }
      setRows(filtered);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, filterStatus, filterFrom, filterTo, searchStudent]);

  useEffect(() => { loadRows(); }, [loadRows]);

  // ── Diary options for linking ─────────────────────────────────────────────

  async function loadDiaryOptions(studentId: string, date: string) {
    setLoadingDiary(true);
    const { data } = await supabase
      .from('diary_attendance')
      .select('id, student_id, status, diary_entry:class_diary_entries(entry_date)')
      .eq('student_id', studentId)
      .not('status', 'eq', 'present');

    if (data) {
      const filtered = (data as unknown as DiaryAttendanceOption[]).filter((d) => {
        const entryDate = (d.diary_entry as { entry_date: string } | null)?.entry_date;
        return entryDate === date;
      });
      setDiaryOptions(filtered);
    }
    setLoadingDiary(false);
  }

  function openReview(row: AbsenceCommunication, act: 'accept' | 'reject') {
    setSelected(row);
    setAction(act);
    setRejectionReason('');
    setSelectedDiaryId('');
    setDiaryOptions([]);
    setDrawerOpen(true);
    if (act === 'accept') {
      loadDiaryOptions(row.student_id, row.absence_date);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => { setSelected(null); setAction(null); setSaveState('idle'); }, 300);
  }

  async function handleSave() {
    if (!selected || !profile) return;
    setSaveState('saving');

    const now = new Date().toISOString();

    if (action === 'accept') {
      const { error } = await supabase
        .from('absence_communications')
        .update({
          status:              'accepted',
          reviewed_by:         profile.id,
          reviewed_at:         now,
          diary_attendance_id: selectedDiaryId || null,
          updated_at:          now,
        })
        .eq('id', selected.id);

      if (!error && selectedDiaryId) {
        await supabase
          .from('diary_attendance')
          .update({ absence_communication_id: selected.id })
          .eq('id', selectedDiaryId);
      }

      if (error) { setSaveState('idle'); return; }
    } else {
      const { error } = await supabase
        .from('absence_communications')
        .update({
          status:           'rejected',
          reviewed_by:      profile.id,
          reviewed_at:      now,
          rejection_reason: rejectionReason || null,
          updated_at:       now,
        })
        .eq('id', selected.id);

      if (error) { setSaveState('idle'); return; }
    }

    setSaveState('saved');
    setTimeout(() => {
      closeDrawer();
      loadRows();
    }, 900);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabs: Array<{ value: AbsenceCommunicationStatus | ''; label: string }> = [
    { value: '',          label: 'Todas' },
    { value: 'sent',      label: 'Enviadas' },
    { value: 'analyzing', label: 'Em Análise' },
    { value: 'accepted',  label: 'Aceitas' },
    { value: 'rejected',  label: 'Recusadas' },
  ];

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <MessageSquareDot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Comunicação de Faltas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Análise e vínculo das comunicações enviadas pelos responsáveis</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => { setFilterStatus(t.value as AbsenceCommunicationStatus | ''); setPage(0); }}
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

        {/* Search + date */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={searchStudent}
              onChange={(e) => { setSearchStudent(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary transition-colors"
            />
          </div>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => { setFilterFrom(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary transition-colors"
            title="Data inicial"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => { setFilterTo(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary transition-colors"
            title="Data final"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <MessageSquareDot className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {filterStatus ? `Nenhuma comunicação ${ABSENCE_COMM_STATUS_LABELS[filterStatus as AbsenceCommunicationStatus]?.toLowerCase() ?? ''}` : 'Nenhuma comunicação encontrada'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <CommunicationCard
              key={row.id}
              row={row}
              onAccept={() => openReview(row, 'accept')}
              onReject={() => openReview(row, 'reject')}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Review Drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer} title={action === 'accept' ? 'Aceitar Comunicação' : 'Recusar Comunicação'}>
        {selected && (
          <>
            <DrawerCard title="Dados da Comunicação">
              <div className="space-y-3 text-sm">
                <Row label="Aluno" value={selected.student?.full_name ?? '—'} />
                <Row label="Responsável" value={selected.guardian?.name ?? '—'} />
                <Row label="Tipo" value={TYPE_LABELS[selected.type] ?? selected.type} />
                <Row label="Data da Falta" value={formatDate(selected.absence_date)} />
                <Row label="Motivo" value={selected.reason?.label ?? selected.reason_key ?? '—'} />
                {selected.notes && <Row label="Observações" value={selected.notes} />}
              </div>
            </DrawerCard>

            {action === 'accept' && (
              <DrawerCard title="Vincular ao Diário (opcional)">
                {loadingDiary ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Buscando registros...
                  </div>
                ) : diaryOptions.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum registro de falta no diário para esta data.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Selecione o registro de frequência no diário para vincular:</p>
                    {diaryOptions.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="diary_attendance"
                          value={d.id}
                          checked={selectedDiaryId === d.id}
                          onChange={() => setSelectedDiaryId(d.id)}
                          className="accent-brand-primary"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          Registro {d.id.slice(0, 8)}… — status: {d.status}
                        </span>
                      </label>
                    ))}
                    {selectedDiaryId && (
                      <button
                        onClick={() => setSelectedDiaryId('')}
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        Limpar seleção
                      </button>
                    )}
                  </div>
                )}
              </DrawerCard>
            )}

            {action === 'reject' && (
              <DrawerCard title="Motivo da Recusa">
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Explique o motivo da recusa (opcional)..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary transition-colors resize-none"
                />
              </DrawerCard>
            )}

            {/* Footer */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeDrawer}
                disabled={saveState === 'saving'}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saveState !== 'idle'}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  saveState === 'saved'
                    ? 'bg-emerald-500 text-white'
                    : action === 'reject'
                    ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'
                    : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
                }`}
              >
                {saveState === 'saving' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
                ) : saveState === 'saved' ? (
                  <><Check className="w-4 h-4" /> Salvo!</>
                ) : action === 'accept' ? (
                  <><Check className="w-4 h-4" /> Aceitar</>
                ) : (
                  <><X className="w-4 h-4" /> Recusar</>
                )}
              </button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function CommunicationCard({
  row,
  onAccept,
  onReject,
}: {
  row: AbsenceCommunication;
  onAccept: () => void;
  onReject: () => void;
}) {
  const color = ABSENCE_COMM_STATUS_COLORS[row.status];
  const canReview = row.status === 'sent' || row.status === 'analyzing';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {row.student?.full_name ?? '—'}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[row.type] ?? 'bg-gray-100 text-gray-600'}`}>
              {TYPE_LABELS[row.type] ?? row.type}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[color] ?? 'bg-gray-100 text-gray-600'}`}>
              {ABSENCE_COMM_STATUS_LABELS[row.status]}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {row.guardian?.name ?? '—'}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> {formatDate(row.absence_date)}
            </span>
            {row.reason?.label && (
              <span>{row.reason.label}</span>
            )}
          </div>
          {row.notes && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{row.notes}</p>
          )}
          {row.rejection_reason && (
            <p className="text-xs text-red-500 mt-1">Recusa: {row.rejection_reason}</p>
          )}
        </div>

        {canReview && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onReject}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors"
            >
              Recusar
            </button>
            <button
              onClick={onAccept}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors"
            >
              Aceitar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 dark:text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-800 dark:text-gray-200 flex-1">{value}</span>
    </div>
  );
}

function formatDate(date: string): string {
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}
