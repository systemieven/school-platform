import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { callProxy } from '../../lib/whatsapp-api';
import type { WhatsAppMessageLog, MessageLogStatus } from '../../types/admin.types';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Send, CheckCheck, Clock, XCircle, Eye, RotateCcw,
  Loader2, Phone, Calendar, ChevronDown, X, RefreshCw,
  MessageSquare, MessageCircle, TrendingUp, Sun, CalendarRange, CalendarDays, SlidersHorizontal, User,
} from 'lucide-react';

// ── Sensitive variable masking ────────────────────────────────────────────────

/** Variable names whose values must never be rendered in plain text. */
const SENSITIVE_VARIABLES = ['temp_password', 'password', 'token', 'secret'];

/**
 * Returns a display-safe version of `body` where the values of any
 * sensitive variables (found in `variablesUsed`) are replaced with ••••••••.
 * The original stored content is never modified.
 */
function maskBody(
  body: string,
  variablesUsed: Record<string, string> | null | undefined,
): string {
  if (!variablesUsed) return body;
  let masked = body;
  for (const varName of SENSITIVE_VARIABLES) {
    const value = variablesUsed[varName];
    if (value && value.length > 0) {
      // split/join avoids regex escaping issues with special chars in passwords
      masked = masked.split(value).join('••••••••');
    }
  }
  return masked;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13) return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
  return phone;
}

// ── Date filter helpers ───────────────────────────────────────────────────────

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

function getDateRange(
  filter: DateFilter,
  customStart: string,
  customEnd: string,
): { from?: string; to?: string } {
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (filter === 'week') {
    const day   = now.getDay();
    const diff  = day === 0 ? -6 : 1 - day; // Monday as start
    const start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0, 0, 0, 0);
    return { from: start.toISOString() };
  }
  if (filter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString() };
  }
  if (filter === 'custom' && customStart) {
    const from = new Date(customStart + 'T00:00:00').toISOString();
    const to   = customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : undefined;
    return { from, to };
  }
  return {};
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MessageLogStatus, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  queued:    { label: 'Na fila',    color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',          icon: Clock       },
  sent:      { label: 'Enviado',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: Send        },
  delivered: { label: 'Entregue',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCheck },
  read:      { label: 'Lido',       color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Eye        },
  failed:    { label: 'Falhou',     color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: XCircle    },
};

const MODULE_LABELS: Record<string, string> = {
  agendamento: 'Agendamento',
  matricula:   'Pré-Matrícula',
  contato:     'Contato',
};

// ── Date filter config ────────────────────────────────────────────────────────

const DATE_FILTERS: { key: DateFilter; label: string; icon: React.ComponentType<{className?: string}> }[] = [
  { key: 'today',  label: 'No dia',     icon: Sun              },
  { key: 'week',   label: 'Na semana',  icon: CalendarRange    },
  { key: 'month',  label: 'No mês',     icon: CalendarDays     },
  { key: 'custom', label: 'Personalizado', icon: SlidersHorizontal },
];

// ── Detail Drawer ─────────────────────────────────────────────────────────────

// ── MessageTimeline ───────────────────────────────────────────────────────────

const TIMELINE_STEPS: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dateKey: 'created_at' | 'sent_at' | 'delivered_at' | 'read_at';
}[] = [
  { label: 'Criado',   icon: Clock,      dateKey: 'created_at'   },
  { label: 'Enviado',  icon: Send,       dateKey: 'sent_at'      },
  { label: 'Entregue', icon: CheckCheck, dateKey: 'delivered_at' },
  { label: 'Lido',     icon: Eye,        dateKey: 'read_at'      },
];

