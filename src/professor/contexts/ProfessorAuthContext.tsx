/**
 * ProfessorAuthContext
 * Handles authentication for the teacher portal (/professor/*).
 * Teachers log in with email + password (Supabase Auth).
 * After login: fetches profiles where id = session.user.id AND role = 'teacher'
 * Also fetches the teacher's classes via class_disciplines.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfessorProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface TeacherDiscipline {
  discipline_id: string;
  discipline_name: string;
  discipline_color: string;
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

interface ProfessorAuthState {
  session: Session | null;
  professor: ProfessorProfile | null;
  teacherClasses: TeacherClass[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshClasses: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ProfessorAuthContext = createContext<ProfessorAuthState>({
  session: null,
  professor: null,
  teacherClasses: [],
  loading: true,
  signIn: async () => ({}),
  signOut: async () => {},
  refreshClasses: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProfessorAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]             = useState<Session | null>(null);
  const [professor, setProfessor]         = useState<ProfessorProfile | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading]             = useState(true);

  const loadTeacherClasses = useCallback(async (teacherId: string) => {
    // Fetch class_disciplines for this teacher with joined class and discipline info
    const { data: classDisc } = await supabase
      .from('class_disciplines')
      .select(`
        class_id,
        discipline_id,
        disciplines ( id, name, color ),
        school_classes ( id, name, segment_id, year, shift, is_active )
      `)
      .eq('teacher_id', teacherId);

    if (!classDisc || classDisc.length === 0) {
      // Fallback: fetch all active classes if no class_disciplines found
      const { data: classes } = await supabase
        .from('school_classes')
        .select('id, name, segment_id, year, shift, is_active')
        .eq('is_active', true)
        .order('name');

      setTeacherClasses(
        (classes ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          segment_id: c.segment_id,
          year: c.year,
          shift: c.shift,
          is_active: c.is_active,
          disciplines: [],
        }))
      );
      return;
    }

    // Group disciplines by class
    const classMap = new Map<string, TeacherClass>();
    for (const row of classDisc) {
      const scArr = row.school_classes as unknown as { id: string; name: string; segment_id: string; year: number; shift: string | null; is_active: boolean }[] | null;
      const sc = Array.isArray(scArr) ? scArr[0] : (scArr as unknown as { id: string; name: string; segment_id: string; year: number; shift: string | null; is_active: boolean } | null);
      const discArr = row.disciplines as unknown as { id: string; name: string; color: string }[] | null;
      const disc = Array.isArray(discArr) ? discArr[0] : (discArr as unknown as { id: string; name: string; color: string } | null);
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
        });
      }
    }

    setTeacherClasses(Array.from(classMap.values()));
  }, []);

  const loadProfessor = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role')
      .eq('id', userId)
      .eq('role', 'teacher')
      .single();

    if (!data) {
      setProfessor(null);
      return false;
    }

    setProfessor({
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      avatar_url: data.avatar_url,
    });
    await loadTeacherClasses(userId);
    return true;
  }, [loadTeacherClasses]);

  const refreshClasses = useCallback(async () => {
    if (session?.user?.id) {
      await loadTeacherClasses(session.user.id);
    }
  }, [session, loadTeacherClasses]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadProfessor(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        loadProfessor(s.user.id);
      } else {
        setProfessor(null);
        setTeacherClasses([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfessor]);

  // ── signIn ─────────────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'E-mail ou senha incorretos.' };

    // Verify the user has teacher role
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (!profile || profile.role !== 'teacher') {
        await supabase.auth.signOut();
        return { error: 'Acesso não autorizado. Este portal é exclusivo para professores.' };
      }
    }

    return {};
  }, []);

  // ── signOut ────────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfessor(null);
    setTeacherClasses([]);
  }, []);

  return (
    <ProfessorAuthContext.Provider
      value={{ session, professor, teacherClasses, loading, signIn, signOut, refreshClasses }}
    >
      {children}
    </ProfessorAuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProfessor() {
  return useContext(ProfessorAuthContext);
}
