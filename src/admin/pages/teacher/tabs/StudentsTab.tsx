import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { SchoolClass, Student } from '../../../types/admin.types';
import { STUDENT_STATUS_LABELS } from '../../../types/admin.types';
import { Loader2, User } from 'lucide-react';

export default function StudentsTab({ cls }: { cls: SchoolClass }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('students')
      .select('*')
      .eq('class_id', cls.id)
      .order('full_name')
      .then(({ data }) => { setStudents((data ?? []) as Student[]); setLoading(false); });
  }, [cls.id]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  if (!students.length) return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
      <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">Nenhum aluno nesta turma.</p>
    </div>
  );

  const statusColors: Record<string, string> = {
    active:      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    transferred: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    graduated:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    inactive:    'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Aluno</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Matrícula</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Responsável</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-primary/10 dark:bg-brand-secondary/10 flex items-center justify-center text-xs font-bold text-brand-primary dark:text-brand-secondary flex-shrink-0">
                    {s.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{s.full_name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{s.enrollment_number}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.guardian_name}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] ?? ''}`}>
                  {STUDENT_STATUS_LABELS[s.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
