/**
 * StudentAuthContext
 * Handles authentication for the student portal (/portal/*).
 * Students log in with enrollment_number + password (Supabase Auth).
 * First-access flow: enrollment_number + guardian CPF → set own password.
 *
 * Auth email convention: {enrollment_number}{PORTAL_EMAIL_SUFFIX}
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentProfile {
  id: string;                  // students.id
  auth_user_id: string;
  enrollment_number: string;
  full_name: string;
  class_id: string | null;
  guardian_name: string;
  guardian_phone: string;
  birth_date: string | null;
}

interface StudentAuthState {
  session:  Session | null;
  student:  StudentProfile | null;
  /** Quando TRUE, ProtectedRoute redireciona para /portal/trocar-senha. Lido de students.must_change_password (migration 189). */
  mustChangePassword: boolean;
  loading:  boolean;
  signIn:   (enrollmentNumber: string, password: string) => Promise<{ error?: string }>;
  /** First-access: verify CPF, then set password and create auth user */
  firstAccess: (enrollmentNumber: string, guardianCpf: string, newPassword: string) => Promise<{ error?: string }>;
  signOut:  () => Promise<void>;
  /** Marca local após troca; evita refetch antes do redirect. */
  clearMustChangePassword: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const StudentAuthContext = createContext<StudentAuthState>({
  session: null, student: null, mustChangePassword: false, loading: true,
  signIn: async () => ({}),
  firstAccess: async () => ({}),
  signOut: async () => {},
  clearMustChangePassword: () => {},
});

// ── Helpers ───────────────────────────────────────────────────────────────────

import { CLIENT_DEFAULTS } from '../../config/client';

const PORTAL_EMAIL_SUFFIX = CLIENT_DEFAULTS.portal.email_suffix;

function toEmail(enrollmentNumber: string): string {
  return `${enrollmentNumber.trim().toLowerCase()}${PORTAL_EMAIL_SUFFIX}`;
}

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function StudentAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null);
  const [student, setStudent]   = useState<StudentProfile | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading]   = useState(true);

  const loadStudent = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('students')
      .select('id, auth_user_id, enrollment_number, full_name, class_id, guardian_name, guardian_phone, birth_date, must_change_password')
      .eq('auth_user_id', userId)
      .eq('status', 'active')
      .single();
    if (data) {
      const { must_change_password, ...rest } = data as StudentProfile & { must_change_password: boolean | null };
      setStudent(rest as StudentProfile);
      setMustChangePassword(Boolean(must_change_password));
    } else {
      setStudent(null);
      setMustChangePassword(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadStudent(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) loadStudent(s.user.id);
      else { setStudent(null); setMustChangePassword(false); }
    });
    return () => subscription.unsubscribe();
  }, [loadStudent]);

  // ── signIn ─────────────────────────────────────────────────────────────────

  const signIn = useCallback(async (enrollmentNumber: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email:    toEmail(enrollmentNumber),
      password,
    });
    if (error) return { error: 'Número de matrícula ou senha incorretos.' };
    return {};
  }, []);

  // ── firstAccess ────────────────────────────────────────────────────────────

  const firstAccess = useCallback(async (
    enrollmentNumber: string,
    guardianCpf: string,
    newPassword: string,
  ) => {
    const cpf = normalizeCpf(guardianCpf);

    // 1. Find the student record and verify guardian CPF
    const { data: studentRow, error: findErr } = await supabase
      .from('students')
      .select('id, auth_user_id, full_name, guardian_name')
      .eq('enrollment_number', enrollmentNumber.trim())
      .eq('status', 'active')
      .single();

    if (findErr || !studentRow) {
      return { error: 'Matrícula não encontrada. Verifique o número e tente novamente.' };
    }

    // 2. Verify CPF stored in students table (guardian_cpf column, if present)
    const { data: cpfCheck } = await supabase
      .from('students')
      .select('id')
      .eq('id', (studentRow as { id: string }).id)
      .eq('guardian_cpf', cpf)
      .single();

    if (!cpfCheck) {
      return { error: 'CPF do responsável não confere com o cadastro.' };
    }

    // 3. If already has auth_user_id, user already registered
    if ((studentRow as { auth_user_id: string | null }).auth_user_id) {
      return { error: 'Este acesso já foi ativado. Use seu número de matrícula e senha.' };
    }

    // 4. Create auth user
    const email = toEmail(enrollmentNumber);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password:    newPassword,
      options:     { data: { role: 'student', enrollment_number: enrollmentNumber } },
    });

    if (signUpErr || !signUpData.user) {
      return { error: signUpErr?.message ?? 'Erro ao criar acesso.' };
    }

    // 5. Link auth_user_id to student record
    await supabase
      .from('students')
      .update({ auth_user_id: signUpData.user.id })
      .eq('id', (studentRow as { id: string }).id);

    return {};
  }, []);

  // ── signOut ────────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStudent(null);
    setMustChangePassword(false);
  }, []);

  const clearMustChangePassword = useCallback(() => setMustChangePassword(false), []);

  return (
    <StudentAuthContext.Provider value={{
      session, student, mustChangePassword, loading,
      signIn, firstAccess, signOut, clearMustChangePassword,
    }}>
      {children}
    </StudentAuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStudentAuth() {
  return useContext(StudentAuthContext);
}
