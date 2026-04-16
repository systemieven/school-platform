/**
 * GuardianAuthContext
 * Handles authentication for the guardian portal (/responsavel/*).
 * Guardians log in with CPF + senha (Supabase Auth).
 * First-access flow: CPF → verify in student_guardians → set password → create auth user.
 *
 * Auth email convention: {cpf_sem_pontuacao}@responsavel.portal
 * Configurable via CLIENT_DEFAULTS.guardian?.email_suffix ?? '@responsavel.portal'
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { GuardianProfile } from '../../admin/types/admin.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentGuardian {
  id: string;
  student_id: string;
  guardian_cpf: string;
  guardian_user_id: string | null;
  relationship: string | null;
  is_primary: boolean;
  student?: {
    id: string;
    full_name: string;
    enrollment_number: string;
    class_id: string | null;
  } | null;
}

interface GuardianAuthState {
  session: Session | null;
  guardian: GuardianProfile | null;
  students: StudentGuardian[];
  currentStudentId: string | null;
  loading: boolean;
  signIn: (cpf: string, password: string) => Promise<{ error?: string }>;
  /** First-access: verify CPF in student_guardians, then create auth user and sign in */
  firstAccess: (cpf: string, newPassword: string) => Promise<{ error?: string }>;
  setCurrentStudent: (id: string) => void;
  signOut: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const GuardianAuthContext = createContext<GuardianAuthState>({
  session: null, guardian: null, students: [], currentStudentId: null, loading: true,
  signIn: async () => ({}),
  firstAccess: async () => ({}),
  setCurrentStudent: () => {},
  signOut: async () => {},
});

// ── Helpers ───────────────────────────────────────────────────────────────────

import { CLIENT_DEFAULTS } from '../../config/client';

// Fallback: use guardian email suffix if configured, else default
export const GUARDIAN_EMAIL_SUFFIX = (CLIENT_DEFAULTS as Record<string, unknown> & { guardian?: { email_suffix?: string } })
  .guardian?.email_suffix ?? '@responsavel.portal';

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function toEmail(cpf: string): string {
  return `${normalizeCpf(cpf)}${GUARDIAN_EMAIL_SUFFIX}`;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function GuardianAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]               = useState<Session | null>(null);
  const [guardian, setGuardian]             = useState<GuardianProfile | null>(null);
  const [students, setStudents]             = useState<StudentGuardian[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);

  const loadGuardian = useCallback(async (userId: string) => {
    const [profileRes, studentsRes] = await Promise.all([
      supabase
        .from('guardian_profiles')
        .select('id, name, cpf, phone, email, is_active, must_change_password, created_at, updated_at')
        .eq('id', userId)
        .single(),
      supabase
        .from('student_guardians')
        .select('id, student_id, guardian_cpf, guardian_user_id, relationship, is_primary, student:students(id, full_name, enrollment_number, class_id)')
        .eq('guardian_user_id', userId),
    ]);

    setGuardian(profileRes.data as GuardianProfile | null);
    const studentList = (studentsRes.data ?? []) as unknown as StudentGuardian[];
    setStudents(studentList);

    // Auto-select first student if none selected
    if (studentList.length > 0) {
      setCurrentStudentId((prev) => prev ?? studentList[0].student_id);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadGuardian(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) loadGuardian(s.user.id);
      else {
        setGuardian(null);
        setStudents([]);
        setCurrentStudentId(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadGuardian]);

  // ── signIn ─────────────────────────────────────────────────────────────────

  const signIn = useCallback(async (cpf: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(cpf),
      password,
    });
    if (error) return { error: 'CPF ou senha incorretos.' };
    return {};
  }, []);

  // ── firstAccess ────────────────────────────────────────────────────────────

  const firstAccess = useCallback(async (cpf: string, newPassword: string) => {
    const normalizedCpf = normalizeCpf(cpf);

    // 1. Verify CPF exists in student_guardians
    const { data: guardianRow, error: findErr } = await supabase
      .from('student_guardians')
      .select('id, guardian_cpf, guardian_user_id')
      .eq('guardian_cpf', normalizedCpf)
      .limit(1)
      .single();

    if (findErr || !guardianRow) {
      return { error: 'CPF não encontrado. Verifique o número e tente novamente.' };
    }

    // 2. If already has guardian_user_id, access already activated
    if ((guardianRow as { guardian_user_id: string | null }).guardian_user_id) {
      return { error: 'Este acesso já foi ativado. Use seu CPF e senha para entrar.' };
    }

    // 3. Create auth user
    const email = toEmail(normalizedCpf);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password: newPassword,
      options: { data: { role: 'responsavel', cpf: normalizedCpf } },
    });

    if (signUpErr || !signUpData.user) {
      return { error: signUpErr?.message ?? 'Erro ao criar acesso.' };
    }

    // 4. Link guardian_user_id in all student_guardians rows with this CPF
    await supabase
      .from('student_guardians')
      .update({ guardian_user_id: signUpData.user.id })
      .eq('guardian_cpf', normalizedCpf);

    return {};
  }, []);

  // ── setCurrentStudent ─────────────────────────────────────────────────────

  const setCurrentStudent = useCallback((id: string) => {
    setCurrentStudentId(id);
  }, []);

  // ── signOut ────────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setGuardian(null);
    setStudents([]);
    setCurrentStudentId(null);
  }, []);

  return (
    <GuardianAuthContext.Provider value={{
      session, guardian, students, currentStudentId, loading,
      signIn, firstAccess, setCurrentStudent, signOut,
    }}>
      {children}
    </GuardianAuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGuardian() {
  return useContext(GuardianAuthContext);
}
