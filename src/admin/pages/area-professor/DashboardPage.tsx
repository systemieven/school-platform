import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useTeacherClasses } from './hooks/useTeacherClasses';
import { supabase } from '../../../lib/supabase';
import {
  BookOpen, AlertCircle, ClipboardList, BarChart2, Loader2,
} from 'lucide-react';

interface DashboardStats {
  classesCount: number;
  missingAttendanceEntries: { class_id: string; class_name: string; entry_date: string }[];
  activitiesWithoutScores: number;
  pendingPlans: number;
  weeklyEntriesCount: number;
}

export default function ProfessorDashboardPage() {
  const { profile } = useAdminAuth();
  const { classes: teacherClasses } = useTeacherClasses();
  const navigate = useNavigate();
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    async function loadStats() {
      setLoading(true);
      const teacherId = profile!.id;
      const classIds  = teacherClasses.map((c) => c.id);

      // Aulas sem presença nos últimos 3 dias
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      let missingAttendance: { class_id: string; class_name: string; entry_date: string }[] = [];
      if (classIds.length > 0) {
        const { data: entries } = await supabase
          .from('class_diary_entries')
          .select('id, class_id, entry_date, school_classes(name)')
          .eq('teacher_id', teacherId)
          .gte('entry_date', threeDaysAgoStr)
          .order('entry_date', { ascending: false });

        if (entries) {
          const entryIds = entries.map((e) => e.id);
          let attendedIds: string[] = [];
          if (entryIds.length > 0) {
            const { data: att } = await supabase
              .from('diary_attendance')
              .select('diary_entry_id')
              .in('diary_entry_id', entryIds);
            attendedIds = [...new Set((att ?? []).map((a) => a.diary_entry_id))];
          }
          missingAttendance = entries
            .filter((e) => !attendedIds.includes(e.id))
            .map((e) => ({
              class_id:   e.class_id,
              class_name: (e.school_classes as unknown as { name: string }[] | null)?.[0]?.name ?? '—',
              entry_date: e.entry_date,
            }));
        }
      }

      // Atividades publicadas sem nota para todos os alunos
      let activitiesWithoutScores = 0;
      if (classIds.length > 0) {
        const { count } = await supabase
          .from('class_activities')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherId)
          .eq('is_published', true);
        activitiesWithoutScores = count ?? 0;
      }

      // Planos publicados ainda não executados
      let pendingPlans = 0;
      if (classIds.length > 0) {
        const { count } = await supabase
          .from('lesson_plans')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherId)
          .eq('status', 'published');
        pendingPlans = count ?? 0;
      }

      // Aulas registradas esta semana
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];

      let weeklyEntriesCount = 0;
      const { count: wCount } = await supabase
        .from('class_diary_entries')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .gte('entry_date', weekStartStr);
      weeklyEntriesCount = wCount ?? 0;

      setStats({
        classesCount: teacherClasses.length,
        missingAttendanceEntries: missingAttendance,
        activitiesWithoutScores,
        pendingPlans,
        weeklyEntriesCount,
      });
      setLoading(false);
    }

    loadStats();
  }, [profile, teacherClasses]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Professor(a)';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Olá, {firstName}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Resumo do seu portal — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-brand-primary" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Minhas Turmas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.classesCount ?? 0}</p>
          <button
            onClick={() => navigate('/admin/area-professor?tab=turmas')}
            className="mt-2 text-xs text-brand-primary hover:underline"
          >
            Ver turmas
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Sem Presença (3d)</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats?.missingAttendanceEntries.length ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">aulas pendentes</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Planos Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.pendingPlans ?? 0}</p>
          <button
            onClick={() => navigate('/admin/area-professor?tab=planos')}
            className="mt-2 text-xs text-brand-primary hover:underline"
          >
            Ver planos
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Aulas esta Semana</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.weeklyEntriesCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">registradas</p>
        </div>
      </div>

      {/* Missing attendance alert */}
      {(stats?.missingAttendanceEntries.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Aulas sem registro de presença (últimos 3 dias)
            </h3>
          </div>
          <div className="space-y-2">
            {stats!.missingAttendanceEntries.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {entry.class_name}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                  <button
                    onClick={() => navigate(`/admin/area-professor/turmas/${entry.class_id}/diario`)}
                    className="text-xs text-brand-primary hover:underline"
                  >
                    Abrir diário
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick access */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Acesso rápido</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {teacherClasses.slice(0, 6).map((cls) => (
            <button
              key={cls.id}
              onClick={() => navigate(`/admin/area-professor/turmas/${cls.id}/diario`)}
              className="text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 hover:bg-brand-primary/5 dark:hover:bg-brand-primary/10 border border-gray-100 dark:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{cls.name}</span>
              </div>
              <p className="text-xs text-gray-400">{cls.disciplines.length} disciplina{cls.disciplines.length !== 1 ? 's' : ''}</p>
            </button>
          ))}
        </div>
        {teacherClasses.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma turma vinculada.</p>
        )}
      </div>
    </div>
  );
}
