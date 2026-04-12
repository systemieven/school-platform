import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { Loader2, ClipboardList, Calendar } from 'lucide-react';

interface Activity {
  id: string; title: string; type: string; subject: string | null;
  description: string | null; due_date: string | null; max_score: number | null; status: string;
}

const TYPE_LABELS: Record<string, string> = {
  homework: 'Tarefa', test: 'Prova', project: 'Projeto', quiz: 'Quiz', other: 'Outro',
};

export default function ActivitiesPage() {
  const { student } = useStudentAuth();
  const [items,   setItems]   = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<'all' | 'pending' | 'past'>('pending');

  useEffect(() => {
    if (!student?.class_id) { setLoading(false); return; }
    supabase.from('activities').select('id, title, type, subject, description, due_date, max_score, status')
      .eq('class_id', student.class_id).eq('status', 'published')
      .order('due_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => { setItems((data ?? []) as Activity[]); setLoading(false); });
  }, [student]);

  const today = new Date().toISOString().split('T')[0];
  const filtered = items.filter((a) => {
    if (filter === 'pending') return !a.due_date || a.due_date >= today;
    if (filter === 'past')    return !!a.due_date && a.due_date < today;
    return true;
  });

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-brand-primary dark:text-brand-secondary" /> Atividades
        </h1>
      </div>

      <div className="flex gap-2">
        {(['pending', 'all', 'past'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-brand-primary text-white dark:bg-brand-secondary dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
            {f === 'pending' ? 'Pendentes' : f === 'all' ? 'Todas' : 'Passadas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-primary dark:text-brand-secondary" /></div>
      ) : !filtered.length ? (
        <div className="text-center py-12 text-gray-400">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma atividade {filter === 'pending' ? 'pendente' : filter === 'past' ? 'passada' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const isLate = !!a.due_date && a.due_date < today;
            return (
              <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{a.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-brand-primary/10 dark:bg-brand-secondary/10 text-brand-primary dark:text-brand-secondary rounded-full text-xs">
                        {TYPE_LABELS[a.type] ?? a.type}
                      </span>
                      {a.subject && <span className="text-xs text-gray-500 dark:text-gray-400">{a.subject}</span>}
                      {a.max_score != null && <span className="text-xs text-gray-400">Valor: {a.max_score}</span>}
                    </div>
                    {a.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">{a.description}</p>}
                  </div>
                  {a.due_date && (
                    <span className={`flex items-center gap-1 text-xs flex-shrink-0 font-medium ${isLate ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      <Calendar className="w-3 h-3" /> {fmtDate(a.due_date)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
