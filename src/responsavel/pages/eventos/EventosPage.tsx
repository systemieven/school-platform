import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, CalendarDays } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: string | null;
  is_holiday: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  holiday:     'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  school:      'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  activity:    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
  meeting:     'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
};

export default function EventosPage() {
  const [events, setEvents]   = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('school_calendar_events')
      .select('id, title, description, event_date, end_date, event_type, is_holiday')
      .gte('event_date', today)
      .order('event_date')
      .then(({ data }) => {
        setEvents((data ?? []) as CalendarEvent[]);
        setLoading(false);
      });
  }, []);

  const fmtDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <CalendarDays className="w-5 h-5" /> Eventos
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Próximos eventos e datas importantes do calendário escolar.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum evento próximo.</p>
          <p className="text-xs mt-1">Eventos do calendário escolar aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const typeColor = TYPE_COLORS[ev.event_type ?? ''] ?? TYPE_COLORS.school;
            return (
              <div key={ev.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 text-center bg-brand-primary/5 dark:bg-brand-secondary/10 rounded-xl px-2 py-2">
                    <p className="text-xs text-brand-primary dark:text-brand-secondary font-bold leading-tight">
                      {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-tight capitalize">
                      {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{ev.title}</p>
                      {ev.event_type && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                          {ev.event_type}
                        </span>
                      )}
                      {ev.is_holiday && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                          Feriado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{fmtDate(ev.event_date)}</p>
                    {ev.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5">{ev.description}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
