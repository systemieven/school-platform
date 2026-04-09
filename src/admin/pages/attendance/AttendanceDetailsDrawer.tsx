import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import type {
  AttendanceTicket,
  AttendanceTicketStatus,
  AttendanceFeedback,
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
} from 'lucide-react';

const STATUS_CONFIG: Record<AttendanceTicketStatus, { label: string; color: string; dot: string }> = {
  waiting:    { label: 'Aguardando',      color: 'bg-amber-500/20 text-amber-100',   dot: 'bg-amber-400'   },
  called:     { label: 'Chamado',         color: 'bg-blue-500/20 text-blue-100',     dot: 'bg-blue-400'    },
  in_service: { label: 'Em atendimento',  color: 'bg-indigo-500/20 text-indigo-100', dot: 'bg-indigo-400'  },
  finished:   { label: 'Finalizado',      color: 'bg-emerald-500/20 text-emerald-100', dot: 'bg-emerald-400' },
  abandoned:  { label: 'Abandonado',      color: 'bg-gray-500/20 text-gray-200',     dot: 'bg-gray-400'    },
  no_show:    { label: 'Não veio',        color: 'bg-red-500/20 text-red-100',       dot: 'bg-red-400'     },
};

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

interface Props {
  ticket: AttendanceTicket | null;
  onClose: () => void;
}

export default function AttendanceDetailsDrawer({ ticket, onClose }: Props) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [feedback, setFeedback] = useState<AttendanceFeedback | null>(null);
  const [visitorHistory, setVisitorHistory] = useState<VisitorTicketSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setLoading(true);

    const load = async () => {
      const [attHistRes, apptHistRes, fbRes, visitorRes] = await Promise.all([
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
      setFeedback((fbRes.data as AttendanceFeedback | null) || null);
      setVisitorHistory((visitorRes.data as VisitorTicketSummary[]) || []);
      setLoading(false);
    };

    load();
  }, [ticket]);

  const status = useMemo(
    () => (ticket ? STATUS_CONFIG[ticket.status] : null),
    [ticket],
  );

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
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md flex items-center gap-1.5 ${status.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
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
                  <p className="text-xs text-gray-700 dark:text-gray-300">{e.description}</p>
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
