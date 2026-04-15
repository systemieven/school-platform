import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import { Loader2, BookOpen, ExternalLink } from 'lucide-react';

interface LibraryItem {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  url: string | null;
  subject?: { id: string; name: string } | null;
  created_at: string;
}

export default function BibliotecaPage() {
  const { currentStudentId, students } = useGuardian();
  const [items, setItems]     = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const currentStudent = students.find((s) => s.student_id === currentStudentId);
  const classId = currentStudent?.student?.class_id;

  useEffect(() => {
    if (!classId) { setLoading(false); return; }

    supabase
      .from('library_items')
      .select('id, title, description, type, url, subject:school_subjects(id, name), created_at')
      .or(`class_id.eq.${classId},class_id.is.null`)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as unknown as LibraryItem[]);
        setLoading(false);
      });
  }, [classId]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Biblioteca
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Materiais e recursos de estudo da turma.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum material disponível.</p>
          <p className="text-xs mt-1">Materiais de estudo disponibilizados pelos professores aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/5 dark:bg-brand-secondary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.title}</p>
                  {item.subject && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(item.subject as { name: string }).name}
                    </p>
                  )}
                </div>
              </div>
              {item.description && (
                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{item.description}</p>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center gap-1.5 text-xs font-medium text-brand-primary dark:text-brand-secondary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Acessar material
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
