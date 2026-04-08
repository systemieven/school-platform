import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { Loader2, Megaphone, Calendar } from 'lucide-react';

interface Announcement {
  id: string; title: string; body: string; publish_at: string;
  target_type: string;
}

export default function PortalAnnouncementsPage() {
  const { student } = useStudentAuth();
  const [items,   setItems]   = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!student?.class_id) { setLoading(false); return; }
    const cid = student.class_id;
    supabase.from('announcements').select('id, title, body, publish_at, target_type')
      .eq('is_published', true)
      .or(`target_type.eq.all,and(target_type.eq.class,target_ids.cs.{${cid}})`)
      .order('publish_at', { ascending: false })
      .then(({ data }) => { setItems((data ?? []) as Announcement[]); setLoading(false); });
  }, [student]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-[#003876] dark:text-[#ffd700]" /> Comunicados
      </h1>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#003876] dark:text-[#ffd700]" /></div>
      ) : !items.length ? (
        <div className="text-center py-12 text-gray-400">
          <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum comunicado disponível.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <button className="w-full text-left px-4 py-3"
                onClick={() => setExpanded((p) => p === a.id ? null : a.id)}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{a.title}</p>
                  <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Calendar className="w-3 h-3" />
                    {new Date(a.publish_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                {expanded !== a.id && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{a.body}</p>
                )}
              </button>
              {expanded === a.id && (
                <div className="px-4 pb-4 border-t border-gray-50 dark:border-gray-700 pt-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{a.body}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
