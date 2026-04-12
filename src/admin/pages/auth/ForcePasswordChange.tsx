import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import type { PasswordPolicy } from '../../types/admin.types';
import { DEFAULT_PASSWORD_POLICY } from '../../types/admin.types';
import { PasswordCriteriaChecker, passwordMeetsCriteria } from '../../components/PasswordCriteriaChecker';
import { KeyRound, Eye, EyeOff, Loader2, Check } from 'lucide-react';

export default function ForcePasswordChange() {
  const { profile, refreshProfile } = useAdminAuth();
  const navigate     = useNavigate();

  const [policy, setPolicy]           = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [showConf, setShowConf]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [done, setDone]               = useState(false);

  // Load password policy from system_settings
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'password_policy')
      .single()
      .then(({ data }) => {
        if (data?.value) setPolicy({ ...DEFAULT_PASSWORD_POLICY, ...(data.value as Partial<PasswordPolicy>) });
      });
  }, []);

  // If the user no longer needs to change password, redirect to dashboard
  useEffect(() => {
    if (profile && !profile.must_change_password) {
      navigate('/admin', { replace: true });
    }
  }, [profile, navigate]);

  const meetsPolicy = passwordMeetsCriteria(newPassword, policy);
  const passwordsMatch = newPassword === confirm;
  const canSubmit = meetsPolicy && passwordsMatch && newPassword.length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSaving(true);

    const { data, error: fnError } = await supabase.functions.invoke('change-password', {
      body: { new_password: newPassword },
    });

    setSaving(false);

    if (fnError || data?.error) {
      setError(data?.error ?? fnError?.message ?? 'Erro ao alterar senha.');
      return;
    }

    setDone(true);
    // Refresh profile so must_change_password becomes false in context
    await refreshProfile();
    setTimeout(() => navigate('/admin', { replace: true }), 1200);
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary via-brand-primary-dark to-[#001133] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-primary-dark px-6 py-5 text-white text-center">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="font-display font-bold text-lg">Alterar Senha</h1>
          <p className="text-xs text-white/70 mt-1">
            Bem-vindo(a), {profile?.full_name?.split(' ')[0] ?? 'usuário'}! Crie uma nova senha para continuar.
          </p>
        </div>

        <div className="p-6">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                Senha alterada com sucesso! Redirecionando…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              {/* New password */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite sua nova senha"
                    className={`${inputCls} pr-11`}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordCriteriaChecker password={newPassword} policy={policy} />
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <input
                    type={showConf ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a nova senha"
                    className={`${inputCls} pr-11 ${
                      confirm.length > 0 && !passwordsMatch
                        ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                        : ''
                    }`}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConf((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-500 mt-1.5">As senhas não conferem.</p>
                )}
                {confirm.length > 0 && passwordsMatch && newPassword.length > 0 && (
                  <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Senhas conferem
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Alterando…
                  </>
                ) : (
                  'Definir nova senha'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
