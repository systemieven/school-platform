import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, Role } from '../types/admin.types';

interface AdminAuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

interface AdminAuthContextValue extends AdminAuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

export const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Fetch profile from profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
    return data as Profile;
  }, []);

  // Handle session changes
  const handleSession = useCallback(
    async (session: Session | null) => {
      if (!session?.user) {
        // Preserve any existing error (e.g. "no permission") when sign-out triggers this callback
        setState((prev) => ({ session: null, user: null, profile: null, loading: false, error: prev.error }));
        return;
      }

      const profile = await fetchProfile(session.user.id);

      if (!profile) {
        setState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          error: 'Perfil não encontrado. Entre em contato com o administrador.',
        });
        await supabase.auth.signOut();
        return;
      }

      if (!profile.is_active) {
        setState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          error: 'Sua conta está desativada. Entre em contato com o administrador.',
        });
        await supabase.auth.signOut();
        return;
      }

      const adminRoles: Role[] = ['super_admin', 'admin', 'coordinator', 'teacher', 'user'];
      if (!adminRoles.includes(profile.role)) {
        setState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          error: 'Você não possui permissão para acessar o painel administrativo.',
        });
        await supabase.auth.signOut();
        return;
      }

      setState({ session, user: session.user, profile, loading: false, error: null });
    },
    [fetchProfile],
  );

  // Bootstrap: check existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      handleSession(session);
      if (event === 'SIGNED_IN' && session?.user) {
        // Fire-and-forget: audit login after sign-in (profile name fetched inside log_audit RPC)
        logAudit({ action: 'login', module: 'auth', description: 'Login realizado' });
      }
    });

    return () => subscription.unsubscribe();
  }, [handleSession]);

  // Actions
  const signIn = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({
        ...s,
        loading: false,
        error: error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message,
      }));
    }
    // onAuthStateChange will handle the rest
  };

  const signOut = async () => {
    logAudit({ action: 'logout', module: 'auth', description: `Logout realizado: ${state.profile?.full_name ?? 'usuário'}` });
    await supabase.auth.signOut();
    setState({ session: null, user: null, profile: null, loading: false, error: null });
  };

  const hasRole = (...roles: Role[]) => {
    if (!state.profile) return false;
    return roles.includes(state.profile.role);
  };

  const isAdmin = state.profile ? ['super_admin', 'admin'].includes(state.profile.role) : false;

  const refreshProfile = async () => {
    if (!state.user) return;
    const profile = await fetchProfile(state.user.id);
    if (profile) setState((s) => ({ ...s, profile }));
  };

  return (
    <AdminAuthContext.Provider value={{ ...state, signIn, signOut, hasRole, isAdmin, refreshProfile }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
