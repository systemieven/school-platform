import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, ChevronLeft, ChevronRight, Loader2, Check,
  Pencil, Filter, Download, Users,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import type { ActivityAuthorization, AuthorizationResponse } from '../../types/admin.types';

// ── Colour maps ───────────────────────────────────────────────────────────────

const AUTH_STATUS_CLASSES: Record<string, string> = {
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const AUTH_STATUS_LABELS: Record<string, string> = {
  active:    'Ativo',
  closed:    'Encerrado',
  cancelled: 'Cancelado',
};

const RESPONSE_CLASSES: Record<string, string> = {
  authorized:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  not_authorized: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  pending:        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const RESPONSE_LABELS: Record<string, string> = {
  authorized:     'Autorizado',
  not_authorized: 'Não autorizado',
  pending:        'Pendente',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolClass { id: string; name: string; }

interface AuthorizationRow extends ActivityAuthorization {
  response_count?: number;
  expected_count?: number;
}

interface ResponseRow extends AuthorizationResponse {
  student?: { id: string; full_name: string } | null;
}

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  title: '',
  description: '',
  class_ids: [] as string[],
  activity_date: '',
  deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  requires_response: true,
  notes: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutorizacoesPage() {
  // List state
  const [rows, setRows] = useState<AuthorizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Reference
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  // Drawer — create/edit
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AuthorizationRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Drawer — detail/responses
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<AuthorizationRow | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // ── Reference data ──
  useEffect(() => {
    supabase.from('school_classes').select('id, name').order('name').then(({ data }) => {
      if (data) setClasses(data);
    });
  }, []);

  // ── Fetch list ──
  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('activity_authorizations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterStatus) q = q.eq('status', filterStatus);
    if (filterFrom)   q = q.gte('activity_date', filterFrom);
    if (filterTo)     q = q.lte('activity_date', filterTo);
    if (filterClass)  q = q.contains('class_ids', [filterClass]);

    const { data, count } = await q;
    setRows((data as AuthorizationRow[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, filterStatus, filterClass, filterFrom, filterTo]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Responses ──
  async function loadResponses(authId: string) {
    setResponsesLoading(true);
    const { data } = await supabase
      .from('authorization_responses')
      .select('*, student:students(id,full_name)')
      .eq('authorization_id', authId)
      .order('responded_at', { ascending: false });
    setResponses((data as ResponseRow[]) ?? []);
    setResponsesLoading(false);
  }

  function openDetail(row: AuthorizationRow) {
    setDetailItem(row);
    setDetailOpen(true);
    loadResponses(row.id);
  }

  // ── Drawer helpers ──
  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(row: AuthorizationRow) {
    setEditing(row);
    setForm({
      title: row.title,
      description: row.description,
      class_ids: row.class_ids ?? [],
      activity_date: row.activity_date ?? '',
      deadline: row.deadline,
      requires_response: row.requires_response,
      notes: row.notes ?? '',
    });
    setDrawerOpen(true);
  }

  function toggleClass(id: string) {
    setForm(f => ({
      ...f,
      class_ids: f.class_ids.includes(id)
        ? f.class_ids.filter(c => c !== id)
        : [...f.class_ids, id],
    }));
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      class_ids: form.class_ids.length > 0 ? form.class_ids : null,
      activity_date: form.activity_date || null,
      deadline: form.deadline,
      requires_response: form.requires_response,
      notes: form.notes.trim() || null,
      status: 'active' as const,
    };

    if (editing) {
      await supabase.from('activity_authorizations').update(payload).eq('id', editing.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_authorizations').insert({ ...payload, created_by: user?.id ?? null });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setDrawerOpen(false);
      fetchRows();
    }, 900);
  }

  // ── Export authorized list ──
  function exportAuthorized() {
    if (!detailItem) return;
    const authorized = responses.filter(r => r.response === 'authorized');
    const lines = [
      `Autorização: ${detailItem.title}`,
      `Data da atividade: ${detailItem.activity_date ? new Date(detailItem.activity_date).toLocaleDateString('pt-BR') : '—'}`,
      '',
      'Aluno,Status,Notas,Data de resposta',
      ...authorized.map(r =>
        `${r.student?.full_name ?? r.student_id},${RESPONSE_LABELS[r.response]},${r.notes ?? ''},${r.responded_at ? new Date(r.responded_at).toLocaleDateString('pt-BR') : ''}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autorizados-${detailItem.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canSave = form.title.trim().length > 0 && form.deadline.length > 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Autorizações</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Autorizações de atividades e acompanhamento de respostas
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl transition-colors"
        >
          <ClipboardCheck className="w-4 h-4" />
          Nova autorização
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todos os status</option>
            {Object.keys(AUTH_STATUS_LABELS).map(k => (
              <option key={k} value={k}>{AUTH_STATUS_LABELS[k]}</option>
            ))}
          </select>
          <select
            value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todas as turmas</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(0); }}
            title="Data da atividade — início"
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(0); }}
            title="Data da atividade — fim"
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardCheck className="w-10 h-10 text-gray-200 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma autorização encontrada</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Crie uma nova autorização para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Título', 'Data da atividade', 'Prazo', 'Status', 'Turmas', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white max-w-[220px] truncate">
                      {row.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {row.activity_date ? new Date(row.activity_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {new Date(row.deadline).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${AUTH_STATUS_CLASSES[row.status]}`}>
                        {AUTH_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.class_ids && row.class_ids.length > 0
                        ? `${row.class_ids.length} turma${row.class_ids.length > 1 ? 's' : ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetail(row)}
                          className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Ver respostas"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(row)}
                          className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {total} autorização{total !== 1 ? 'ões' : ''} · página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar autorização' : 'Nova autorização'}
        icon={ClipboardCheck}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setDrawerOpen(false)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
              }`}
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved
                  ? <Check className="w-4 h-4" />
                  : <ClipboardCheck className="w-4 h-4" />}
              {saving ? 'Salvando…' : saved ? 'Salvo!' : editing ? 'Salvar alterações' : 'Criar autorização'}
            </button>
          </div>
        }
      >
        {/* Card 1 — Identificação */}
        <DrawerCard title="Identificação" icon={ClipboardCheck}>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Título *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Excursão ao Museu do Amanhã"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Descrição</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Descreva a atividade…"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none resize-none"
              />
            </div>
          </div>
        </DrawerCard>

        {/* Card 2 — Alvo */}
        <DrawerCard title="Alvo">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Turmas</label>
              <div className="flex flex-wrap gap-2">
                {classes.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClass(c.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                      form.class_ids.includes(c.id)
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-brand-primary'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">Data da atividade</label>
                <input
                  type="date"
                  value={form.activity_date}
                  onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">Prazo de resposta *</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </DrawerCard>

        {/* Card 3 — Respostas */}
        <DrawerCard title="Respostas">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm(f => ({ ...f, requires_response: !f.requires_response }))}
              className={`relative w-9 h-5 rounded-full transition-colors ${form.requires_response ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.requires_response ? 'left-4' : 'left-0.5'}`} />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-200">Exige resposta do responsável</span>
          </label>
        </DrawerCard>

        {/* Card 4 — Observações */}
        <DrawerCard title="Observações">
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder="Observações internas…"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none resize-none"
          />
        </DrawerCard>
      </Drawer>

      {/* ── Detail / Responses Drawer ── */}
      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Respostas"
        icon={Users}
        width="w-[520px]"
        headerExtra={
          <button
            onClick={exportAuthorized}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar autorizados
          </button>
        }
      >
        {detailItem && (
          <>
            <DrawerCard title="Autorização">
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-800 dark:text-white">{detailItem.title}</p>
                {detailItem.activity_date && (
                  <p className="text-gray-500 dark:text-gray-400">
                    Atividade: {new Date(detailItem.activity_date).toLocaleDateString('pt-BR')}
                  </p>
                )}
                <p className="text-gray-500 dark:text-gray-400">
                  Prazo: {new Date(detailItem.deadline).toLocaleDateString('pt-BR')}
                </p>
                <div className="pt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${AUTH_STATUS_CLASSES[detailItem.status]}`}>
                    {AUTH_STATUS_LABELS[detailItem.status]}
                  </span>
                </div>
              </div>
            </DrawerCard>

            <DrawerCard title="Respostas dos responsáveis">
              {responsesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : responses.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Users className="w-8 h-8 text-gray-200 dark:text-gray-600" />
                  <p className="text-sm text-gray-400">Nenhuma resposta registrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Aluno</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Notas</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Resposta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                      {responses.map(r => (
                        <tr key={r.id}>
                          <td className="px-4 py-2 font-medium text-gray-800 dark:text-white">
                            {r.student?.full_name ?? r.student_id}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESPONSE_CLASSES[r.response]}`}>
                              {RESPONSE_LABELS[r.response]}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400 max-w-[140px] truncate">
                            {r.notes ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">
                            {r.responded_at ? new Date(r.responded_at).toLocaleDateString('pt-BR') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}
