/**
 * ChangePasswordDrawer
 *
 * Lets the logged-in user change their own password.
 *
 * Flow:
 *  1. User types current password → verified via supabase.auth.signInWithPassword
 *  2. User types new password → live criteria checker from system_settings
 *  3. User confirms new password → must match
 *  4. On submit → calls Edge Function `change-password`
 */
import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { DEFAULT_PASSWORD_POLICY, type PasswordPolicy } from '../types/admin.types';
import { Drawer, DrawerCard } from './Drawer';
import { PasswordCriteriaChecker, passwordMeetsCriteria } from './PasswordCriteriaChecker';

interface Props {
  open: boolean;
  onClose: () => void;
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
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
        className="w-full pl-9 pr-10 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary dark:focus:border-brand-secondary transition-colors disabled:opacity-50"
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

export default function ChangePasswordDrawer({ open, onClose }: Props) {
  const { user } = useAdminAuth();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const [policy,  setPolicy]  = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [saved,   setSaved]   = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setError(null);
      setSaved(false);
    }
  }, [open]);

  // Load password policy from system_settings
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const newPwOk     = newPw.length > 0 && passwordMeetsCriteria(newPw, policy);
  const confirmOk   = confirmPw.length > 0 && confirmPw === newPw;
  const canSubmit   = currentPw.length > 0 && newPwOk && confirmOk;

  async function handleSave() {
    if (!user?.email || !canSubmit) return;
    setSaving(true);
    setError(null);

    try {
      // 1. Verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    user.email,
        password: currentPw,
      });
      if (signInErr) {
        setError('Senha atual incorreta. Verifique e tente novamente.');
        return;
      }

      // 2. Call change-password Edge Function
      const { data, error: fnErr } = await supabase.functions.invoke('change-password', {
        body: { new_password: newPw },
      });

      if (fnErr || data?.error) {
        setError(data?.error ?? fnErr?.message ?? 'Erro ao alterar senha.');
        return;
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1400);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Alterar senha"
      icon={KeyRound}
      width="w-[420px]"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSubmit || saved}
            className="flex-1 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando…</>
            ) : saved ? (
              'Senha alterada!'
            ) : (
              'Alterar senha'
            )}
          </button>
        </div>
      }
    >
      {/* ── Senha Atual ── */}
      <DrawerCard title="Senha Atual" icon={Lock}>
        <PasswordInput
          value={currentPw}
          onChange={setCurrentPw}
          placeholder="Digite sua senha atual"
          disabled={saving}
        />
      </DrawerCard>

      {/* ── Nova Senha ── */}
      <DrawerCard title="Nova Senha" icon={ShieldCheck}>
        <div className="space-y-2">
          <PasswordInput
            value={newPw}
            onChange={setNewPw}
            placeholder="Digite a nova senha"
            disabled={saving}
          />
          {newPw.length > 0 && (
            <PasswordCriteriaChecker password={newPw} policy={policy} />
          )}
        </div>
      </DrawerCard>

      {/* ── Confirmar Nova Senha ── */}
      <DrawerCard title="Confirmar Nova Senha" icon={ShieldCheck}>
        <div className="space-y-2">
          <PasswordInput
            value={confirmPw}
            onChange={setConfirmPw}
            placeholder="Repita a nova senha"
            disabled={saving}
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
      </DrawerCard>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </Drawer>
  );
}
