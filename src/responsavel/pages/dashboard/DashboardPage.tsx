import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import {
  Loader2, Wallet, CalendarClock, AlertCircle, CalendarDays,
  CheckSquare, ChevronRight,
} from 'lucide-react';

interface SummaryData {
  pendingInstallments: number;
  attendancePercent: number | null;
  unreadOccurrences: number;
  upcomingEvents: { id: string; title: string; event_date: string }[];
  pendingAuthorizations: number;
}

export default function GuardianDashboardPage() {
  const { guardian, students, currentStudentId } = useGuardian();
  const [data, setData]       = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const currentStudent = students.find((s) => s.student_id === currentStudentId);

  useEffect(() => {
    if (!currentStudentId) { setLoading(false); return; }

    const sid = currentStudentId;
    const classId = currentStudent?.student?.class_id;
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    async function load() {
      const [instRes, attendRes, occRes, eventsRes, authRes] = await Promise.all([
        // Pending installments
        supabase
          .from('financial_installments')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', sid)
          .in('status', ['pending', 'overdue']),

        // Attendance last 30 days
        supabase
          .from('diary_attendance')
          .select('status')
          .eq('student_id', sid)
          .gte('diary_entry:class_diary_entries(entry_date)', thirtyDaysAgo),

        // Unread occurrences
        supabase
          .from('student_occurrences')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', sid)
          .eq('visible_to_guardian', true)
          .eq('status', 'open'),

        // Upcoming events
        supabase
          .from('school_calendar_events')
          .select('id, title, event_date')
          .gte('event_date', today)
          .order('event_date')
          .limit(3),

        // Pending authorizations — active authorizations without a response for this student
        classId
          ? supabase
              .from('activity_authorizations')
              .select('id, authorization_responses!left(id, student_id)')
              .eq('status', 'active')
              .gte('deadline', today)
              .contains('class_ids', [classId])
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Attendance calc
      let attendancePercent: number | null = null;
      if (attendRes.data && attendRes.data.length > 0) {
        const total = attendRes.data.length;
        const present = attendRes.data.filter((a: { status: string }) => a.status === 'present').length;
        attendancePercent = Math.round((present / total) * 100);
      }

      // Pending authorizations = those without a response for this student
      const pendingAuthorizations = (authRes.data ?? []).filter((a: {
        authorization_responses?: { id: string; student_id: string }[] | null;
      }) => {
        const responses = a.authorization_responses ?? [];
        return !responses.some((r) => r.student_id === sid);
      }).length;

      setData({
        pendingInstallments: instRes.count ?? 0,
        attendancePercent,
        unreadOccurrences: occRes.count ?? 0,
        upcomingEvents: (eventsRes.data ?? []) as { id: string; title: string; event_date: string }[],
        pendingAuthorizations,
      });
      setLoading(false);
    }

    load();
  }, [currentStudentId, currentStudent?.student?.class_id]);

  const studentName = currentStudent?.student?.full_name?.split(' ')[0] ?? '';

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  if (!currentStudentId) return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-sm">Nenhum aluno vinculado a este responsável.</p>
    </div>
  );

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Olá, {guardian?.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Acompanhando: <span className="font-medium text-gray-700 dark:text-gray-300">{currentStudent?.student?.full_name}</span>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/responsavel/financeiro"
          className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 flex flex-col gap-2 hover:shadow-md transition-shadow ${
            (data?.pendingInstallments ?? 0) > 0
              ? 'border-red-200 dark:border-red-800'
              : 'border-gray-100 dark:border-gray-700'
          }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            (data?.pendingInstallments ?? 0) > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            <Wallet className={`w-4 h-4 ${(data?.pendingInstallments ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{data?.pendingInstallments ?? 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Parcelas pendentes</p>
          </div>
        </Link>

        <Link to="/responsavel/frequencia"
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <CalendarClock className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {data?.attendancePercent != null ? `${data.attendancePercent}%` : '—'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Frequência (30d)</p>
          </div>
        </Link>

        <Link to="/responsavel/ocorrencias"
          className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 flex flex-col gap-2 hover:shadow-md transition-shadow ${
            (data?.unreadOccurrences ?? 0) > 0
              ? 'border-amber-200 dark:border-amber-800'
              : 'border-gray-100 dark:border-gray-700'
          }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            (data?.unreadOccurrences ?? 0) > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            <AlertCircle className={`w-4 h-4 ${(data?.unreadOccurrences ?? 0) > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{data?.unreadOccurrences ?? 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ocorrências abertas</p>
          </div>
        </Link>

        <Link to="/responsavel/autorizacoes"
          className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 flex flex-col gap-2 hover:shadow-md transition-shadow ${
            (data?.pendingAuthorizations ?? 0) > 0
              ? 'border-brand-primary/20 dark:border-brand-secondary/20'
              : 'border-gray-100 dark:border-gray-700'
          }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            (data?.pendingAuthorizations ?? 0) > 0 ? 'bg-brand-primary/5 dark:bg-brand-secondary/10' : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            <CheckSquare className={`w-4 h-4 ${(data?.pendingAuthorizations ?? 0) > 0 ? 'text-brand-primary dark:text-brand-secondary' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{data?.pendingAuthorizations ?? 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Autorizações pendentes</p>
          </div>
        </Link>
      </div>

      {/* Upcoming events */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <CalendarDays className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
            Próximos eventos
          </div>
          <Link to="/responsavel/eventos" className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-0.5">
            Ver todos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="px-4">
          {(data?.upcomingEvents ?? []).length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Nenhum evento próximo.</p>
          ) : (
            (data?.upcomingEvents ?? []).map((ev) => (
              <div key={ev.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ev.title}</p>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-4">{fmtDate(ev.event_date)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/responsavel/notas"
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Ver notas de {studentName}</div>
          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
        </Link>
        <Link to="/responsavel/grade"
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Grade horária</div>
          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
        </Link>
      </div>
    </div>
  );
}
