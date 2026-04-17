/**
 * UpcomingVisitsWidget
 *
 * Lista visualmente rica de próximas visitas/agendamentos: cada
 * item tem um "calendar chip" à esquerda (mês + dia em destaque),
 * nome do visitante, horário + motivo, e badge de status.
 */
import { Link } from 'react-router-dom';
import { CalendarCheck, ChevronRight } from 'lucide-react';

export interface UpcomingAppointment {
  id: string;
  visitor_name: string;
  appointment_date: string;
  appointment_time: string;
  visit_reason: string;
  status: string;
}

export interface UpcomingVisitsWidgetProps {
  appointments: UpcomingAppointment[];
  /** Mapa opcional de chave do motivo → label legível. */
  reasonLabels?: Record<string, string>;
  linkTo?: string;
  title?: string;
  emptyLabel?: string;
}

function fmtTime(t: string): string {
  return t.slice(0, 5);
}

export function UpcomingVisitsWidget({
  appointments,
  reasonLabels = {},
  linkTo = '/admin/agendamentos',
  title = 'Próximas visitas (7 dias)',
  emptyLabel = 'Nenhuma visita nos próximos 7 dias',
}: UpcomingVisitsWidgetProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">{title}</h3>
        <Link
          to={linkTo}
          className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1"
        >
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-6">
          <CalendarCheck className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">{emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => {
            const date = new Date(apt.appointment_date + 'T00:00:00');
            return (
              <Link
                key={apt.id}
                to={linkTo}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
              >
                <div className="w-9 h-9 bg-brand-primary/10 dark:bg-white/10 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-brand-primary dark:text-brand-secondary uppercase leading-none">
                    {date.toLocaleDateString('pt-BR', { month: 'short' })}
                  </span>
                  <span className="text-sm font-bold text-brand-primary dark:text-brand-secondary leading-none">
                    {date.getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{apt.visitor_name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {fmtTime(apt.appointment_time)} · {reasonLabels[apt.visit_reason] || apt.visit_reason}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    apt.status === 'confirmed'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {apt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
