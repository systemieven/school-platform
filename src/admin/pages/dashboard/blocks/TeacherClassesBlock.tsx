/**
 * TeacherClassesBlock
 *
 * Lista as turmas atribuídas ao professor logado. Para
 * super_admin/admin/coordinator mostra contagem total de turmas
 * ativas. Visível para usuários com `canView('teacher-area')`.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { BlockCard, BlockEmpty } from './BlockCard';

interface ClassRow {
  id: string;
  name: string;
  school_year: number | null;
  shift: string | null;
}

export function TeacherClassesBlock() {
  const { canView } = usePermissions();
  const { profile, hasRole } = useAdminAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('teacher-area') || !profile) return;
    let active = true;
    (async () => {
      let q = supabase
        .from('school_classes')
        .select('id,name,school_year,shift')
        .eq('is_active', true);
      // Professor só vê suas turmas; coordenação/admin vê tudo.
      if (!hasRole('super_admin', 'admin', 'coordinator')) {
        q = q.contains('teacher_ids', [profile.id]);
      }
      const { data } = await q.order('name').limit(6);
      if (!active) return;
      setClasses(((data as ClassRow[] | null) ?? []));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView, profile, hasRole]);

  if (!canView('teacher-area')) return null;

  return (
    <BlockCard title="Minhas turmas" icon={BookOpen} linkTo="/admin/area-professor" loading={loading}>
      {classes.length === 0 ? (
        <BlockEmpty message="Nenhuma turma atribuída" />
      ) : (
        <ul className="space-y-1.5">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                to="/admin/area-professor"
                className="flex items-center justify-between text-xs hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-md px-2 py-1.5 -mx-2 transition-colors"
              >
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">{c.name}</span>
                <span className="text-gray-400 ml-2 flex-shrink-0">
                  {c.school_year ?? ''}{c.shift ? ` · ${c.shift}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  );
}
