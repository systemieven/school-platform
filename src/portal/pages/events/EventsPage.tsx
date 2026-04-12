import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { Loader2, CalendarDays, MapPin, Clock, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
}

interface RsvpMap {
  [eventId: string]: 'confirmed' | 'declined' | 'maybe' | null;
}


function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : null;
}

const RSVP_OPTIONS: { value: 'confirmed' | 'declined' | 'maybe'; label: string; Icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'confirmed', label: 'Vou!',     Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
  { value: 'maybe',     label: 'Talvez',   Icon: HelpCircle,   color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  { value: 'declined',  label: 'Não vou',  Icon: XCircle,      color: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
];

export default function PortalEventsPage() {
  const { student } = useStudentAuth();
  const [items,   setItems]   = useState<EventItem[]>([]);
  const [rsvps,   setRsvps]   = useState<RsvpMap>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string | null>(null); // event id being saved

  const load = useCallback(async () => {
    if (!student) { setLoading(false); return; }
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);

    const [{ data: evData }, { data: rsvpData }] = await Promise.all([
      supabase.from('school_events')
        .select('id, title, description, location, event_date, start_time, end_time')
        .eq('is_published', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('event_rsvps')
        .select('event_id, status')
        .eq('student_id', student.id),
    ]);

    setItems((evData ?? []) as EventItem[]);

    const map: RsvpMap = {};
    for (const r of (rsvpData ?? []) as { event_id: string; status: string }[]) {
      map[r.event_id] = r.status as 'confirmed' | 'declined' | 'maybe';
    }
    setRsvps(map);
    setLoading(false);
  }, [student]);

  useEffect(() => { load(); }, [load]);

  async function respondRsvp(eventId: string, status: 'confirmed' | 'declined' | 'maybe') {
    if (!student) return;
    setSaving(eventId);

    // Upsert RSVP
    await supabase.from('event_rsvps').upsert(
      { event_id: eventId, student_id: student.id, status, responded_at: new Date().toISOString() },
      { onConflict: 'event_id,student_id' }
    );

    setRsvps((p) => ({ ...p, [eventId]: status }));
    setSaving(null);
  }

  // Group by month
  const grouped: { label: string; events: EventItem[] }[] = [];
  for (const ev of items) {
    const monthLabel = new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', {
      month: 'long', year: 'numeric',
    });
    const last = grouped[grouped.length - 1];
    if (last?.label === monthLabel) {
      last.events.push(ev);
    } else {
      grouped.push({ label: monthLabel, events: [ev] });
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-brand-primary dark:text-brand-secondary" /> Eventos
      </h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-brand-primary dark:text-brand-secondary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum evento próximo.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 capitalize">
                {group.label}
              </p>
              <div className="space-y-3">
                {group.events.map((ev) => {
                  const myRsvp = rsvps[ev.id] ?? null;
                  const isSaving = saving === ev.id;
                  return (
                    <div key={ev.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                      <div className="flex">
                        {/* Date accent */}
                        <div className="w-14 flex-shrink-0 bg-brand-primary dark:bg-brand-primary/80 flex flex-col items-center justify-center py-4 text-white">
                          <p className="text-xl font-bold leading-none">
                            {new Date(ev.event_date + 'T12:00:00').getDate().toString().padStart(2, '0')}
                          </p>
                          <p className="text-xs uppercase opacity-80 mt-0.5">
                            {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                          </p>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4">
                          <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{ev.title}</p>

                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {(ev.start_time || ev.end_time) && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
                              </span>
                            )}
                            {ev.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {ev.location}
                              </span>
                            )}
                          </div>

                          {ev.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{ev.description}</p>
                          )}

                          {/* RSVP buttons */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {RSVP_OPTIONS.map(({ value, label, Icon, color }) => {
                              const active = myRsvp === value;
                              return (
                                <button key={value}
                                  disabled={isSaving}
                                  onClick={() => respondRsvp(ev.id, value)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60 ${
                                    active ? color : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}>
                                  {isSaving && active
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Icon className="w-3 h-3" />}
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
