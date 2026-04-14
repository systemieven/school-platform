import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { Loader2, CalendarClock } from 'lucide-react';

interface ScheduleSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  discipline: { name: string; code: string; color: string } | null;
  teacher: { full_name: string } | null;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS = [1, 2, 3, 4, 5]; // Seg-Sex

export default function GradePage() {
  const { student } = useStudentAuth();
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student?.class_id) { setLoading(false); return; }
    supabase
      .from('class_schedules')
      .select('id, day_of_week, start_time, end_time, discipline:disciplines(name, code, color), teacher:profiles(full_name)')
      .eq('class_id', student.class_id)
      .order('start_time')
      .order('day_of_week')
      .then(({ data, error }) => {
        if (error) console.error('Error fetching schedule:', error);
        setSlots((data ?? []) as unknown as ScheduleSlot[]);
        setLoading(false);
      });
  }, [student]);

  // Build unique sorted time slots
  const timeSlots = [...new Set(slots.map((s) => `${s.start_time}-${s.end_time}`))]
    .sort()
    .map((key) => {
      const [start, end] = key.split('-');
      return { key, start, end };
    });

  const fmtTime = (t: string) => t.slice(0, 5); // "08:00:00" → "08:00"

  const getSlot = (day: number, timeKey: string) =>
    slots.find((s) => s.day_of_week === day && `${s.start_time}-${s.end_time}` === timeKey);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-brand-primary dark:text-brand-secondary" /> Grade Horária
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-brand-primary dark:text-brand-secondary" />
        </div>
      ) : !slots.length ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma grade horária configurada.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left bg-gray-50 dark:bg-gray-800 rounded-tl-xl">
                  Horário
                </th>
                {WEEKDAYS.map((day) => (
                  <th key={day} className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center bg-gray-50 dark:bg-gray-800 last:rounded-tr-xl">
                    {DAY_LABELS[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((ts, idx) => (
                <tr key={ts.key} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800/30' : 'bg-gray-50/50 dark:bg-gray-800/10'}>
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap border-r border-gray-100 dark:border-gray-700">
                    {fmtTime(ts.start)} – {fmtTime(ts.end)}
                  </td>
                  {WEEKDAYS.map((day) => {
                    const slot = getSlot(day, ts.key);
                    if (!slot) {
                      return (
                        <td key={day} className="px-2 py-2 text-center border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        </td>
                      );
                    }
                    const color = slot.discipline?.color || '#6366f1';
                    return (
                      <td key={day} className="px-2 py-2 text-center border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                        <div
                          className="inline-flex flex-col items-center px-2 py-1.5 rounded-lg text-white min-w-[70px]"
                          style={{ backgroundColor: color }}
                        >
                          <span className="text-xs font-bold leading-tight">
                            {slot.discipline?.code ?? '—'}
                          </span>
                          <span className="text-[10px] opacity-80 leading-tight mt-0.5 truncate max-w-[90px]">
                            {slot.teacher?.full_name ?? ''}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
