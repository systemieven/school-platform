/**
 * RhSettingsPanel
 *
 * Painel da aba "RH" em /admin/configuracoes.
 * Edita APENAS os parâmetros operacionais do módulo de captação
 * (rate-limit do endpoint público e tamanho máximo do upload de CV).
 *
 * O conteúdo editorial da página /trabalhe-conosco (áreas de atuação,
 * textos da reserva/LGPD) vive em /admin/configuracoes → Site → Conteúdo → Vagas.
 * O hero (badge, título, palavra em destaque, slideshow) vive em
 * /admin/configuracoes → Site → Aparência → Vagas.
 *
 * Persiste em `system_settings` (category='content', key='careers').
 * Faz merge com o valor atual para não sobrescrever fatias editadas
 * em outros painéis.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Gauge } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';
const labelCls =
  'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

type RhParams = {
  rate_limit: number;
  max_upload_mb: number;
};

const DEFAULT: RhParams = {
  rate_limit: 10,
  max_upload_mb: 5,
};

export default function RhSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RhParams>(DEFAULT);
  const [original, setOriginal] = useState<string>(JSON.stringify(DEFAULT));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = JSON.stringify(data) !== original;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: row } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'content')
      .eq('key', 'careers')
      .maybeSingle();

    let merged: RhParams = DEFAULT;
    if (row?.value) {
      try {
        const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        merged = {
          rate_limit: Number(parsed?.rate_limit) || DEFAULT.rate_limit,
          max_upload_mb: Number(parsed?.max_upload_mb) || DEFAULT.max_upload_mb,
        };
      } catch { /* keep defaults */ }
    }
    setData(merged);
    setOriginal(JSON.stringify(merged));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);

    // Re-lê o valor atual e faz overlay só dos campos desta aba — evita
    // clobber da fatia editorial gerenciada por Site → Conteúdo → Vagas.
    const { data: row } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'content')
      .eq('key', 'careers')
      .maybeSingle();

    let current: Record<string, unknown> = {};
    if (row?.value) {
      try {
        current = typeof row.value === 'string' ? JSON.parse(row.value) : (row.value as Record<string, unknown>);
      } catch { /* ignore */ }
    }

    const next = {
      ...current,
      rate_limit: data.rate_limit,
      max_upload_mb: data.max_upload_mb,
    };

    await supabase.from('system_settings').upsert(
      { category: 'content', key: 'careers', value: next, updated_at: new Date().toISOString() },
      { onConflict: 'category,key' },
    );
    logAudit({ action: 'update', module: 'settings', description: 'Parâmetros de captação (RH) atualizados' });
    setSaving(false);
    setSaved(true);
    setOriginal(JSON.stringify(data));
    setTimeout(() => setSaved(false), 900);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <SettingsCard
        title="Parâmetros de captação"
        description="Limites operacionais do endpoint público /trabalhe-conosco. Para editar textos, áreas de atuação e hero da página, use Site → Conteúdo → Vagas e Site → Aparência → Vagas."
        icon={Gauge}
        collapseId="rh-params"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Rate-limit (envios por IP/hora)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={data.rate_limit}
              onChange={(e) => setData((d) => ({ ...d, rate_limit: Number(e.target.value) || 1 }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tamanho máximo do CV (MB)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={data.max_upload_mb}
              onChange={(e) => setData((d) => ({ ...d, max_upload_mb: Number(e.target.value) || 1 }))}
              className={inputCls}
            />
          </div>
        </div>
      </SettingsCard>

      {/* Floating save */}
      <div
        className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
          isDirty || saving || saved
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (!isDirty && !saved)}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Gauge className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
