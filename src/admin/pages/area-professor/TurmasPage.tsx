import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacherClasses } from './hooks/useTeacherClasses';
import { supabase } from '../../../lib/supabase';
import { BookOpen, Users, ClipboardList, Star, Loader2 } from 'lucide-react';
import type { TeacherClass } from './hooks/useTeacherClasses';

interface ClassStats {
  [classId: string]: {
    studentCount: number;
    frequencyPct: number | null;
  };
}

const SHIFT_LABELS: Record<string, string> = {
  morning:   'Manhã',
  afternoon: 'Tarde',
  full:      'Integral',
};

export default function TurmasPage() {
  const { classes: teacherClasses } = useTeacherClasses();
  const navigate = useNavigate();
  const [stats, setStats]   = useState<ClassStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (teacherClasses.length === 0) { setLoading(false); return; }
      const classIds = teacherClasses.map((c) => c.id);

      // Count students per class
      const { data: students } = await supabase
        .from('students')
        .select('class_id')
        .in('class_id', classIds)
        .eq('status', 'active');

      // Frequency: presença nos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: entries } = await supabase
        .from('class_diary_entries')
        .select('id, class_id')
        .in('class_id', classIds)
        .gte('entry_date', thirtyDaysAgoStr);

      const entryIds = (entries ?? []).map((e) => e.id);
      let attendanceData: { diary_entry_id: string; status: string }[] = [];
      if (entryIds.length > 0) {
        const { data: att } = await supabase
          .from('diary_attendance')
          .select('diary_entry_id, status')
          .in('diary_entry_id', entryIds);
        attendanceData = att ?? [];
      }

      // Build stats per class
      const newStats: ClassStats = {};
      for (const cls of teacherClasses) {
        const studentCount = (students ?? []).filter((s) => s.class_id === cls.id).length;
        const classEntries = (entries ?? []).filter((e) => e.class_id === cls.id).map((e) => e.id);
        const classAtt = attendanceData.filter((a) => classEntries.includes(a.diary_entry_id));
        const totalAtt = classAtt.length;
        const presentAtt = classAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
        newStats[cls.id] = {
          studentCount,
          frequencyPct: totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null,
        };
      }
      setStats(newStats);
      setLoading(false);
    }
    loadStats();
  }, [teacherClasses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Minhas Turmas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {teacherClasses.length} turma{teacherClasses.length !== 1 ? 's' : ''} vinculada{teacherClasses.length !== 1 ? 's' : ''}
        </p>
      </div>

      {teacherClasses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhuma turma vinculada</p>
          <p className="text-xs text-gray-400 mt-1">Entre em contato com a coordenação para vincular suas turmas.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {teacherClasses.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              stats={stats[cls.id]}
              onDiario={() => navigate(`/admin/area-professor/turmas/${cls.id}/diario`)}
              onNotas={() => navigate(`/admin/area-professor/turmas/${cls.id}/notas`)}
              onAlunos={() => navigate(`/admin/area-professor/turmas/${cls.id}/alunos/lista`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({
  cls,
  stats,
  onDiario,
  onNotas,
  onAlunos,
}: {
  cls: TeacherClass;
  stats?: { studentCount: number; frequencyPct: number | null };
  onDiario: () => void;
  onNotas: () => void;
  onAlunos: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{cls.name}</h3>
            {cls.shift && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {SHIFT_LABELS[cls.shift] ?? cls.shift}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">Ano letivo {cls.year}</p>

          {/* Disciplines */}
          {cls.disciplines.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {cls.disciplines.map((d) => (
                <span
                  key={d.discipline_id}
                  className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: d.discipline_color }}
                >
                  {d.discipline_name}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{stats?.studentCount ?? '—'} alunos</span>
            </div>
            {stats?.frequencyPct !== null && stats?.frequencyPct !== undefined && (
              <div className="flex items-center gap-1">
                <span
                  className={`font-semibold ${
                    stats.frequencyPct >= 75
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {stats.frequencyPct}%
                </span>
                <span>frequência (30d)</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onDiario}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Ver Diário
          </button>
          <button
            onClick={onNotas}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Star className="w-3.5 h-3.5" />
            Ver Notas
          </button>
          <button
            onClick={onAlunos}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Ver Alunos
          </button>
        </div>
      </div>
    </div>
  );
}
