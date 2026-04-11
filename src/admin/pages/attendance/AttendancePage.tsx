import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useRealtimeRows } from '../../hooks/useRealtimeRows';
import type { AttendanceTicket, AttendanceTicketStatus, AttendancePriorityQueueConfig, AttendanceTransferConfig } from '../../types/admin.types';
import {
  Ticket,
  Search,
  Loader2,
  Phone,
  User,
  Clock,
  PhoneCall,
  PlayCircle,
  CheckCircle2,
  Ban,
  Hourglass,
  LayoutGrid,
  RefreshCw,
  Calendar,
  Footprints,
  ArrowRightLeft,
  X,
  ChevronDown,
} from 'lucide-react';
import AttendanceDetailsDrawer from './AttendanceDetailsDrawer';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  AttendanceTicketStatus,
  { label: string; color: string; dot: string }
> = {
  waiting:    { label: 'Aguardando',  color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',       dot: 'bg-amber-400'   },
  called:     { label: 'Chamado',     color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',           dot: 'bg-blue-500'    },
  in_service: { label: 'Em atendimento', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500'  },
  finished:   { label: 'Finalizado',  color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  abandoned:  { label: 'Abandonado',  color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',              dot: 'bg-gray-400'    },
  no_show:    { label: 'Não veio',    color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',               dot: 'bg-red-400'     },
};

const ACTIVE_STATUSES: AttendanceTicketStatus[] = ['waiting', 'called', 'in_service'];

function formatTime(iso: string | null): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatPhone(p: string): string {
  const n = p.replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return p;
}

function secondsToLabel(total: number): string {
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem.toString().padStart(2, '0')}m`;
}

// Live ticking clock used by the wait timer in each card
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ── Ticket card ──────────────────────────────────────────────────────────────
interface TicketCardProps {
  ticket: AttendanceTicket;
  now: number;
  onCall: (t: AttendanceTicket) => void;
  onStart: (t: AttendanceTicket) => void;
  onFinish: (t: AttendanceTicket) => void;
  onAbandon: (t: AttendanceTicket) => void;
  onTransfer?: (t: AttendanceTicket) => void;
  onOpen: (t: AttendanceTicket) => void;
  busy: boolean;
  showTypeIndicator?: boolean;
  transferEnabled?: boolean;
}

function TicketCard({ ticket, now, onCall, onStart, onFinish, onAbandon, onTransfer, onOpen, busy, showTypeIndicator, transferEnabled }: TicketCardProps) {
  const status = STATUS_CONFIG[ticket.status];

  // Live wait / service timer
  let timerLabel: string | null = null;
  if (ticket.status === 'waiting') {
    const secs = Math.max(0, Math.floor((now - new Date(ticket.issued_at).getTime()) / 1000));
    timerLabel = `Aguardando há ${secondsToLabel(secs)}`;
  } else if (ticket.status === 'called' && ticket.called_at) {
    const secs = Math.max(0, Math.floor((now - new Date(ticket.called_at).getTime()) / 1000));
    timerLabel = `Chamado há ${secondsToLabel(secs)}`;
  } else if (ticket.status === 'in_service' && ticket.service_started_at) {
    const secs = Math.max(0, Math.floor((now - new Date(ticket.service_started_at).getTime()) / 1000));
    timerLabel = `Em atendimento há ${secondsToLabel(secs)}`;
  }

  return (
    <div
      className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpen(ticket)}
    >
      {/* Header: ticket number + status */}
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400">Senha</p>
          <p className="font-display text-3xl font-bold text-[#003876] dark:text-white leading-none mt-1">
            {ticket.ticket_number}
          </p>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-lg flex items-center gap-1.5 ${status.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Body: visitor + sector */}
      <div className="px-4 pt-3 pb-3 space-y-1.5">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5 truncate">
          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {ticket.visitor_name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Phone className="w-3 h-3 flex-shrink-0" />
          {formatPhone(ticket.visitor_phone)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <LayoutGrid className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{ticket.sector_label}</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Clock className="w-3 h-3 flex-shrink-0" />
          Emitido às {formatTime(ticket.issued_at)}
        </p>
        {ticket.priority_group === 0 && ticket.transferred_from_sector_label && (
          <p className="text-[11px] font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3 h-3 flex-shrink-0" />
            Transferido de {ticket.transferred_from_sector_label}
          </p>
        )}
        {showTypeIndicator && ticket.priority_group !== 0 && (
          ticket.priority_group === 1 ? (
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              Agendado às {ticket.scheduled_time?.slice(0, 5) || '--:--'}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <Footprints className="w-3 h-3 flex-shrink-0" />
              Chegou às {formatTime(ticket.issued_at)}
            </p>
          )
        )}
        {timerLabel && (
          <p className="text-[11px] font-medium text-[#003876] dark:text-blue-300 flex items-center gap-1.5 pt-1">
            <Hourglass className="w-3 h-3 flex-shrink-0" />
            {timerLabel}
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2.5 bg-gray-50/70 dark:bg-gray-900/40 flex items-center gap-2">
        {ticket.status === 'waiting' && (
          <>
            <button
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); onCall(ticket); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#003876] text-white text-xs font-semibold hover:bg-[#002255] disabled:opacity-50 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Chamar
            </button>
            <button
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); onAbandon(ticket); }}
              title="Marcar como abandonado"
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {ticket.status === 'called' && (
          <>
            <button
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); onStart(ticket); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Aceitar
            </button>
            {transferEnabled && onTransfer && (
              <button
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); onTransfer(ticket); }}
                title="Transferir para outro setor"
                className="p-2 rounded-lg border border-purple-200 dark:border-purple-700 text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); onCall(ticket); }}
              title="Chamar novamente"
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-[#003876] hover:border-[#003876]/40 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {ticket.status === 'in_service' && (
          <>
            <button
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); onFinish(ticket); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Finalizar
            </button>
            {transferEnabled && onTransfer && (
              <button
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); onTransfer(ticket); }}
                title="Transferir para outro setor"
                className="p-2 rounded-lg border border-purple-200 dark:border-purple-700 text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────
interface ColumnProps {
  title: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  tickets: AttendanceTicket[];
  children: React.ReactNode;
}

function Column({ title, accent, icon: Icon, tickets, children }: ColumnProps) {
  return (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
          <span className="text-xs font-medium text-gray-400">{tickets.length}</span>
        </div>
      </div>
      <div className="space-y-3">
        {children}
        {tickets.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-2xl">
            Nenhuma senha
          </p>
        )}
      </div>
    </div>
  );
}

// ── Transfer Modal ──────────────────────────────────────────────────────────

interface TransferModalProps {
  ticket: AttendanceTicket;
  sectors: Array<{ key: string; label: string }>;
  quickReasons: string[];
  onConfirm: (sectorKey: string, sectorLabel: string, reason: string) => void;
  onClose: () => void;
  busy: boolean;
}

function TransferModal({ ticket, sectors, quickReasons, onConfirm, onClose, busy }: TransferModalProps) {
  const [sectorKey, setSectorKey] = useState('');
  const [reason, setReason] = useState('');

  const available = sectors.filter((s) => s.key !== ticket.sector_key);
  const selectedLabel = available.find((s) => s.key === sectorKey)?.label || '';
  const canConfirm = sectorKey !== '' && reason.trim() !== '';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[61] p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-800 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <ArrowRightLeft className="w-4 h-4" />
              <span className="font-semibold text-sm">Transferir Senha {ticket.ticket_number}</span>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/20 p-1 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Current sector */}
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <LayoutGrid className="w-3.5 h-3.5" />
              Setor atual: <span className="font-medium text-gray-700 dark:text-gray-200">{ticket.sector_label}</span>
            </div>

            {/* Destination sector */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Setor destino
              </label>
              <div className="relative">
                <select
                  value={sectorKey}
                  onChange={(e) => setSectorKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-purple-500 appearance-none pr-9"
                >
                  <option value="">Selecione o setor...</option>
                  {available.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Quick reasons */}
            {quickReasons.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Justificativas rápidas
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {quickReasons.filter(Boolean).map((qr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReason((prev) => prev ? `${prev}. ${qr}` : qr)}
                      className="px-2.5 py-1.5 text-[11px] rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Free-text reason */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Justificativa
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo da transferência..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canConfirm || busy}
                onClick={() => onConfirm(sectorKey, selectedLabel, reason.trim())}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
const DEFAULT_PRIORITY_CFG: AttendancePriorityQueueConfig = {
  enabled: false,
  window_minutes_before: 30,
  window_minutes_after: 30,
  show_type_indicator: true,
};

const DEFAULT_TRANSFER_CFG: AttendanceTransferConfig = {
  enabled: true,
  quick_reasons: [],
};

export default function AttendancePage() {
  const { profile } = useAdminAuth();
  const [tickets, setTickets] = useState<AttendanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AttendanceTicket | null>(null);
  const [priorityCfg, setPriorityCfg] = useState<AttendancePriorityQueueConfig>(DEFAULT_PRIORITY_CFG);
  const [sectorMode, setSectorMode] = useState<'all' | 'restricted'>('all');
  const [transferCfg, setTransferCfg] = useState<AttendanceTransferConfig>(DEFAULT_TRANSFER_CFG);
  const [allSectors, setAllSectors] = useState<Array<{ key: string; label: string }>>([]);
  const [transferTarget, setTransferTarget] = useState<AttendanceTicket | null>(null);
  const now = useNow(1000);

  // Load priority queue + sector visibility settings
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'attendance')
      .in('key', ['priority_queue', 'sector_visibility_mode', 'transfer'])
      .then(({ data }) => {
        (data || []).forEach((row) => {
          const r = row as { key: string; value: unknown };
          if (r.key === 'priority_queue' && r.value) {
            setPriorityCfg({ ...DEFAULT_PRIORITY_CFG, ...(r.value as object) });
          }
          if (r.key === 'sector_visibility_mode') {
            const parsed = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
            setSectorMode(parsed === 'restricted' ? 'restricted' : 'all');
          }
          if (r.key === 'transfer' && r.value) {
            setTransferCfg({ ...DEFAULT_TRANSFER_CFG, ...(r.value as object) });
          }
        });
      });
  }, []);

  // Load all sectors from visit reasons setting
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'visit')
      .eq('key', 'reasons')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && Array.isArray(data.value)) {
          setAllSectors(
            (data.value as Array<{ key: string; label: string }>).map((s) => ({
              key: s.key,
              label: s.label,
            })),
          );
        }
      });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance_tickets')
      .select('*')
      .order('issued_at', { ascending: true });
    if (!error && data) setTickets(data as AttendanceTicket[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRealtimeRows<AttendanceTicket>({
    table: 'attendance_tickets',
    setRows: setTickets,
    onSelectedPatch: (row) => {
      setSelected((prev) => (prev?.id === row.id ? { ...prev, ...row } : prev));
    },
  });

  // null = see all; string[] = restricted to these keys
  const effectiveSectors = useMemo<string[] | null>(() => {
    if (profile?.role === 'super_admin') return null;
    if (sectorMode === 'all') return null;
    return (profile as { sector_keys?: string[] } | null)?.sector_keys ?? [];
  }, [profile, sectorMode]);

  const sectors = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((t) => { if (!map.has(t.sector_key)) map.set(t.sector_key, t.sector_label); });
    const all = Array.from(map.entries());
    if (effectiveSectors === null) return all;
    return all.filter(([key]) => effectiveSectors.includes(key));
  }, [tickets, effectiveSectors]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      // Sector restriction from user profile
      if (effectiveSectors !== null && !effectiveSectors.includes(t.sector_key)) return false;
      const matchSearch =
        search === '' ||
        t.visitor_name.toLowerCase().includes(search.toLowerCase()) ||
        t.visitor_phone.includes(search) ||
        t.ticket_number.toLowerCase().includes(search.toLowerCase());
      const matchSector = sectorFilter === 'all' || t.sector_key === sectorFilter;
      return matchSearch && matchSector;
    });
  }, [tickets, search, sectorFilter, effectiveSectors]);

  const waitingTickets = useMemo(() => filtered.filter((t) => t.status === 'waiting').sort((a, b) => {
    if (a.priority_group !== b.priority_group) return a.priority_group - b.priority_group;
    if (a.priority_group === 1)
      return (a.scheduled_time || '').localeCompare(b.scheduled_time || '') || a.issued_at.localeCompare(b.issued_at);
    return a.issued_at.localeCompare(b.issued_at);
  }), [filtered]);
  const calledTickets     = useMemo(() => filtered.filter((t) => t.status === 'called').sort((a, b) => (a.called_at || '').localeCompare(b.called_at || '')), [filtered]);
  const inServiceTickets  = useMemo(() => filtered.filter((t) => t.status === 'in_service').sort((a, b) => (a.service_started_at || '').localeCompare(b.service_started_at || '')), [filtered]);

  const counts = useMemo(() => {
    const visible = effectiveSectors === null
      ? tickets
      : tickets.filter((t) => effectiveSectors.includes(t.sector_key));
    const c: Record<AttendanceTicketStatus | 'active' | 'total', number> = {
      waiting: 0, called: 0, in_service: 0, finished: 0, abandoned: 0, no_show: 0, active: 0, total: visible.length,
    };
    visible.forEach((t) => { c[t.status]++; });
    c.active = c.waiting + c.called + c.in_service;
    return c;
  }, [tickets, effectiveSectors]);

  async function patchTicket(id: string, patch: Record<string, unknown>): Promise<boolean> {
    setBusyId(id);
    const { error } = await supabase.from('attendance_tickets').update(patch).eq('id', id);
    setBusyId(null);
    if (error) {
      console.error('Failed to update ticket', error);
      alert('Erro ao atualizar a senha: ' + error.message);
      return false;
    }
    return true;
  }

  const handleCall = (t: AttendanceTicket) => {
    patchTicket(t.id, {
      status: 'called',
      called_at: new Date().toISOString(),
      called_by: profile?.id || null,
    });
  };

  const handleStart = (t: AttendanceTicket) => {
    patchTicket(t.id, {
      status: 'in_service',
      service_started_at: new Date().toISOString(),
      served_by: profile?.id || null,
    });
  };

  const handleFinish = (t: AttendanceTicket) => {
    patchTicket(t.id, {
      status: 'finished',
      finished_at: new Date().toISOString(),
    });
  };

  const handleAbandon = (t: AttendanceTicket) => {
    if (!confirm(`Marcar a senha ${t.ticket_number} como abandonada?`)) return;
    patchTicket(t.id, {
      status: 'abandoned',
      finished_at: new Date().toISOString(),
    });
  };

  const handleTransfer = async (sectorKey: string, sectorLabel: string, reason: string) => {
    if (!transferTarget || !profile) return;
    setBusyId(transferTarget.id);

    const nowIso = new Date().toISOString();

    // 1. Update ticket: move to new sector, reset to waiting at top of queue
    const { error: updateErr } = await supabase
      .from('attendance_tickets')
      .update({
        sector_key: sectorKey,
        sector_label: sectorLabel,
        status: 'waiting',
        priority_group: 0,
        called_at: null,
        called_by: null,
        service_started_at: null,
        served_by: null,
        transferred_from_sector_key: transferTarget.sector_key,
        transferred_from_sector_label: transferTarget.sector_label,
        transfer_reason: reason,
        transferred_at: nowIso,
        transferred_by: profile.id,
      })
      .eq('id', transferTarget.id);

    if (updateErr) {
      console.error('Transfer update failed', updateErr);
      alert('Erro ao transferir: ' + updateErr.message);
      setBusyId(null);
      return;
    }

    // 2. Insert transfer history
    await supabase.from('attendance_transfer_history').insert({
      ticket_id: transferTarget.id,
      from_sector_key: transferTarget.sector_key,
      from_sector_label: transferTarget.sector_label,
      to_sector_key: sectorKey,
      to_sector_label: sectorLabel,
      reason,
      transferred_by: profile.id,
    });

    // 3. Audit log
    await supabase.rpc('log_audit', {
      p_action: 'transfer',
      p_module: 'attendance',
      p_details: {
        ticket_id: transferTarget.id,
        ticket_number: transferTarget.ticket_number,
        from_sector: transferTarget.sector_label,
        to_sector: sectorLabel,
        reason,
      },
    });

    setBusyId(null);
    setTransferTarget(null);
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <Ticket className="w-8 h-8" />
            Atendimentos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Fila em tempo real das senhas emitidas pela recepção.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* KPI chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400">Ativas</p>
          <p className="font-display text-2xl font-bold text-[#003876] dark:text-white mt-1">{counts.active}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400">Aguardando</p>
          <p className="font-display text-2xl font-bold text-amber-600 mt-1">{counts.waiting}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400">Chamadas</p>
          <p className="font-display text-2xl font-bold text-blue-600 mt-1">{counts.called}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-4 py-3">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400">Em atendimento</p>
          <p className="font-display text-2xl font-bold text-indigo-600 mt-1">{counts.in_service}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por senha, nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#003876]/30"
          />
        </div>
        {sectors.length > 0 && (
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#003876]/30"
          >
            <option value="all">Todos os setores</option>
            {sectors.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Board */}
      {effectiveSectors !== null && effectiveSectors.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 py-16 text-center">
          <User className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Nenhum setor atribuído ao seu perfil</p>
          <p className="text-xs text-amber-500 dark:text-amber-500 mt-1">
            Solicite a um administrador que vincule setores de atendimento ao seu usuário.
          </p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#003876]" />
        </div>
      ) : filtered.filter((t) => ACTIVE_STATUSES.includes(t.status)).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
          <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhuma senha ativa</p>
          <p className="text-xs text-gray-400 mt-1">
            As senhas emitidas via página pública aparecerão aqui em tempo real.
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5">
          <Column title="Aguardando" accent="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" icon={Hourglass} tickets={waitingTickets}>
            {waitingTickets.length > 0 && (
              <button
                disabled={busyId !== null}
                onClick={() => handleCall(waitingTickets[0])}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#003876] text-white text-xs font-semibold hover:bg-[#002255] disabled:opacity-50 transition-colors mb-1"
              >
                <PhoneCall className="w-4 h-4" />
                Chamar Próximo — {waitingTickets[0].ticket_number}
              </button>
            )}
            {waitingTickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                now={now}
                busy={busyId === t.id}
                onCall={handleCall}
                onStart={handleStart}
                onFinish={handleFinish}
                onAbandon={handleAbandon}
                onTransfer={setTransferTarget}
                onOpen={setSelected}
                showTypeIndicator={priorityCfg.enabled && priorityCfg.show_type_indicator}
                transferEnabled={transferCfg.enabled}
              />
            ))}
          </Column>
          <Column title="Chamados" accent="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" icon={PhoneCall} tickets={calledTickets}>
            {calledTickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                now={now}
                busy={busyId === t.id}
                onCall={handleCall}
                onStart={handleStart}
                onFinish={handleFinish}
                onAbandon={handleAbandon}
                onTransfer={setTransferTarget}
                onOpen={setSelected}
                transferEnabled={transferCfg.enabled}
              />
            ))}
          </Column>
          <Column title="Em atendimento" accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300" icon={PlayCircle} tickets={inServiceTickets}>
            {inServiceTickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                now={now}
                busy={busyId === t.id}
                onCall={handleCall}
                onStart={handleStart}
                onFinish={handleFinish}
                onAbandon={handleAbandon}
                onTransfer={setTransferTarget}
                onOpen={setSelected}
                transferEnabled={transferCfg.enabled}
              />
            ))}
          </Column>
        </div>
      )}

      {/* Transfer modal */}
      {transferTarget && (
        <TransferModal
          ticket={transferTarget}
          sectors={allSectors}
          quickReasons={transferCfg.quick_reasons}
          onConfirm={handleTransfer}
          onClose={() => setTransferTarget(null)}
          busy={busyId === transferTarget.id}
        />
      )}

      {/* Details drawer */}
      <AttendanceDetailsDrawer ticket={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
