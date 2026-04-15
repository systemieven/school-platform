import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import { Loader2, CalendarClock } from 'lucide-react';

interface ScheduleRow {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  subject?: { id: string; name: string } | null;
  teacher?: { id: string; full_name: string } | null;
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function GradeHorariaPage() {
  const { currentStudentId, students } = useGuardian();
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [loading, setLoading]   = useState(true);

  const currentStudent = students.find((s) => s.student_id === currentStudentId);
  const classId = currentStudent?.student?.class_id;

  useEffect(() => {
    if (!classId) { setLoading(false); return; }

    supabase
      .from('class_schedules')
      .select(`
        id, weekday, start_time, end_time,
        subject:school_subjects(id, name),
        teacher:teachers(id, full_name)
      `)
      .eq('class_id', classId)
      .order('weekday')
      .order('start_time')
      .then(({ data }) => {
        setSchedule((data ?? []) as unknown as ScheduleRow[]);
        setLoading(false);
      });
  }, [classId]);

  // Group by weekday
  const grouped = WEEKDAYS.reduce<Record<number, ScheduleRow[]>>((acc, _, i) => {
    acc[i + 1] = schedule.filter((s) => s.weekday === i + 1);
    return acc;
  }, {});

  const activeDays = Object.entries(grouped).filter(([, rows]) => rows.length > 0);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <CalendarClock className="w-5 h-5" /> Grade Horária
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Horário semanal de aulas da turma.
        </p>
      </div>

      {activeDays.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Grade horária não cadastrada.</p>
          <p className="text-xs mt-1">Os horários da turma serão exibidos quando configurados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeDays.map(([day, rows]) => (
            <div key={day} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {WEEKDAYS[Number(day) - 1]}
                </p>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-shrink-0 w-20 text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {(row.subject as { name: string } | null)?.name ?? 'Disciplina'}
                      </p>
                      {row.teacher && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(row.teacher as { full_name: string }).full_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
