import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { Loader2, ClipboardList, Star, Megaphone, Library, ChevronRight, Calendar } from 'lucide-react';

interface ActivityRow { id: string; title: string; type: string; due_date: string | null; status?: string }
interface GradeRow    { id: string; subject: string; score: number; max_score: number; period: string }
interface AnnRow      { id: string; title: string; publish_at: string }

export default function DashboardPage() {
  const { student } = useStudentAuth();
  const [activities,   setActivities]   = useState<ActivityRow[]>([]);
  const [grades,       setGrades]       = useState<GradeRow[]>([]);
  const [announcements,setAnnouncements]= useState<AnnRow[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!student?.class_id) { setLoading(false); return; }
    const cid = student.class_id;
    const sid = student.id;

    Promise.all([
      // Upcoming activities
      supabase.from('activities').select('id, title, type, due_date')
        .eq('class_id', cid).eq('status', 'published')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date').limit(3),
      // Recent grades
      supabase.from('grades').select('id, subject, score, max_score, period')
        .eq('class_id', cid).eq('student_id', sid)
        .order('created_at', { ascending: false }).limit(3),
      // Latest announcements
      supabase.from('announcements').select('id, title, publish_at')
        .eq('is_published', true)
        .or(`target_type.eq.all,and(target_type.eq.class,target_ids.cs.{${cid}})`)
        .order('publish_at', { ascending: false }).limit(3),
    ]).then(([act, grd, ann]) => {
      setActivities((act.data ?? []) as ActivityRow[]);
      setGrades((grd.data ?? []) as GradeRow[]);
      setAnnouncements((ann.data ?? []) as AnnRow[]);
      setLoading(false);
    });
  }, [student]);

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Olá, {student?.full_name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Matrícula {student?.enrollment_number}
        </p>
      </div>

      {/* Upcoming activities */}
      <Section
        title="Próximas atividades" icon={<ClipboardList className="w-4 h-4" />}
        linkTo="/portal/atividades" linkLabel="Ver todas"
        empty={!activities.length} emptyMsg="Nenhuma atividade pendente.">
        {activities.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.title}</p>
              <p className="text-xs text-gray-400 capitalize">{a.type}</p>
            </div>
            {a.due_date && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                <Calendar className="w-3 h-3" /> {fmtDate(a.due_date)}
              </span>
            )}
          </div>
        ))}
      </Section>

      {/* Recent grades */}
      <Section
        title="Notas recentes" icon={<Star className="w-4 h-4" />}
        linkTo="/portal/notas" linkLabel="Ver boletim"
        empty={!grades.length} emptyMsg="Nenhuma nota registrada.">
        {grades.map((g) => (
          <div key={g.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{g.subject}</p>
              <p className="text-xs text-gray-400">{g.period}</p>
            </div>
            <span className={`text-sm font-bold ${g.score >= g.max_score * 0.6 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {g.score} <span className="text-gray-400 font-normal text-xs">/ {g.max_score}</span>
            </span>
          </div>
        ))}
      </Section>

      {/* Announcements */}
      <Section
        title="Comunicados" icon={<Megaphone className="w-4 h-4" />}
        linkTo="/portal/comunicados" linkLabel="Ver todos"
        empty={!announcements.length} emptyMsg="Nenhum comunicado recente.">
        {announcements.map((a) => (
          <div key={a.id} className="py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(a.publish_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        ))}
      </Section>

      {/* Library shortcut */}
      <Link to="/portal/biblioteca"
        className="flex items-center justify-between p-4 bg-brand-primary/5 dark:bg-brand-secondary/5 border border-brand-primary/10 dark:border-brand-secondary/10 rounded-xl hover:bg-brand-primary/10 dark:hover:bg-brand-secondary/10 transition-colors">
        <div className="flex items-center gap-3">
          <Library className="w-5 h-5 text-brand-primary dark:text-brand-secondary" />
          <div>
            <p className="text-sm font-semibold text-brand-primary dark:text-brand-secondary">Biblioteca Virtual</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Materiais e recursos de estudo</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </Link>
    </div>
  );
}

function Section({ title, icon, linkTo, linkLabel, empty, emptyMsg, children }: {
  title: string; icon: React.ReactNode; linkTo: string; linkLabel: string;
  empty: boolean; emptyMsg: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <span className="text-brand-primary dark:text-brand-secondary">{icon}</span>
          {title}
        </div>
        <Link to={linkTo} className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-0.5">
          {linkLabel} <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="px-4">
        {empty
          ? <p className="text-xs text-gray-400 py-4 text-center">{emptyMsg}</p>
          : children}
      </div>
    </div>
  );
}
