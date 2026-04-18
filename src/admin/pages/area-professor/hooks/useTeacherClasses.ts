/**
 * useTeacherClasses
 *
 * Carrega as turmas do professor logado (role=teacher) a partir de
 * `class_disciplines`, com join em `disciplines` e `school_classes`,
 * agrupando disciplinas por turma.
 *
 * Fallback: se o professor não tem nenhuma disciplina vinculada, retorna
 * todas as turmas ativas sem disciplinas (mantém compat com a UI antiga
 * do /professor, que permitia coordenação visualizar qualquer turma).
 *
 * Extraído de `ProfessorAuthContext.loadTeacherClasses` (removido na
 * migração /professor → /admin/area-professor).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminAuth } from '../../../hooks/useAdminAuth';

export interface TeacherDiscipline {
  discipline_id: string;
  discipline_name: string;
  discipline_color: string;
  subject_id: string | null;
}

export interface TeacherClass {
  id: string;
  name: string;
  segment_id: string;
  year: number;
  shift: string | null;
  is_active: boolean;
  disciplines: TeacherDiscipline[];
  student_count?: number;
}

export function useTeacherClasses() {
  const { profile } = useAdminAuth();
  const teacherId = profile?.id ?? null;
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const { data: classDisc } = await supabase
      .from('class_disciplines')
      .select(`
        class_id,
        discipline_id,
        disciplines ( id, name, color, subject_id ),
        school_classes ( id, name, segment_id, year, shift, is_active )
      `)
      .eq('teacher_id', id);

    if (!classDisc || classDisc.length === 0) {
      const { data: scs } = await supabase
        .from('school_classes')
        .select('id, name, segment_id, year, shift, is_active')
        .eq('is_active', true)
        .order('name');

      setClasses(
        (scs ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          segment_id: c.segment_id,
          year: c.year,
          shift: c.shift,
          is_active: c.is_active,
          disciplines: [],
        })),
      );
      setLoading(false);
      return;
    }

    type SC = { id: string; name: string; segment_id: string; year: number; shift: string | null; is_active: boolean };
    type D = { id: string; name: string; color: string; subject_id: string | null };

    const classMap = new Map<string, TeacherClass>();
    for (const row of classDisc) {
      const scArr = row.school_classes as unknown as SC[] | SC | null;
      const sc: SC | null = Array.isArray(scArr) ? scArr[0] ?? null : scArr ?? null;
      const discArr = row.disciplines as unknown as D[] | D | null;
      const disc: D | null = Array.isArray(discArr) ? discArr[0] ?? null : discArr ?? null;
      if (!sc) continue;

      if (!classMap.has(sc.id)) {
        classMap.set(sc.id, {
          id: sc.id,
          name: sc.name,
          segment_id: sc.segment_id,
          year: sc.year,
          shift: sc.shift,
          is_active: sc.is_active,
          disciplines: [],
        });
      }

      if (disc) {
        classMap.get(sc.id)!.disciplines.push({
          discipline_id: disc.id,
          discipline_name: disc.name,
          discipline_color: disc.color,
          subject_id: disc.subject_id ?? null,
        });
      }
    }

    setClasses(Array.from(classMap.values()));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!teacherId) {
      setClasses([]);
      setLoading(false);
      return;
    }
    load(teacherId);
  }, [teacherId, load]);

  const refresh = useCallback(async () => {
    if (teacherId) await load(teacherId);
  }, [teacherId, load]);

  return { classes, loading, refresh };
}
