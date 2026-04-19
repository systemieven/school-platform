/**
 * RhSettingsPanel
 *
 * Painel da aba "RH" em /admin/configuracoes.
 * Edita o conteúdo da página pública /trabalhe-conosco e os parâmetros
 * do módulo de captação (rate-limit, tamanho máximo do CV).
 *
 * Persiste em `system_settings` na chave (category='content', key='careers'),
 * com valor JSONB no formato:
 *
 *   {
 *     "hero":  { "title": string, "subtitle": string, "image_url"?: string },
 *     "areas": {
 *       "pedagogica":      { "title": string, "description": string },
 *       "administrativa":  { "title": string, "description": string },
 *       "servicos_gerais": { "title": string, "description": string }
 *     },
 *     "reserva_copy": string,
 *     "lgpd_text":    string,
 *     "rate_limit":   number,
 *     "max_upload_mb": number
 *   }
 */
import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Image as ImageIcon, FileText, Loader2, Check, Gauge } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';
const labelCls =
  'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

type AreaContent = { title: string; description: string };
type CareersContent = {
  hero:  { title: string; subtitle: string; image_url?: string };
  areas: Record<'pedagogica' | 'administrativa' | 'servicos_gerais', AreaContent>;
  reserva_copy: string;
  lgpd_text:    string;
  rate_limit:   number;
  max_upload_mb: number;
};

const DEFAULT: CareersContent = {
  hero: { title: 'Trabalhe conosco', subtitle: '', image_url: '' },
  areas: {
    pedagogica:      { title: 'Pedagógica',        description: '' },
    administrativa:  { title: 'Administrativa',    description: '' },
    servicos_gerais: { title: 'Serviços gerais',   description: '' },
  },
  reserva_copy: '',
  lgpd_text: '',
  rate_limit: 10,
  max_upload_mb: 5,
};

export default function RhSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CareersContent>(DEFAULT);
  const [original, setOriginal] = useState<string>(JSON.stringify(DEFAULT));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = JSON.stringify(data) !== original;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'content')
      .eq('key', 'careers')
      .maybeSingle();
    let merged: CareersContent = DEFAULT;
    if (rows?.value) {
      try {
        const parsed = typeof rows.value === 'string' ? JSON.parse(rows.value) : rows.value;
        merged = {
          ...DEFAULT,
          ...parsed,
          hero:  { ...DEFAULT.hero,  ...(parsed?.hero  ?? {}) },
          areas: { ...DEFAULT.areas, ...(parsed?.areas ?? {}) },
        };
      } catch { /* ignore parse errors */ }
    }
    setData(merged);
    setOriginal(JSON.stringify(merged));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from('system_settings').upsert(
      { category: 'content', key: 'careers', value: JSON.stringify(data), updated_at: now },
      { onConflict: 'category,key' },
    );
    logAudit({ action: 'update', module: 'settings', description: 'Configurações RH (careers) atualizadas' });
    setSaving(false);
    setSaved(true);
    setOriginal(JSON.stringify(data));
    setTimeout(() => setSaved(false), 900);
  }

  function setHero<K extends keyof CareersContent['hero']>(k: K, v: CareersContent['hero'][K]) {
    setData((d) => ({ ...d, hero: { ...d.hero, [k]: v } }));
  }
  function setArea(key: keyof CareersContent['areas'], patch: Partial<AreaContent>) {
    setData((d) => ({ ...d, areas: { ...d.areas, [key]: { ...d.areas[key], ...patch } } }));
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
      {/* Hero */}
      <SettingsCard
        title="Hero da página /trabalhe-conosco"
        description="Título, subtítulo e imagem de capa"
        icon={ImageIcon}
        collapseId="rh-hero"
      >
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Título</label>
            <input type="text" value={data.hero.title} onChange={(e) => setHero('title', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Subtítulo</label>
            <textarea
              value={data.hero.subtitle}
              onChange={(e) => setHero('subtitle', e.target.value)}
              className={`${inputCls} min-h-[80px] resize-y`}
            />
          </div>
          <div>
            <label className={labelCls}>URL da imagem</label>
            <input type="url" value={data.hero.image_url ?? ''} onChange={(e) => setHero('image_url', e.target.value)} className={inputCls} placeholder="https://…" />
          </div>
        </div>
      </SettingsCard>

      {/* Áreas */}
      <SettingsCard
        title="Áreas de atuação"
        description="Cards exibidos no passo 1 do wizard"
        icon={Briefcase}
        collapseId="rh-areas"
      >
        <div className="space-y-5">
          {(['pedagogica', 'administrativa', 'servicos_gerais'] as const).map((k) => (
            <div key={k} className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {k === 'pedagogica' ? 'Pedagógica' : k === 'administrativa' ? 'Administrativa' : 'Serviços gerais'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className={labelCls}>Título</label>
                  <input type="text" value={data.areas[k].title} onChange={(e) => setArea(k, { title: e.target.value })} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Descrição curta</label>
                  <input type="text" value={data.areas[k].description} onChange={(e) => setArea(k, { description: e.target.value })} className={inputCls} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Textos longos */}
      <SettingsCard
        title="Textos da página"
        description="Copy da base reserva e do aviso LGPD"
        icon={FileText}
        collapseId="rh-copy"
      >
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Copy — base reserva (exibido quando não há vagas abertas)</label>
            <textarea
              value={data.reserva_copy}
              onChange={(e) => setData((d) => ({ ...d, reserva_copy: e.target.value }))}
              className={`${inputCls} min-h-[80px] resize-y`}
              placeholder="Ex: No momento não temos vagas abertas para esta área, mas você pode deixar seu currículo na nossa base reserva…"
            />
          </div>
          <div>
            <label className={labelCls}>Aviso LGPD (checkbox obrigatório)</label>
            <textarea
              value={data.lgpd_text}
              onChange={(e) => setData((d) => ({ ...d, lgpd_text: e.target.value }))}
              className={`${inputCls} min-h-[100px] resize-y`}
              placeholder="Autorizo o tratamento dos meus dados pessoais para fins de recrutamento…"
            />
          </div>
        </div>
      </SettingsCard>

      {/* Parâmetros */}
      <SettingsCard
        title="Parâmetros de captação"
        description="Limites de uso do endpoint público"
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
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
