/**
 * SecuritySettingsPanel
 *
 * Renders inside SettingsPage > Segurança tab.
 * Loads / saves the `password_policy` key from system_settings.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { PasswordPolicy } from '../../types/admin.types';
import { DEFAULT_PASSWORD_POLICY } from '../../types/admin.types';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';
import { PasswordCriteriaChecker } from '../../components/PasswordCriteriaChecker';
import {
  Shield, Save, Loader2, Check, Lock, Clock, History,
  AlignLeft,
} from 'lucide-react';

const inputCls =
  'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none transition-all';

export default function SecuritySettingsPanel() {
  const [policy, setPolicy]     = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [original, setOriginal] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'password_policy')
      .single()
      .then(({ data }) => {
        if (data?.value) {
          const loaded = { ...DEFAULT_PASSWORD_POLICY, ...(data.value as Partial<PasswordPolicy>) };
          setPolicy(loaded);
          setOriginal(loaded);
        }
        setLoading(false);
      });
  }, []);

  function set<K extends keyof PasswordPolicy>(key: K, value: PasswordPolicy[K]) {
    setPolicy((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  const hasChanges = JSON.stringify(policy) !== JSON.stringify(original);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'password_policy', category: 'security', value: policy as unknown as Record<string, unknown> }, { onConflict: 'key' });
    setSaving(false);
    if (!error) {
      setOriginal(policy);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Complexity */}
      <SettingsCard title="Critérios de Complexidade" icon={Lock}>
        {/* Min length */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Mínimo de caracteres
          </label>
          <input
            type="number"
            min={4}
            max={64}
            value={policy.min_length}
            onChange={(e) => set('min_length', Math.max(4, Number(e.target.value)))}
            className={`${inputCls} w-28`}
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-1">
          {(
            [
              ['require_uppercase', 'Exigir letras maiúsculas (A–Z)'],
              ['require_lowercase', 'Exigir letras minúsculas (a–z)'],
              ['require_numbers',   'Exigir números (0–9)'],
              ['require_special',   'Exigir caracteres especiais (!@#$…)'],
            ] as [keyof PasswordPolicy, string][]
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              <Toggle
                checked={policy[key] as boolean}
                onChange={(v) => set(key, v)}
              />
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Pré-visualização dos critérios
          </p>
          <PasswordCriteriaChecker password="" policy={policy} />
          <p className="text-[11px] text-gray-400 mt-2 italic">
            Os critérios acima serão exibidos ao usuário no momento de criar uma nova senha.
          </p>
        </div>
      </SettingsCard>

      {/* Lifetime */}
      <SettingsCard title="Tempo de Vida da Senha" icon={Clock}
        description="0 = sem expiração automática">
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Validade (dias)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={365}
              value={policy.password_lifetime_days}
              onChange={(e) => set('password_lifetime_days', Math.max(0, Number(e.target.value)))}
              className={`${inputCls} w-28`}
            />
            {policy.password_lifetime_days > 0 ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-full px-2.5 py-0.5">
                Expira a cada {policy.password_lifetime_days} dia(s)
              </span>
            ) : (
              <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2.5 py-0.5">
                Sem expiração
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Quando a senha expira, o usuário é forçado a alterá-la no próximo login.
          </p>
        </div>
      </SettingsCard>

      {/* History */}
      <SettingsCard title="Reutilização de Senhas" icon={History}
        description="0 = sem restrição de reutilização">
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Número de senhas anteriores bloqueadas
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={24}
              value={policy.password_history_count}
              onChange={(e) => set('password_history_count', Math.max(0, Number(e.target.value)))}
              className={`${inputCls} w-28`}
            />
            {policy.password_history_count > 0 ? (
              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-full px-2.5 py-0.5">
                Bloqueia as últimas {policy.password_history_count} senha(s)
              </span>
            ) : (
              <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2.5 py-0.5">
                Sem restrição
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            O sistema impedirá que o usuário reutilize senhas recentes ao alterar a senha.
          </p>
        </div>
      </SettingsCard>

      {/* Summary */}
      <SettingsCard title="Resumo da Política Atual" icon={AlignLeft}>
        <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
          <li>• Mínimo de <strong className="text-gray-800 dark:text-gray-200">{policy.min_length}</strong> caracteres</li>
          {policy.require_uppercase && <li>• Letras maiúsculas obrigatórias</li>}
          {policy.require_lowercase && <li>• Letras minúsculas obrigatórias</li>}
          {policy.require_numbers   && <li>• Números obrigatórios</li>}
          {policy.require_special   && <li>• Caracteres especiais obrigatórios</li>}
          {!policy.require_uppercase && !policy.require_lowercase && !policy.require_numbers && !policy.require_special && (
            <li className="text-gray-400 italic">• Nenhuma regra de complexidade adicional</li>
          )}
          <li>• Expiração: {policy.password_lifetime_days > 0 ? `${policy.password_lifetime_days} dias` : 'nunca'}</li>
          <li>• Histórico: {policy.password_history_count > 0 ? `${policy.password_history_count} senha(s) bloqueadas` : 'sem restrição'}</li>
        </ul>
      </SettingsCard>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 bg-[#003876] hover:bg-[#002855] text-white"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</>
          ) : saved ? (
            <><Check className="w-4 h-4" />Salvo!</>
          ) : (
            <><Save className="w-4 h-4" />Salvar Configurações</>
          )}
        </button>
      </div>
    </div>
  );
}
