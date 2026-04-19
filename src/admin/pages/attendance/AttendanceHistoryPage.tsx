/**
 * AttendanceHistoryPage
 *
 * Página de consulta de atendimentos finalizados/abandonados/no_show.
 * - Roles normais veem apenas seus próprios atendimentos
 * - super_admin vê todos + filtro por atendente
 * - Permissão independente: attendance_history (can_view)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { AttendanceTicket, AttendanceTicketStatus } from '../../types/admin.types';
import AttendanceDetailsDrawer from './AttendanceDetailsDrawer';
import {
  History,
  Search,
  Loader2,
  Ticket,
  Phone,
  User,
  Clock,
  LayoutGrid,
  Calendar,
  Footprints,
  ArrowRightLeft,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldX,
  X,
} from 'lucide-react';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  AttendanceTicketStatus,
  { label: string; color: string; dot: string }
> = {
  waiting:    { label: 'Aguardando',      color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',       dot: 'bg-amber-400'   },
  called:     { label: 'Chamado',         color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',           dot: 'bg-blue-500'    },
  in_service: { label: 'Em atendimento',  color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',   dot: 'bg-indigo-500'  },
  finished:   { label: 'Finalizado',      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  abandoned:  { label: 'Abandonado',      color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',              dot: 'bg-gray-400'    },
  no_show:    { label: 'Não veio',        color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',               dot: 'bg-red-400'     },
};

type DateFilter = 'today' | 'week' | 'month' | 'custom';

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'No dia' },
  { key: 'week',  label: 'Na semana' },
  { key: 'month', label: 'No mês' },
  { key: 'custom', label: 'Personalizado' },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatPhone(p: string): string {
  const n = p.replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return p;
}

function secondsToLabel(total: number | null): string {
  if (total === null || total === undefined || total <= 0) return '—';
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem.toString().padStart(2, '0')}m`;
}

function getDateBounds(filter: DateFilter): { start: string; end?: string } | null {
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start: start.toISOString() };
  }
  if (filter === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday as start
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    return { start: start.toISOString() };
  }
  if (filter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: start.toISOString() };
  }
  return null;
}

// ── Date Range Picker ────────────────────────────────────────────────────────

function DateRangePicker({
  value,
  onChange,
  onApply,
  onClear,
}: {
  value: [Date | null, Date | null];
  onChange: (range: [Date | null, Date | null]) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [start, end] = value;

  function handleDayClick(day: Date) {
    if (!start || (start && end)) {
      onChange([day, null]);
    } else {
      if (day < start) {
        onChange([day, start]);
      } else {
        onChange([start, day]);
      }
    }
  }

  function renderMonth(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

    const monthLabel = firstDay.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    return (
      <div className="flex-1 min-w-[240px]">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 text-center mb-2 capitalize">
          {monthLabel}
        </p>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
            <span key={d} className="text-[10px] text-gray-400 font-medium py-1">{d}</span>
          ))}
          {days.map((day, idx) => {
            if (!day) return <span key={`empty-${idx}`} />;
            const isStart = start && day.toDateString() === start.toDateString();
            const isEnd = end && day.toDateString() === end.toDateString();
            const isBetween = start && end && day > start && day < end;
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleDayClick(day)}
                className={`
                  text-xs py-1.5 rounded-lg transition-colors
                  ${isStart || isEnd
                    ? 'bg-brand-primary text-white font-bold'
                    : isBetween
                      ? 'bg-brand-primary/10 text-brand-primary dark:text-blue-300 dark:bg-blue-900/30'
                      : isToday
                        ? 'font-bold text-brand-primary dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const month1 = viewDate.getMonth();
  const year1 = viewDate.getFullYear();
  const month2 = month1 === 11 ? 0 : month1 + 1;
  const year2 = month1 === 11 ? year1 + 1 : year1;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year1, month1 - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year1, month1 + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-6 overflow-x-auto">
        {renderMonth(year1, month1)}
        {renderMonth(year2, month2)}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500">
          {start
            ? end
              ? `${start.toLocaleDateString('pt-BR')} — ${end.toLocaleDateString('pt-BR')}`
              : `${start.toLocaleDateString('pt-BR')} — selecione a data final`
            : 'Selecione a data inicial'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Limpar
          </button>
          <button
            type="button"
            disabled={!start || !end}
            onClick={onApply}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50 transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Attendant Search Select (super_admin only) ──────────────────────────────

interface StaffProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

function AttendantSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('role', ['super_admin', 'admin', 'coordinator', 'teacher', 'user'])
      .order('full_name')
      .then(({ data }) => {
        if (data) setStaff(data as StaffProfile[]);
      });
  }, []);

  const filtered = useMemo(
    () => staff.filter((s) => s.full_name.toLowerCase().includes(search.toLowerCase())),
    [staff, search],
  );

  const selectedName = staff.find((s) => s.id === value)?.full_name;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
      >
        <span className={value ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}>
          {selectedName || 'Todos os atendentes'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-64 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar atendente..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs outline-none focus:border-brand-primary"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
                className={`w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${!value ? 'text-brand-primary font-semibold' : 'text-gray-600 dark:text-gray-300'}`}
              >
                Todos os atendentes
              </button>
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onChange(s.id); setOpen(false); setSearch(''); }}
                  className={`w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${value === s.id ? 'text-brand-primary font-semibold' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  {s.avatar_url ? (
                    <img src={s.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <User className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                  <span className="truncate">{s.full_name}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{s.role}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum resultado</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AttendanceHistoryPage() {
  const { profile } = useAdminAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<AttendanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AttendanceTicket | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customRange, setCustomRange] = useState<[Date | null, Date | null]>([null, null]);
  const [customApplied, setCustomApplied] = useState<[string, string] | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchClient, setSearchClient] = useState('');
  const [searchTicket, setSearchTicket] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [attendantFilter, setAttendantFilter] = useState('');
  const [sectors, setSectors] = useState<Array<{ key: string; label: string }>>([]);

  const isSuperAdmin = profile?.role === 'super_admin';

  // Load sectors
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'visit')
      .eq('key', 'reasons')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && Array.isArray(data.value)) {
          setSectors(
            (data.value as Array<{ key: string; label: string }>).map((s) => ({
              key: s.key,
              label: s.label,
            })),
          );
        }
      });
  }, []);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    let query = supabase
      .from('attendance_tickets')
      .select('*')
      .in('status', ['finished', 'abandoned', 'no_show'])
      .order('issued_at', { ascending: false })
      .limit(200);

    // Escopo: super_admin vê tudo; demais veem apenas seus atendimentos
    if (!isSuperAdmin) {
      query = query.eq('served_by', profile.id);
    }

    // Filtro por atendente (super_admin only)
    if (isSuperAdmin && attendantFilter) {
      query = query.eq('served_by', attendantFilter);
    }

    // Período
    if (dateFilter === 'custom' && customApplied) {
      query = query.gte('issued_at', customApplied[0]).lte('issued_at', customApplied[1]);
    } else {
      const bounds = getDateBounds(dateFilter);
      if (bounds) {
        query = query.gte('issued_at', bounds.start);
      }
    }

    // Busca por cliente
    if (searchClient.trim()) {
      query = query.or(`visitor_name.ilike.%${searchClient.trim()}%,visitor_phone.ilike.%${searchClient.trim()}%`);
    }

    // Busca por senha
    if (searchTicket.trim()) {
      query = query.ilike('ticket_number', `%${searchTicket.trim()}%`);
    }

    // Filtro por setor
    if (sectorFilter) {
      query = query.eq('sector_key', sectorFilter);
    }

    const { data, error } = await query;
    if (!error && data) setTickets(data as AttendanceTicket[]);
    setLoading(false);
  }, [profile, isSuperAdmin, dateFilter, customApplied, searchClient, searchTicket, sectorFilter, attendantFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Permission check
  if (permsLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (!canView('attendance_history')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldX className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Acesso restrito</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">
          Você não tem permissão para acessar o histórico de atendimentos.
          Solicite a um administrador que conceda acesso ao seu perfil.
        </p>
        <button
          onClick={() => navigate('/admin/gestao')}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos Atendimentos
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Titulo/subtitulo vivem na barra de titulo da aba (GestaoPage). */}

      {/* Date filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DATE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setDateFilter(f.key);
              if (f.key === 'custom') {
                setShowCalendar(true);
              } else {
                setShowCalendar(false);
              }
            }}
            className={`
              px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
              ${dateFilter === f.key
                ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-brand-primary/40 hover:text-brand-primary'
              }
            `}
          >
            {f.label}
          </button>
        ))}
        {dateFilter === 'custom' && customApplied && (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 font-medium">
            <Calendar className="w-3 h-3" />
            {new Date(customApplied[0]).toLocaleDateString('pt-BR')} — {new Date(customApplied[1]).toLocaleDateString('pt-BR')}
            <button
              type="button"
              onClick={() => { setCustomApplied(null); setDateFilter('today'); setShowCalendar(false); }}
              className="ml-1 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-800/30"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

      {/* Calendar range picker */}
      {showCalendar && dateFilter === 'custom' && (
        <div className="mb-4">
          <DateRangePicker
            value={customRange}
            onChange={setCustomRange}
            onApply={() => {
              if (customRange[0] && customRange[1]) {
                const startIso = new Date(customRange[0].getFullYear(), customRange[0].getMonth(), customRange[0].getDate()).toISOString();
                const endDate = new Date(customRange[1].getFullYear(), customRange[1].getMonth(), customRange[1].getDate(), 23, 59, 59);
                setCustomApplied([startIso, endDate.toISOString()]);
                setShowCalendar(false);
              }
            }}
            onClear={() => {
              setCustomRange([null, null]);
              setCustomApplied(null);
              setDateFilter('today');
              setShowCalendar(false);
            }}
          />
        </div>
      )}

      {/* Search & filter row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="relative">
          <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={searchClient}
            onChange={(e) => setSearchClient(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>
        <div className="relative">
          <Ticket className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por senha..."
            value={searchTicket}
            onChange={(e) => setSearchTicket(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>
        <div className="relative">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 appearance-none pr-9"
          >
            <option value="">Todos os setores</option>
            {sectors.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {isSuperAdmin && (
          <AttendantSelect value={attendantFilter} onChange={setAttendantFilter} />
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-gray-400 mb-3">
          {tickets.length} {tickets.length === 1 ? 'registro encontrado' : 'registros encontrados'}
        </p>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhum atendimento encontrado</p>
          <p className="text-xs text-gray-400 mt-1">
            Ajuste os filtros ou selecione outro período.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
          {/* Table header */}
          <div className="hidden lg:grid lg:grid-cols-[100px_1fr_1fr_120px_110px_140px_140px_90px_80px] gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400">
            <span>Senha</span>
            <span>Cliente</span>
            <span>Setor</span>
            <span>Tipo</span>
            <span>Status</span>
            <span>Entrada</span>
            <span>Encerramento</span>
            <span>Duração</span>
            <span>Transfer.</span>
          </div>

          {/* Table rows */}
          {tickets.map((t) => {
            const status = STATUS_CONFIG[t.status];
            return (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                className="grid grid-cols-1 lg:grid-cols-[100px_1fr_1fr_120px_110px_140px_140px_90px_80px] gap-2 px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors items-center"
              >
                {/* Senha */}
                <span className="font-display text-sm font-bold text-brand-primary dark:text-white">
                  {t.ticket_number}
                </span>

                {/* Cliente */}
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-100 truncate">{t.visitor_name}</p>
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {formatPhone(t.visitor_phone)}
                  </p>
                </div>

                {/* Setor */}
                <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5 truncate">
                  <LayoutGrid className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  {t.sector_label}
                </p>

                {/* Tipo */}
                <span>
                  {t.priority_group === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                      <ArrowRightLeft className="w-3 h-3" />
                      Transferido
                    </span>
                  ) : t.priority_group === 1 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Calendar className="w-3 h-3" />
                      Agendado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
                      <Footprints className="w-3 h-3" />
                      Walk-in
                    </span>
                  )}
                </span>

                {/* Status */}
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-lg w-fit ${status.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>

                {/* Entrada */}
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {formatDateTime(t.issued_at)}
                </span>

                {/* Encerramento */}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(t.finished_at)}
                </span>

                {/* Duração */}
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {secondsToLabel(t.service_seconds)}
                </span>

                {/* Transferido */}
                {t.transferred_from_sector_label ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400" title={`De: ${t.transferred_from_sector_label}`}>
                    <ArrowRightLeft className="w-3 h-3" />
                    Sim
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Details drawer */}
      <AttendanceDetailsDrawer ticket={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
