import { useState, useEffect } from 'react';
import { Loader2, Check, ShieldAlert, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';

// ── Types ──────────────────────────────────────────────────────────────────

interface MaintenanceSettings {
  maintenance_mode:    boolean;
  maintenance_message: string;
}

const DEFAULTS: MaintenanceSettings = {
  maintenance_mode:    false,
  maintenance_message: 'Estamos realizando melhorias no site. Voltaremos em breve!',
};

// ── Component ───────────────────────────────────────────────────────────────

export default function MaintenanceSettingsPanel() {
  const [form, setForm]       = useState<MaintenanceSettings>(DEFAULTS);
  const [initial, setInitial] = useState<MaintenanceSettings>(DEFAULTS);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  // Load
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'general')
      .in('key', ['maintenance_mode', 'maintenance_message'])
      .then(({ data }) => {
        if (!data) return;
        const merged: MaintenanceSettings = { ...DEFAULTS };
        for (const row of data) {
          if (row.key === 'maintenance_mode') {
            merged.maintenance_mode = row.value === true || row.value === 'true';
          }
          if (row.key === 'maintenance_message' && typeof row.value === 'string') {
            merged.maintenance_message = row.value;
          }
        }
        setForm(merged);
        setInitial(merged);
        setLoading(false);
      });
  }, []);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  async function handleSave() {
    if (saving || saved) return;
    setSaving(true);

    const upserts = [
      { category: 'general', key: 'maintenance_mode',    value: String(form.maintenance_mode) },
      { category: 'general', key: 'maintenance_message', value: form.maintenance_message.trim() },
    ];

    for (const row of upserts) {
      await supabase
        .from('system_settings')
        .upsert(row, { onConflict: 'category,key' });
    }

    setSaving(false);
    setSaved(true);
    setInitial(form);
    setTimeout(() => setSaved(false), 900);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Maintenance Toggle */}
      <SettingsCard
        title="Modo de Manutenção"
        description="Quando ativado, o site público exibe uma página de manutenção. O painel administrativo, portais e módulo de atendimento continuam acessíveis normalmente."
      >
        <div className="flex items-center justify-between gap-4 p-1">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Desativar o site público
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Visitantes verão a página de manutenção
            </p>
          </div>
          <Toggle
            checked={form.maintenance_mode}
            onChange={(v: boolean) => setForm((prev) => ({ ...prev, maintenance_mode: v }))}
            onColor={form.maintenance_mode ? 'bg-amber-500' : 'bg-emerald-500'}
          />
        </div>

        {form.maintenance_mode && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              O site público está desativado. Apenas administradores e usuários internos conseguem acessar o sistema.
            </span>
          </div>
        )}
      </SettingsCard>

      {/* Custom message */}
      <SettingsCard
        title="Mensagem de Manutenção"
        description="Texto exibido para os visitantes durante o período de manutenção."
      >
        <textarea
          rows={3}
          value={form.maintenance_message}
          onChange={(e) => setForm((prev) => ({ ...prev, maintenance_message: e.target.value }))}
          placeholder="Estamos realizando melhorias no site. Voltaremos em breve!"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Os dados de contato (telefone, e-mail, WhatsApp) são exibidos automaticamente a partir das configurações institucionais.
        </p>
      </SettingsCard>

      {/* Floating save — same pattern as all other settings panels */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        isDirty || saving || saved
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
