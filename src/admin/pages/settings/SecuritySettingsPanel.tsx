import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { PasswordPolicy } from '../../types/admin.types';
import { DEFAULT_PASSWORD_POLICY } from '../../types/admin.types';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';
import { PasswordCriteriaChecker } from '../../components/PasswordCriteriaChecker';
import { Save, Loader2, Check, Lock, Clock, History } from 'lucide-react';

// ── Slider ────────────────────────────────────────────────────────────────────
interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  formatLabel?: (v: number) => string;
  zeroLabel?: string;
}

function Slider({ value, min, max, step = 1, onChange, formatLabel, zeroLabel }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const label = value === 0 && zeroLabel ? zeroLabel : (formatLabel ? formatLabel(value) : String(value));

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 h-5 flex items-center">
        {/* Track background */}
        <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-[#003876] dark:bg-[#ffd700] rounded-full transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Native range (invisible, on top) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        {/* Thumb */}
        <div
          className="absolute w-5 h-5 rounded-full bg-white border-2 border-[#003876] dark:border-[#ffd700] shadow-md pointer-events-none transition-all duration-150"
          style={{ left: `calc(${pct}% - ${pct * 0.16}px)` }}
        />
      </div>
      {/* Value badge */}
      <span className="text-xs font-semibold text-[#003876] dark:text-[#ffd700] bg-[#003876]/10 dark:bg-[#ffd700]/10 px-2.5 py-1 rounded-xl min-w-[52px] text-center tabular-nums whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export default function SecuritySettingsPanel() {
  const [policy, setPolicy]     = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [original, setOriginal] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('id, value')
      .eq('category', 'security')
      .eq('key', 'password_policy')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const loaded = { ...DEFAULT_PASSWORD_POLICY, ...(data.value as Partial<PasswordPolicy>) };
          setPolicy(loaded);
          setOriginal(loaded);
          setSettingId(data.id as string);
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
    let error;

    if (settingId) {
      // Row already exists — update by id
      ({ error } = await supabase
        .from('system_settings')
        .update({ value: policy as unknown as Record<string, unknown> })
        .eq('id', settingId));
    } else {
      // First save — insert
      const { data, error: insertErr } = await supabase
        .from('system_settings')
        .insert({ category: 'security', key: 'password_policy', value: policy as unknown as Record<string, unknown> })
        .select('id')
        .single();
      error = insertErr;
      if (data) setSettingId((data as { id: string }).id);
    }

    setSaving(false);
    if (!error) {
      setOriginal(policy);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
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
      <SettingsCard collapseId="security.complexity" title="Critérios de Complexidade" icon={Lock}>
        {/* Min length slider */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Mínimo de caracteres
          </label>
          <Slider
            value={policy.min_length}
            min={4}
            max={32}
            onChange={(v) => set('min_length', v)}
            formatLabel={(v) => `${v} car.`}
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
              <Toggle checked={policy[key] as boolean} onChange={(v) => set(key, v)} />
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 mb-2">
            Pré-visualização dos critérios
          </p>
          <PasswordCriteriaChecker password="" policy={policy} />
          <p className="text-[11px] text-gray-400 mt-2 italic">
            Os critérios acima serão exibidos ao usuário ao criar uma nova senha.
          </p>
        </div>
      </SettingsCard>

      {/* Lifetime */}
      <SettingsCard collapseId="security.lifetime" title="Tempo de Vida da Senha" icon={Clock} description="0 = sem expiração automática">
        <Slider
          value={policy.password_lifetime_days}
          min={0}
          max={360}
          step={30}
          onChange={(v) => set('password_lifetime_days', v)}
          formatLabel={(v) => `${v} dias`}
          zeroLabel="Nunca"
        />
        <p className="text-xs text-gray-400">
          Quando expirar, o usuário será forçado a alterar a senha no próximo login.
        </p>
      </SettingsCard>

      {/* History */}
      <SettingsCard collapseId="security.history" title="Reutilização de Senhas" icon={History} description="0 = sem restrição">
        <Slider
          value={policy.password_history_count}
          min={0}
          max={24}
          onChange={(v) => set('password_history_count', v)}
          formatLabel={(v) => `${v} senha${v !== 1 ? 's' : ''}`}
          zeroLabel="Livre"
        />
        <p className="text-xs text-gray-400">
          Impede que o usuário reutilize as últimas N senhas ao realizar uma alteração.
        </p>
      </SettingsCard>

      {/* Floating save */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-[#003876] text-white hover:bg-[#002855] shadow-[#003876]/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
