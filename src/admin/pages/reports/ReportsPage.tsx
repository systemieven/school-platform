import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { exportCSV, exportXLSX, exportPDF, type ExportColumn } from '../../lib/export';
import {
  BarChart2, GraduationCap, MessageSquare, CalendarCheck,
  Download, FileText, FileSpreadsheet, Loader2, SlidersHorizontal,
  ChevronUp, ChevronDown, Search, X, Columns, CheckSquare, Square,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Module = 'enrollments' | 'contacts' | 'appointments';
type DateFilter = 'all' | '7d' | '30d' | '90d' | 'custom';
type SortDir = 'asc' | 'desc';

interface ColDef extends ExportColumn {
  visible: boolean;
  sortable?: boolean;
  render?: (val: unknown, row: Record<string, unknown>) => string;
}

interface FilterState {
  date: DateFilter;
  customStart: string;
  customEnd: string;
  status: string;
  search: string;
}

// ── Preset reports ────────────────────────────────────────────────────────────
interface Preset {
  key: string;
  label: string;
  description: string;
  module: Module;
  filters: Partial<FilterState>;
}

const PRESETS: Preset[] = [
  {
    key: 'monthly_conversion',
    label: 'Conversão Mensal',
    description: 'Matrículas recebidas no último mês e seu status atual.',
    module: 'enrollments',
    filters: { date: '30d' },
  },
  {
    key: 'lead_origin',
    label: 'Origem de Leads',
    description: 'Contatos recebidos nos últimos 30 dias por motivo.',
    module: 'contacts',
    filters: { date: '30d' },
  },
  {
    key: 'no_show_rate',
    label: 'Taxa de No-Show',
    description: 'Agendamentos com status no-show nos últimos 90 dias.',
    module: 'appointments',
    filters: { date: '90d', status: 'no_show' },
  },
];

// ── Column definitions per module ─────────────────────────────────────────────
const ENROLLMENT_COLS: ColDef[] = [
  { key: 'created_at',    label: 'Data',             visible: true,  sortable: true,  render: (v) => fmtDate(v as string) },
  { key: 'student_name',  label: 'Aluno',            visible: true,  sortable: true },
  { key: 'guardian_name', label: 'Responsável',      visible: true,  sortable: true },
  { key: 'guardian_phone',label: 'Telefone',         visible: true },
  { key: 'guardian_email',label: 'E-mail',           visible: false },
  { key: 'segment',       label: 'Segmento',         visible: true,  sortable: true },
  { key: 'status',        label: 'Status',           visible: true,  sortable: true,  render: (v) => ENROLLMENT_STATUS_LABELS[v as string] ?? String(v) },
  { key: 'origin',        label: 'Origem',           visible: false, render: (v) => ORIGIN_LABELS[v as string] ?? String(v) },
  { key: 'guardian_city', label: 'Cidade',           visible: false, sortable: true },
];

const CONTACT_COLS: ColDef[] = [
  { key: 'created_at',       label: 'Data',          visible: true,  sortable: true,  render: (v) => fmtDate(v as string) },
  { key: 'name',             label: 'Nome',          visible: true,  sortable: true },
  { key: 'phone',            label: 'Telefone',      visible: true },
  { key: 'email',            label: 'E-mail',        visible: false },
  { key: 'contact_reason',   label: 'Motivo',        visible: true,  sortable: true },
  { key: 'status',           label: 'Status',        visible: true,  sortable: true,  render: (v) => CONTACT_STATUS_LABELS[v as string] ?? String(v) },
  { key: 'how_found_us',     label: 'Como nos encontrou', visible: false },
  { key: 'wants_visit',      label: 'Quer visita',   visible: false, render: (v) => v ? 'Sim' : 'Não' },
  { key: 'segment_interest', label: 'Segmento',      visible: false, sortable: true },
];

const APPOINTMENT_COLS: ColDef[] = [
  { key: 'created_at',       label: 'Criado em',     visible: false, sortable: true,  render: (v) => fmtDate(v as string) },
  { key: 'appointment_date', label: 'Data da visita',visible: true,  sortable: true,  render: (v) => fmtDate(v as string) },
  { key: 'appointment_time', label: 'Horário',       visible: true,  render: (v) => String(v).slice(0, 5) },
  { key: 'visitor_name',     label: 'Visitante',     visible: true,  sortable: true },
  { key: 'visitor_phone',    label: 'Telefone',      visible: true },
  { key: 'visitor_email',    label: 'E-mail',        visible: false },
  { key: 'visit_reason',     label: 'Motivo',        visible: true,  sortable: true },
  { key: 'status',           label: 'Status',        visible: true,  sortable: true,  render: (v) => APPT_STATUS_LABELS[v as string] ?? String(v) },
  { key: 'origin',           label: 'Origem',        visible: false, render: (v) => ORIGIN_LABELS[v as string] ?? String(v) },
];

// ── Label maps ────────────────────────────────────────────────────────────────
const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  new: 'Novo', under_review: 'Em análise', docs_pending: 'Docs. pendentes',
  docs_received: 'Docs. recebidos', interview_scheduled: 'Entrevista', approved: 'Aprovado',
  confirmed: 'Confirmado', archived: 'Arquivado', pending: 'Pendente', rejected: 'Rejeitado',
};
const CONTACT_STATUS_LABELS: Record<string, string> = {
  new: 'Novo', first_contact: '1º contato', follow_up: 'Follow-up',
  contacted: 'Contatado', converted: 'Convertido', resolved: 'Resolvido',
  archived: 'Arquivado', closed: 'Encerrado',
};
const APPT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmado', completed: 'Realizado',
  cancelled: 'Cancelado', no_show: 'Não veio',
};
const ORIGIN_LABELS: Record<string, string> = {
  website: 'Site', internal: 'Interno', in_person: 'Presencial',
  phone: 'Telefone', referral: 'Indicação',
};

