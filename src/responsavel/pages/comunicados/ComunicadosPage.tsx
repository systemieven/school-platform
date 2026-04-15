import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import { Loader2, Megaphone } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  publish_at: string;
  is_published: boolean;
}

export default function ComunicadosPage() {
  const { currentStudentId, students } = useGuardian();
  const [items, setItems]     = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const currentStudent = students.find((s) => s.student_id === currentStudentId);
  const classId = currentStudent?.student?.class_id;

  useEffect(() => {
    if (!classId) { setLoading(false); return; }

    supabase
      .from('announcements')
      .select('id, title, content, publish_at, is_published')
      .eq('is_published', true)
      .or(`target_type.eq.all,and(target_type.eq.class,target_ids.cs.{${classId}})`)
      .order('publish_at', { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as Announcement[]);
        setLoading(false);
      });
  }, [classId]);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Megaphone className="w-5 h-5" /> Comunicados
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Comunicados da escola para a turma.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum comunicado disponível.</p>
          <p className="text-xs mt-1">Comunicados publicados pela escola aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="w-full text-left px-5 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(item.publish_at)}</p>
                  </div>
                  <span className="text-gray-400 text-xs flex-shrink-0 mt-0.5">
                    {expanded === item.id ? 'Recolher' : 'Ver mais'}
                  </span>
                </div>
              </button>
              {expanded === item.id && (
                <div className="px-5 pb-4 border-t border-gray-50 dark:border-gray-700 pt-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
