/**
 * PortalChangePasswordPage
 *
 * Tela compartilhada de troca obrigatória de senha para os 3 portais
 * (aluno, responsável, professor). É renderizada quando o ProtectedRoute
 * detecta `mustChangePassword=true` e redireciona para `/{portal}/trocar-senha`.
 *
 * Reutiliza o mesmo edge function `change-password` usado no admin
 * (atualiza profiles/guardian_profiles/students em paralelo + grava
 * password_history). Usa também PasswordCriteriaChecker e a política
 * de senhas vigente em system_settings.
 *
 * Wrapper esperado: cada portal expõe contexto próprio (sessão, signOut e
 * `clearMustChangePassword`) e injeta aqui — não acoplamos ao contexto
 * para manter o componente neutro.
 */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, Lock, Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useBranding } from '../../contexts/BrandingContext';
import {
  PasswordCriteriaChecker,
  passwordMeetsCriteria,
} from '../../admin/components/PasswordCriteriaChecker';
import {
  DEFAULT_PASSWORD_POLICY,
  type PasswordPolicy,
} from '../../admin/types/admin.types';

interface Props {
  /** Nome amigável do portal — aparece no subtítulo. */
  roleLabel: string;
  /** Para onde redirecionar após sucesso (ex.: '/portal'). */
  redirectTo: string;
  /** Para onde mandar caso usuário clique "Sair". */
  loginPath: string;
  /** Indica se há sessão; sem sessão, redireciona para login. */
  hasSession: boolean;
  /** Aguarda contexto carregar antes de exibir form (evita flash). */
  loading: boolean;
  /** Callback do contexto local — limpa flag em memória. */
  onPasswordChanged: () => void;
  /** signOut do contexto local — usado no botão "Sair". */
  onSignOut: () => Promise<void>;
}

function PasswordInput({
  value, onChange, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary dark:focus:border-brand-secondary transition-colors disabled:opacity-50"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function PortalChangePasswordPage({
  roleLabel, redirectTo, loginPath,
  hasSession, loading,
  onPasswordChanged, onSignOut,
}: Props) {
  const { identity } = useBranding();
  const navigate = useNavigate();

  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [policy, setPolicy]       = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);

  // Carrega política
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'password_policy')
      .single()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'object') {
          setPolicy({ ...DEFAULT_PASSWORD_POLICY, ...(data.value as Partial<PasswordPolicy>) });
        }
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-primary to-[#002255] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!hasSession) {
    return <Navigate to={loginPath} replace />;
  }

  const newPwOk   = newPw.length > 0 && passwordMeetsCriteria(newPw, policy);
  const confirmOk = confirmPw.length > 0 && confirmPw === newPw;
  const canSubmit = newPwOk && confirmOk;

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('change-password', {
        body: { new_password: newPw },
      });
      if (fnErr || data?.error) {
        setError(data?.error ?? fnErr?.message ?? 'Erro ao alterar senha.');
        return;
      }
      setSaved(true);
      onPasswordChanged();
      setTimeout(() => navigate(redirectTo, { replace: true }), 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await onSignOut();
    navigate(loginPath, { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary to-[#002255] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">{identity.school_short_name || ''}</h1>
          <p className="text-white/60 text-sm mt-1">{roleLabel}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
              Defina uma nova senha
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Por segurança, é necessário trocar sua senha provisória antes de continuar.
            </p>
          </div>

          {/* Nova senha */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Nova senha
            </label>
            <PasswordInput
              value={newPw}
              onChange={setNewPw}
              placeholder="Digite a nova senha"
              disabled={saving || saved}
            />
            {newPw.length > 0 && (
              <PasswordCriteriaChecker password={newPw} policy={policy} />
            )}
          </div>

          {/* Confirmar */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Confirme a nova senha
            </label>
            <PasswordInput
              value={confirmPw}
              onChange={setConfirmPw}
              placeholder="Repita a nova senha"
              disabled={saving || saved}
            />
            {confirmPw.length > 0 && (
              <p className={`text-xs flex items-center gap-1.5 ${confirmOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                <span className={`inline-flex w-4 h-4 rounded-full items-center justify-center text-white text-[10px] font-bold ${confirmOk ? 'bg-emerald-500' : 'bg-red-400'}`}>
                  {confirmOk ? '✓' : '✗'}
                </span>
                {confirmOk ? 'As senhas coincidem' : 'As senhas não coincidem'}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Footer — Sair (esquerda) + Salvar (direita) */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSignOut}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSubmit || saved}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" />
               : saved  ? <Check className="w-4 h-4" />
                        : <ShieldCheck className="w-4 h-4" />}
              {saving ? 'Salvando…' : saved ? 'Senha alterada!' : 'Alterar senha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