// ── Status options per module ─────────────────────────────────────────────────
const STATUS_OPTS: Record<Module, { key: string; label: string }[]> = {
  enrollments: Object.entries(ENROLLMENT_STATUS_LABELS).map(([k, v]) => ({ key: k, label: v })),
  contacts:    Object.entries(CONTACT_STATUS_LABELS).map(([k, v])    => ({ key: k, label: v })),
  appointments:Object.entries(APPT_STATUS_LABELS).map(([k, v])       => ({ key: k, label: v })),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
}

function getDateRange(filter: DateFilter, start: string, end: string) {
  const now = new Date();
  if (filter === 'custom') return { from: start, to: end + 'T23:59:59' };
  if (filter === 'all') return null;
  const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: now.toISOString() };
}

const MODULE_CONFIG: Record<Module, { table: string; dateField: string }> = {
  enrollments:  { table: 'enrollments',       dateField: 'created_at' },
  contacts:     { table: 'contact_requests',  dateField: 'created_at' },
  appointments: { table: 'visit_appointments',dateField: 'appointment_date' },
};

const MODULE_COLS: Record<Module, ColDef[]> = {
  enrollments:  ENROLLMENT_COLS,
  contacts:     CONTACT_COLS,
  appointments: APPOINTMENT_COLS,
};

// ── Module tab header ─────────────────────────────────────────────────────────
const MODULES: { key: Module; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'enrollments',  label: 'Pré-Matrículas', icon: GraduationCap },
  { key: 'contacts',     label: 'Contatos',        icon: MessageSquare },
  { key: 'appointments', label: 'Agendamentos',    icon: CalendarCheck },
];