function MessageTimeline({ log }: { log: WhatsAppMessageLog }) {
  return (
    <div className="py-1">
      {TIMELINE_STEPS.map(({ label, icon: StepIcon, dateKey }, idx, arr) => {
        const date    = log[dateKey] as string | null;
        const active  = dateKey === 'created_at' || date != null;
        const isLast  = idx === arr.length - 1;
        const nextKey = arr[idx + 1]?.dateKey;
        const lineOn  = !isLast && (nextKey === 'created_at' || (log[nextKey!] as string | null) != null);

        return (
          <div key={label} className="flex gap-4">
            {/* Dot + vertical line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                active
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}>
                <StepIcon className={`w-3.5 h-3.5 ${active ? 'text-green-500 dark:text-green-400' : 'text-gray-300 dark:text-gray-600'}`} />
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 my-1 rounded-full min-h-[20px] transition-colors ${
                  lineOn ? 'bg-green-300 dark:bg-green-700/50' : 'bg-gray-100 dark:bg-gray-800'
                }`} />
              )}
            </div>

            {/* Label + date */}
            <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-3'} pt-1`}>
              <p className={`text-sm font-semibold leading-none ${
                active ? 'text-gray-800 dark:text-white' : 'text-gray-300 dark:text-gray-600'
              }`}>
                {label}
              </p>
              <p className={`text-[11px] mt-1.5 ${
                active && date ? 'text-gray-400' : 'text-gray-200 dark:text-gray-700'
              }`}>
                {date ? formatDate(date) : '—'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── DetailDrawer ──────────────────────────────────────────────────────────────

function DetailDrawer({ log, onClose, onRetry }: {
  log: WhatsAppMessageLog;
  onClose: () => void;
  onRetry: (log: WhatsAppMessageLog) => void;
}) {
  const cfg = STATUS_CONFIG[log.status];
  const StatusIcon = cfg.icon;

  const footer = log.status === 'failed' ? (
    <button
      onClick={() => onRetry(log)}
      className="w-full inline-flex items-center justify-center gap-2 bg-[#003876] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#002855] transition-colors"
    >
      <RotateCcw className="w-4 h-4" />
      Tentar novamente
    </button>
  ) : undefined;

  return (
    <Drawer
      open
      onClose={onClose}
      title="Detalhes da mensagem"
      icon={MessageCircle}
      footer={footer}
    >
      {/* Status da mensagem */}
      <DrawerCard title="Status da mensagem" icon={StatusIcon}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${cfg.color}`}>
          <StatusIcon className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{cfg.label}</p>
        </div>
      </DrawerCard>

      {/* Contato */}
      <DrawerCard title="Contato" icon={User}>
        {/* Nome */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 bg-[#003876]/10 dark:bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Contato</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white mt-0.5">
              {log.recipient_name || 'Não identificado'}
            </p>
          </div>
        </div>
        {/* Telefone */}
        <div className="flex items-center gap-3">
          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Telefone</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatPhone(log.recipient_phone)}</p>
          </div>
        </div>
      </DrawerCard>

      {/* Origem */}
      {log.related_module && (
        <DrawerCard title="Origem" icon={MessageSquare}>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Módulo</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {MODULE_LABELS[log.related_module] || log.related_module}
              </p>
            </div>
          </div>
        </DrawerCard>
      )}

      {/* Mensagem */}
      <DrawerCard title="Mensagem" icon={MessageCircle}>
        {log.template && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>Template: <strong className="text-gray-700 dark:text-gray-300">{log.template.name}</strong></span>
          </div>
        )}
        {/* Bolha WhatsApp */}
        <div className="bg-[#dcf8c6] dark:bg-green-900/20 rounded-xl p-3">
          <p className="text-sm text-gray-800 dark:text-green-100 whitespace-pre-wrap leading-relaxed">
            {maskBody(log.rendered_content.body || '', log.variables_used) || '(sem conteúdo)'}
          </p>
          <p className="text-[10px] text-right text-gray-400 dark:text-green-400/60 mt-2">
            {formatDate(log.sent_at || log.created_at)}
          </p>
        </div>
      </DrawerCard>

      {/* Timeline visual */}
      <DrawerCard title="Timeline" icon={Calendar} bodyClassName="bg-white dark:bg-gray-900 px-4 py-4">
        <MessageTimeline log={log} />
      </DrawerCard>

      {/* Erro */}
      {log.error_message && (
        <div className="rounded-2xl overflow-hidden border border-red-200 dark:border-red-800/50">
          <div className="bg-red-100 dark:bg-red-900/30 px-4 py-2.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-red-400">Erro</span>
          </div>
          <div className="bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-xs text-red-500 dark:text-red-400 font-mono break-all">{log.error_message}</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

interface StatsData {
  sentCount:      number;
  deliveredCount: number;
  readCount:      number;
  failedCount:    number;
}

export default function MessageLogPage({ embedded }: { embedded?: boolean } = {}) {
  const [logs, setLogs]         = useState<WhatsAppMessageLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<WhatsAppMessageLog | null>(null);
  const [filterStatus, setFilterStatus] = useState<MessageLogStatus | 'all'>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterDate,   setFilterDate]   = useState<DateFilter>('all');
  const [customStart,  setCustomStart]  = useState('');
  const [customEnd,    setCustomEnd]    = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [total, setTotal]       = useState(0);
  // Stats are computed from a separate query that ignores filterStatus,
  // so the cards always reflect the full picture for the date/module selection.
  const [stats, setStats] = useState<StatsData>({ sentCount: 0, deliveredCount: 0, readCount: 0, failedCount: 0 });

  const load = useCallback(async () => {
    setLoading(true);

    const { from, to } = getDateRange(filterDate, customStart, customEnd);

    // ── Table query (all filters including status) ──────────────────────────
    let query = supabase
      .from('whatsapp_message_log')
      .select('*, template:template_id(name, category), sent_by_profile:sent_by(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    // For delivered/read use timestamp columns so that e.g. a "read" message
    // still appears when filtering by "Entregues" (it was delivered too).
    if (filterStatus === 'delivered') {
      query = query.not('delivered_at', 'is', null);
    } else if (filterStatus === 'read') {
      query = query.not('read_at', 'is', null);
    } else if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }
    if (filterModule !== 'all') query = query.eq('related_module', filterModule);
    if (from) query = query.gte('created_at', from);
    if (to)   query = query.lte('created_at', to);

    // ── Stats query (date + module only — ignores status filter) ────────────
    let statsQuery = supabase
      .from('whatsapp_message_log')
      .select('status, sent_at, delivered_at, read_at');

    if (filterModule !== 'all') statsQuery = statsQuery.eq('related_module', filterModule);
    if (from) statsQuery = statsQuery.gte('created_at', from);
    if (to)   statsQuery = statsQuery.lte('created_at', to);

    const [{ data, count }, { data: statsRaw }] = await Promise.all([query, statsQuery]);

    setLogs((data as WhatsAppMessageLog[]) || []);
    setTotal(count || 0);

    type StatRow = { status: string; sent_at: string | null; delivered_at: string | null; read_at: string | null };
    const sr = (statsRaw || []) as StatRow[];
    setStats({
      sentCount:      sr.filter((l) => l.sent_at      != null).length,
      deliveredCount: sr.filter((l) => l.delivered_at != null).length,
      readCount:      sr.filter((l) => l.read_at      != null).length,
      failedCount:    sr.filter((l) => l.status === 'failed').length,
    });

    setLoading(false);
  }, [filterStatus, filterModule, filterDate, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  const handleRetry = async (log: WhatsAppMessageLog) => {
    setRetrying(log.id);
    try {
      await callProxy('/send/text', 'POST', {
        number: log.recipient_phone,
        text: log.rendered_content.body || '',
      });
      await supabase.from('whatsapp_message_log').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      }).eq('id', log.id);
      await load();
      setSelected(null);
    } catch (err) {
      console.error(err);
    }
    setRetrying(null);
  };

  const { sentCount, deliveredCount, readCount, failedCount } = stats;

  return (
    <div>
      {/* Header */}
      {!embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
              <Send className="w-8 h-8" />
              Histórico de Mensagens
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {total} mensagen{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs text-gray-400">
            {total} mensagen{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}
          </p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
      )}

      {/* ── Date filters ─────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {DATE_FILTERS.map(({ key, label, icon: Icon }) => {
            const active = filterDate === key;
            return (
              <button
                key={key}
                onClick={() => setFilterDate(active && key !== 'custom' ? 'all' : key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-[#003876] text-white shadow-sm shadow-[#003876]/20 dark:bg-[#ffd700] dark:text-[#003876]'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:border-[#ffd700] dark:hover:text-[#ffd700]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Custom date range picker */}
        {filterDate === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">De</span>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-sm text-gray-700 dark:text-gray-300 bg-transparent outline-none cursor-pointer"
              />
            </div>
            <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Até</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-sm text-gray-700 dark:text-gray-300 bg-transparent outline-none cursor-pointer"
              />
            </div>
            {(customStart || customEnd) && (
              <button
                onClick={() => { setCustomStart(''); setCustomEnd(''); }}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Enviados',    count: sentCount,      color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20',          icon: Send       },
          { label: 'Entregues',   count: deliveredCount, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCheck },
          { label: 'Lidos',       count: readCount,      color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20',     icon: Eye        },
          { label: 'Com falha',   count: failedCount,    color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20',            icon: XCircle    },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-4`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${stat.color}`} />
                <span className={`text-xs font-medium ${stat.color}`}>{stat.label}</span>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
            </div>
          );
        })}
      </div>

      {/* Delivery rate */}
      {sentCount > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 mb-6 flex items-center gap-4">
          <TrendingUp className="w-5 h-5 text-[#003876] dark:text-[#ffd700]" />
          <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Taxa de entrega</p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((deliveredCount / sentCount) * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
            {Math.round((deliveredCount / sentCount) * 100)}%
          </span>
        </div>
      )}

      {/* Status + module filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1">
          {([['all','Todos'], ['queued','Na fila'], ['sent','Enviados'], ['delivered','Entregues'], ['read','Lidos'], ['failed','Falharam']] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                filterStatus === v
                  ? 'bg-[#003876] text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="relative">
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 text-xs rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 outline-none"
          >
            <option value="all">Todos os módulos</option>
            <option value="agendamento">Agendamento</option>
            <option value="matricula">Pré-Matrícula</option>
            <option value="contato">Contato</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <Send className="w-10 h-10 text-gray-300 dark:text-gray-500" />
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhuma mensagem encontrada.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Destinatário</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Mensagem</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Módulo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden lg:table-cell">Enviado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => {
                  const cfg = STATUS_CONFIG[log.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelected(log)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white text-sm">
                            {log.recipient_name || '—'}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {formatPhone(log.recipient_phone)}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate font-mono">
                          {maskBody(log.rendered_content.body || '', log.variables_used) || '—'}
                        </p>
                        {log.template && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Template: {log.template.name}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        {log.error_message && (
                          <p className="text-[10px] text-red-400 mt-0.5 max-w-[140px] truncate">
                            {log.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {log.related_module ? MODULE_LABELS[log.related_module] || log.related_module : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {timeAgo(log.created_at)}
                        </span>
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        {log.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(log)}
                            disabled={retrying === log.id}
                            className="inline-flex items-center gap-1 text-xs text-[#003876] dark:text-[#ffd700] hover:opacity-80 disabled:opacity-50 transition-opacity"
                            title="Tentar novamente"
                          >
                            {retrying === log.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <RotateCcw className="w-3.5 h-3.5" />
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          log={selected}
          onClose={() => setSelected(null)}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
