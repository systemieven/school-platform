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
  /** Quando TRUE, ProtectedRoute redireciona para /responsavel/trocar-senha. Lido de guardian_profiles.must_change_password (migration 075). */
  mustChangePassword: boolean;
  loading: boolean;
  signIn: (cpf: string, password: string) => Promise<{ error?: string }>;
  /**
   * First-access / esqueci-a-senha: valida CPF + telefone em student_guardians,
   * cria (ou reseta) auth user com senha provisória e dispara WhatsApp.
   * O fluxo segue o mesmo padrão da criação de usuários do admin
   * (must_change_password=true → portal força tela de troca após login).
   */
  requestAccess: (cpf: string, phone: string) => Promise<{
    status: 'sent' | 'no_whatsapp' | 'rate_limited' | 'invalid_input' | 'error';
    message?: string;
  }>;
  setCurrentStudent: (id: string) => void;
  signOut: () => Promise<void>;
  clearMustChangePassword: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const GuardianAuthContext = createContext<GuardianAuthState>({
  session: null, guardian: null, students: [], currentStudentId: null,
  mustChangePassword: false, loading: true,
  signIn: async () => ({}),
  requestAccess: async () => ({ status: 'error' }),
  setCurrentStudent: () => {},
  signOut: async () => {},
  clearMustChangePassword: () => {},
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
  const [mustChangePassword, setMustChangePassword] = useState(false);
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

    const profile = profileRes.data as (GuardianProfile & { must_change_password?: boolean | null }) | null;
    setGuardian(profile);
    setMustChangePassword(Boolean(profile?.must_change_password));
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
        setMustChangePassword(false);
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

  // ── requestAccess ──────────────────────────────────────────────────────────
  // Chama edge function pública `guardian-request-access`. Toda a validação
  // (CPF + telefone), criação/reset de auth user, geração de senha provisória
  // e disparo do WhatsApp ocorre no servidor — anti-enumeração e rate-limit
  // ficam fora do alcance do client.

  const requestAccess = useCallback(async (cpf: string, phone: string) => {
    const normalizedCpf = normalizeCpf(cpf);
    const systemUrl = window.location.origin + '/responsavel/login';

    try {
      const { data, error } = await supabase.functions.invoke('guardian-request-access', {
        body: { cpf: normalizedCpf, phone, system_url: systemUrl },
      });

      if (error) {
        return { status: 'error' as const, message: error.message };
      }
      const payload = (data ?? {}) as { status?: string; message?: string };
      const status = (payload.status as
        | 'sent'
        | 'no_whatsapp'
        | 'rate_limited'
        | 'invalid_input'
        | 'error'
        | undefined) ?? 'error';
      return { status, message: payload.message };
    } catch (err: unknown) {
      return {
        status: 'error' as const,
        message: err instanceof Error ? err.message : 'Erro inesperado.',
      };
    }
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
    setMustChangePassword(false);
  }, []);

  const clearMustChangePassword = useCallback(() => setMustChangePassword(false), []);

  return (
    <GuardianAuthContext.Provider value={{
      session, guardian, students, currentStudentId,
      mustChangePassword, loading,
      signIn, requestAccess, setCurrentStudent, signOut, clearMustChangePassword,
    }}>
      {children}
    </GuardianAuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGuardian() {
  return useContext(GuardianAuthContext);
}