const DATE_OPTS: { key: DateFilter; label: string }[] = [
  { key: 'all',    label: 'Todos' },
  { key: '7d',     label: '7 dias' },
  { key: '30d',    label: '30 dias' },
  { key: '90d',    label: '90 dias' },
  { key: 'custom', label: 'Personalizado' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [module, setModule]   = useState<Module>('enrollments');
  const [cols, setCols]       = useState<ColDef[]>(MODULE_COLS['enrollments'].map((c) => ({ ...c })));
  const [rows, setRows]       = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showColPicker, setShowColPicker] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    date: '30d', customStart: '', customEnd: '', status: '', search: '',
  });

  // Switch module
  function switchModule(m: Module) {
    setModule(m);
    setCols(MODULE_COLS[m].map((c) => ({ ...c })));
    setRows([]);
    setSortKey(m === 'appointments' ? 'appointment_date' : 'created_at');
    setSortDir('desc');
    setFilters({ date: '30d', customStart: '', customEnd: '', status: '', search: '' });
  }

  // Apply preset
  function applyPreset(p: Preset) {
    switchModule(p.module);
    setFilters((prev) => ({ ...prev, date: '30d', status: '', search: '', ...p.filters }));
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { table, dateField } = MODULE_CONFIG[module];
    const colKeys = MODULE_COLS[module].map((c) => c.key);
    let q = supabase.from(table).select(colKeys.join(','));

    const range = getDateRange(filters.date, filters.customStart, filters.customEnd);
    if (range?.from) q = q.gte(dateField, range.from);
    if (range?.to)   q = q.lte(dateField, range.to);
    if (filters.status) q = q.eq('status', filters.status);

    q = q.order(sortKey, { ascending: sortDir === 'asc' }).limit(1000);

    const { data } = await q;
    setRows((data ?? []) as Record<string, unknown>[]);
    setLoading(false);
  }, [module, filters, sortKey, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered rows (client-side search)
  const visibleRows = useMemo(() => {
    if (!filters.search.trim()) return rows;
    const q = filters.search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
    );
  }, [rows, filters.search]);

  const visibleCols = cols.filter((c) => c.visible);

  function cellValue(col: ColDef, row: Record<string, unknown>) {
    const raw = row[col.key];
    if (col.render) return col.render(raw, row);
    return raw == null ? '—' : String(raw);
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function handleExport(fmt: 'csv' | 'xlsx' | 'pdf') {
    const exportCols = visibleCols.map((c) => ({ key: c.key, label: c.label }));
    const mod = MODULES.find((m) => m.key === module)!;
    const exportRows = visibleRows.map((row) => {
      const out: Record<string, unknown> = {};
      visibleCols.forEach((c) => { out[c.key] = cellValue(c, row); });
      return out;
    });
    const filename = `relatorio_${module}_${new Date().toISOString().split('T')[0]}`;
    if (fmt === 'csv')  exportCSV(exportRows, exportCols, filename);
    if (fmt === 'xlsx') exportXLSX(exportRows, exportCols, filename);
    if (fmt === 'pdf')  exportPDF(exportRows, exportCols, filename, `Relatório: ${mod.label}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <BarChart2 className="w-8 h-8" />
            Relatórios
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Exporte e analise dados por módulo.</p>
        </div>
      </div>

      {/* Preset cards */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p)}
            className="text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 hover:border-[#003876]/30 dark:hover:border-[#ffd700]/30 hover:shadow-md transition-all group"
          >
            <p className="text-sm font-bold text-[#003876] dark:text-[#ffd700] group-hover:underline">{p.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{p.description}</p>
          </button>
        ))}
      </div>

      {/* Module tabs */}
      <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 gap-1 mb-4 w-fit">
        {MODULES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchModule(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              module === key
                ? 'bg-[#003876] text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filters + Export toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Date filter */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Período</label>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 gap-0.5">
              {DATE_OPTS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setFilters((f) => ({ ...f, date: o.key }))}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filters.date === o.key
                      ? 'bg-white dark:bg-gray-600 text-[#003876] dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          {filters.date === 'custom' && (
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">De</label>
                <input
                  type="date"
                  value={filters.customStart}
                  onChange={(e) => setFilters((f) => ({ ...f, customStart: e.target.value }))}
                  className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Até</label>
                <input
                  type="date"
                  value={filters.customEnd}
                  onChange={(e) => setFilters((f) => ({ ...f, customEnd: e.target.value }))}
                  className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                />
              </div>
            </div>
          )}

          {/* Status filter */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              <option value="">Todos</option>
              {STATUS_OPTS[module].map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Busca</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Column toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColPicker((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Columns className="w-3.5 h-3.5" />
              Colunas
            </button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-20 p-3 min-w-[180px]">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Colunas visíveis</p>
                {cols.map((col, i) => (
                  <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:text-[#003876] dark:hover:text-[#ffd700]">
                    <button
                      onClick={() => setCols((prev) => prev.map((c, j) => j === i ? { ...c, visible: !c.visible } : c))}
                      className="flex-shrink-0"
                    >
                      {col.visible
                        ? <CheckSquare className="w-3.5 h-3.5 text-[#003876] dark:text-[#ffd700]" />
                        : <Square className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />}
                    </button>
                    <span className="text-xs text-gray-700 dark:text-gray-300">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 mr-1"><Download className="w-3.5 h-3.5 inline" /></span>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              CSV
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg text-emerald-700 dark:text-emerald-400 font-medium transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              XLSX
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {loading ? 'Carregando…' : `${visibleRows.length} registro${visibleRows.length !== 1 ? 's' : ''}`}
        </p>
        {filters.search && (
          <p className="text-xs text-[#003876] dark:text-[#ffd700]">
            Filtrado por "{filters.search}"
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="text-center py-16">
            <SlidersHorizontal className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum registro encontrado para os filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {visibleCols.map((col) => (
                    <th
                      key={col.key}
                      className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap ${
                        col.sortable ? 'cursor-pointer hover:text-[#003876] dark:hover:text-[#ffd700] select-none' : ''
                      }`}
                      onClick={() => col.sortable && toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.sortable && sortKey === col.key && (
                          sortDir === 'asc'
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {visibleRows.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    {visibleCols.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {cellValue(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
