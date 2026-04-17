import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import AttendanceQuickActions from './AttendanceQuickActions';
import type {
  AttendanceTicket,
  AttendanceTicketStatus,
  AttendanceFeedback,
  AttendanceTransferHistoryEntry,
  AttendanceQuestion,
  AttendanceAnswerValue,
} from '../../types/admin.types';
import {
  Ticket,
  Clock,
  Hourglass,
  User,
  Phone,
  Mail,
  MapPin,
  Star,
  ChevronRight,
  Loader2,
  LayoutGrid,
  History,
  ArrowRightLeft,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

const STATUS_CONFIG: Record<AttendanceTicketStatus, { label: string; color: string; dot: string }> = {
  waiting:    { label: 'Aguardando',      color: 'bg-amber-500/20 text-amber-100',   dot: 'bg-amber-400'   },
  called:     { label: 'Chamado',         color: 'bg-blue-500/20 text-blue-100',     dot: 'bg-blue-400'    },
  in_service: { label: 'Em atendimento',  color: 'bg-indigo-500/20 text-indigo-100', dot: 'bg-indigo-400'  },
  finished:   { label: 'Finalizado',      color: 'bg-emerald-500/20 text-emerald-100', dot: 'bg-emerald-400' },
  abandoned:  { label: 'Abandonado',      color: 'bg-gray-500/20 text-gray-200',     dot: 'bg-gray-400'    },
  no_show:    { label: 'Não veio',        color: 'bg-red-500/20 text-red-100',       dot: 'bg-red-400'     },
};

// ── Mapeamento centralizado de status técnico → nome amigável ────────────────
const STATUS_FRIENDLY: Record<string, string> = {
  waiting:     'Aguardando atendimento',
  called:      'Senha chamada',
  in_service:  'Em atendimento',
  finished:    'Atendimento finalizado',
  abandoned:   'Atendimento cancelado',
  no_show:     'Cliente não compareceu',
  transferred: 'Transferido para outro setor',
  confirmed:   'Agendamento confirmado',
  cancelled:   'Agendamento cancelado',
  pending:     'Agendamento pendente',
  attended:    'Cliente presente',
};

/** Substitui nomes técnicos de status por nomes amigáveis na descrição */
function translateDescription(desc: string): string {
  return desc.replace(/"([a-z_]+)"/g, (_match, key: string) => {
    const friendly = STATUS_FRIENDLY[key];
    return friendly ? `"${friendly}"` : `"${key}"`;
  });
}

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
  if (total === null || total === undefined) return '—';
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem.toString().padStart(2, '0')}m`;
}

interface TimelineEvent {
  id: string;
  source: 'appointment' | 'attendance';
  event_type: string;
  description: string;
  created_at: string;
}

interface AppointmentHistoryRow {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

interface VisitorTicketSummary {
  id: string;
  ticket_number: string;
  status: AttendanceTicketStatus;
  sector_label: string;
  issued_at: string;
}

const EMOJI_LABELS: Record<number, string> = { 1: '😡', 2: '😞', 3: '😐', 4: '😊', 5: '😍' };

function renderAnswerValue(type: string | undefined, value: AttendanceAnswerValue) {
  if (value === null || value === undefined) return <span className="text-xs text-gray-400">—</span>;

  // Yes/No
  if (type === 'yes_no') {
    const yes = value === 'sim' || value === 'yes' || value === 'true';
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${yes ? 'text-emerald-600' : 'text-red-500'}`}>
        {yes ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
        {yes ? 'Sim' : 'Não'}
      </span>
    );
  }

  // Rating (stars)
  if (type === 'rating' && typeof value === 'number') {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`w-3 h-3 ${i < value ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
        ))}
        <span className="ml-1 text-[10px] text-gray-500">{value}/5</span>
      </div>
    );
  }

  // Emoji
  if (type === 'emoji' && typeof value === 'number') {
    return <span className="text-sm">{EMOJI_LABELS[value] ?? value}</span>;
  }

  // Scale
  if (type === 'scale' && typeof value === 'number') {
    return <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{value}</span>;
  }

  // Multi-choice (array)
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary dark:bg-blue-900/30 dark:text-blue-300">
            {v}
          </span>
        ))}
      </div>
    );
  }

  // Text / single_choice / fallback
  return <span className="text-xs text-gray-700 dark:text-gray-200">{String(value)}</span>;
}

interface Props {
  ticket: AttendanceTicket | null;
  onClose: () => void;
}

interface AiTriage {
  categoria_sugerida: string;
  prioridade: 'baixa' | 'media' | 'alta';
  acoes_rapidas: string[];
}

const PRIORIDADE_COLOR: Record<AiTriage['prioridade'], string> = {
  baixa: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  media: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  alta:  'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

export default function AttendanceDetailsDrawer({ ticket, onClose }: Props) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [feedback, setFeedback] = useState<AttendanceFeedback | null>(null);
  const [feedbackQuestions, setFeedbackQuestions] = useState<AttendanceQuestion[]>([]);
  const [visitorHistory, setVisitorHistory] = useState<VisitorTicketSummary[]>([]);
  const [transferHistory, setTransferHistory] = useState<AttendanceTransferHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [appointment, setAppointment] = useState<{ visit_reason: string | null; notes: string | null } | null>(null);
  const [triage, setTriage] = useState<AiTriage | null>(null);
  const [triageBusy, setTriageBusy] = useState(false);
  const [triageError, setTriageError] = useState('');

  useEffect(() => {
    if (!ticket) return;
    setLoading(true);

    setTriage(null);
    setTriageError('');

    const load = async () => {
      const [attHistRes, apptHistRes, fbRes, visitorRes, transferRes, apptRes] = await Promise.all([
        supabase
          .from('attendance_history')
          .select('id, event_type, description, created_at')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('appointment_history')
          .select('id, event_type, description, created_at')
          .eq('appointment_id', ticket.appointment_id)
          .order('created_at', { ascending: false }),
        ticket.feedback_id
          ? supabase
              .from('attendance_feedback')
              .select('*')
              .eq('id', ticket.feedback_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('attendance_tickets')
          .select('id, ticket_number, status, sector_label, issued_at')
          .eq('visitor_phone', ticket.visitor_phone)
          .neq('id', ticket.id)
          .order('issued_at', { ascending: false })
          .limit(8),
        supabase
          .from('attendance_transfer_history')
          .select('*')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('visit_appointments')
          .select('visit_reason, notes')
          .eq('id', ticket.appointment_id)
          .maybeSingle(),
      ]);

      const att: TimelineEvent[] = ((attHistRes.data as AppointmentHistoryRow[]) || []).map((r) => ({
        id: `att-${r.id}`,
        source: 'attendance',
        event_type: r.event_type,
        description: r.description,
        created_at: r.created_at,
      }));
      const apt: TimelineEvent[] = ((apptHistRes.data as AppointmentHistoryRow[]) || []).map((r) => ({
        id: `apt-${r.id}`,
        source: 'appointment',
        event_type: r.event_type,
        description: r.description,
        created_at: r.created_at,
      }));
      const merged = [...att, ...apt].sort((a, b) => b.created_at.localeCompare(a.created_at));

      setTimeline(merged);
      const fb = (fbRes.data as AttendanceFeedback | null) || null;
      setFeedback(fb);
      setVisitorHistory((visitorRes.data as VisitorTicketSummary[]) || []);
      setTransferHistory((transferRes.data as AttendanceTransferHistoryEntry[]) || []);
      setAppointment((apptRes.data as { visit_reason: string | null; notes: string | null } | null) ?? null);

      // Load feedback question definitions when there are custom answers
      if (fb && fb.answers && Object.keys(fb.answers).length > 0) {
        const { data: settingsRow } = await supabase
          .from('system_settings')
          .select('value')
          .eq('category', 'attendance')
          .eq('key', 'feedback')
          .maybeSingle();
        const cfg = settingsRow?.value as { questions?: AttendanceQuestion[] } | null;
        setFeedbackQuestions(cfg?.questions ?? []);
      } else {
        setFeedbackQuestions([]);
      }

      setLoading(false);
    };

    load();
  }, [ticket]);

  const status = useMemo(
    () => (ticket ? STATUS_CONFIG[ticket.status] : null),
    [ticket],
  );

  async function handleTriage() {
    if (!ticket || triageBusy) return;
    setTriageBusy(true);
    setTriageError('');
    try {
      const historySummary = visitorHistory
        .slice(0, 5)
        .map((v) => `${v.sector_label} — ${v.status} (${new Date(v.issued_at).toLocaleDateString('pt-BR')})`)
        .join('; ');
      const { data, error } = await supabase.functions.invoke('ai-orchestrator', {
        body: {
          agent_slug: 'attendance_triage',
          context: {
            visit_reason: appointment?.visit_reason ?? ticket.sector_label,
            description: appointment?.notes ?? ticket.notes ?? '(sem descricao)',
            history: historySummary || '(sem historico)',
          },
        },
      });
      if (error || (data as { error?: string } | null)?.error) {
        throw new Error((data as { error?: string } | null)?.error ?? error?.message ?? 'Falha na chamada');
      }
      const raw = (data as { text?: string }).text ?? '';
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < 0) throw new Error('Resposta sem JSON.');
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as AiTriage;
      setTriage(parsed);
    } catch (e) {
      setTriageError(e instanceof Error ? e.message : 'Erro ao chamar o agente');
    } finally {
      setTriageBusy(false);
    }
  }

  if (!ticket) return null;

  return (
    <Drawer
      open={!!ticket}
      onClose={onClose}
      title={`Senha ${ticket.ticket_number}`}
      icon={Ticket}
      width="w-[460px]"
      badge={
        status && (
          <div className="flex items-center gap-1.5">
            {ticket.transferred_from_sector_key && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                <ArrowRightLeft className="w-3 h-3" />
                Transferido
              </span>
            )}
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md flex items-center gap-1.5 ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
        )
      }
    >
      {/* Visitor info */}
      <DrawerCard title="Visitante" icon={User}>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gray-800 dark:text-gray-100">{ticket.visitor_name}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Phone className="w-3 h-3" />
            {formatPhone(ticket.visitor_phone)}
          </div>
          {ticket.visitor_email && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Mail className="w-3 h-3" />
              {ticket.visitor_email}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <LayoutGrid className="w-3 h-3" />
            Setor: <span className="font-medium text-gray-700 dark:text-gray-200">{ticket.sector_label}</span>
          </div>
        </div>
      </DrawerCard>

      {/* AI triage suggestion */}
      <DrawerCard title="Sugestão IA" icon={Sparkles}>
        <div className="space-y-3">
          {!triage && !triageError && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Classificação automática com base no motivo da visita, descrição do agendamento e histórico do visitante.
            </p>
          )}

          {triageError && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {triageError}
            </div>
          )}

          {triage && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Categoria</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{triage.categoria_sugerida}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${PRIORIDADE_COLOR[triage.prioridade] ?? ''}`}>
                  {triage.prioridade}
                </span>
              </div>
              {triage.acoes_rapidas?.length > 0 && (
                <ul className="space-y-1">
                  {triage.acoes_rapidas.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary dark:text-brand-secondary flex-shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={handleTriage}
            disabled={triageBusy || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {triageBusy
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analisando…</>
              : <><Sparkles className="w-3.5 h-3.5" />{triage ? 'Reanalisar' : 'Analisar com IA'}</>}
          </button>
        </div>
      </DrawerCard>

      {/* Quick actions hub */}
      <AttendanceQuickActions ticket={ticket} />

      {/* Timings */}
      <DrawerCard title="Tempos" icon={Clock}>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400">Emitida</p>
            <p className="text-gray-700 dark:text-gray-200 mt-0.5">{formatDateTime(ticket.issued_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400">Chamada</p>
            <p className="text-gray-700 dark:text-gray-200 mt-0.5">{formatDateTime(ticket.called_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400">Início</p>
            <p className="text-gray-700 dark:text-gray-200 mt-0.5">{formatDateTime(ticket.service_started_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400">Finalização</p>
            <p className="text-gray-700 dark:text-gray-200 mt-0.5">{formatDateTime(ticket.finished_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400 flex items-center gap-1">
              <Hourglass className="w-3 h-3" />
              Tempo de espera
            </p>
            <p className="text-gray-700 dark:text-gray-200 mt-0.5">{secondsToLabel(ticket.wait_seconds)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Tempo de atendimento
            </p>
            <p className="text-gray-700 dark:text-gray-200 mt-0.5">{secondsToLabel(ticket.service_seconds)}</p>
          </div>
        </div>
      </DrawerCard>

      {/* Check-in */}
      {(ticket.checkin_lat !== null || ticket.checkin_distance_m !== null) && (
        <DrawerCard title="Check-in" icon={MapPin}>
          <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
            {ticket.checkin_lat !== null && ticket.checkin_lng !== null && (
              <p>
                Coordenadas: <span className="text-gray-700 dark:text-gray-200">{ticket.checkin_lat}, {ticket.checkin_lng}</span>
              </p>
            )}
            {ticket.checkin_distance_m !== null && (
              <p>
                Distância da instituição: <span className="text-gray-700 dark:text-gray-200">{ticket.checkin_distance_m}m</span>
              </p>
            )}
          </div>
        </DrawerCard>
      )}

      {/* Transfer history */}
      {transferHistory.length > 0 && (
        <DrawerCard title="Transferências" icon={ArrowRightLeft}>
          <div className="space-y-3">
            {transferHistory.map((th) => (
              <div key={th.id} className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                  <ArrowRightLeft className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{th.from_sector_label}</span>
                    {' → '}
                    <span className="font-medium">{th.to_sector_label}</span>
                  </p>
                  {th.reason && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 italic">
                      &ldquo;{th.reason}&rdquo;
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatDateTime(th.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DrawerCard>
      )}

      {/* Feedback */}
      {feedback && (
        <DrawerCard title="Avaliação do cliente" icon={Star}>
          <div className="space-y-2 text-sm">
            {feedback.rating !== null && (
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < (feedback.rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                  />
                ))}
                <span className="ml-2 text-xs text-gray-500">{feedback.rating}/5</span>
              </div>
            )}
            {feedback.comments && (
              <p className="text-xs text-gray-600 dark:text-gray-300 italic bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                &ldquo;{feedback.comments}&rdquo;
              </p>
            )}

            {/* Custom question answers */}
            {feedback.answers && Object.keys(feedback.answers).length > 0 && (
              <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700/50">
                <p className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Perguntas personalizadas</p>
                {Object.entries(feedback.answers as Record<string, AttendanceAnswerValue>).map(([qId, value]) => {
                  const question = feedbackQuestions.find((q) => q.id === qId);
                  const label = question?.label || qId;
                  return (
                    <div key={qId} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                      {renderAnswerValue(question?.type, value)}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-gray-400">Enviado em {formatDateTime(feedback.submitted_at)}</p>
          </div>
        </DrawerCard>
      )}

      {/* Timeline */}
      <DrawerCard title="Histórico" icon={History}>
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Nenhum evento registrado.</p>
        ) : (
          <div className="space-y-3">
            {timeline.map((e) => (
              <div key={e.id} className="flex gap-2.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  e.source === 'attendance'
                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                }`}>
                  <ChevronRight className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300">{translateDescription(e.description)}</p>
                  <p className="text-[10px] text-gray-400">
                    {formatDateTime(e.created_at)}
                    {' · '}
                    {e.source === 'attendance' ? 'Atendimento' : 'Agendamento'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DrawerCard>

      {/* Visitor history */}
      {visitorHistory.length > 0 && (
        <DrawerCard title="Histórico do visitante" icon={Ticket}>
          <div className="space-y-2">
            {visitorHistory.map((v) => {
              const s = STATUS_CONFIG[v.status];
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Senha {v.ticket_number}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {v.sector_label} · {formatDateTime(v.issued_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md flex items-center gap-1 ${s.color.replace('/20', '/40').replace('text-', 'text-').replace('100', '600')}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </DrawerCard>
      )}
    </Drawer>
  );
}
