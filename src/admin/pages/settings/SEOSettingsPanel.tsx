import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import {
  Save, Loader2, Check, Search, Globe, Eye, EyeOff,
} from 'lucide-react';
import { InputField } from '../../components/FormField';

// ── Types ──

interface PageSEOData {
  title: string;
  description: string;
  og_image?: string;
  keywords?: string;
  noindex?: boolean;
}

type SEOState = Record<string, PageSEOData>;

// ── Page config ──

const SEO_PAGES: { key: string; label: string; path: string }[] = [
  { key: 'home',                  label: 'Página Inicial',         path: '/' },
  { key: 'educacao_infantil',     label: 'Educação Infantil',      path: '/educacao-infantil' },
  { key: 'fundamental_1',        label: 'Ensino Fundamental I',   path: '/ensino-fundamental-1' },
  { key: 'fundamental_2',        label: 'Ensino Fundamental II',  path: '/ensino-fundamental-2' },
  { key: 'ensino_medio',         label: 'Ensino Médio',           path: '/ensino-medio' },
  { key: 'matricula',            label: 'Matrícula',              path: '/matricula' },
  { key: 'contato',              label: 'Contato',                path: '/contato' },
  { key: 'agendar_visita',       label: 'Agendar Visita',         path: '/agendar-visita' },
  { key: 'politica_privacidade', label: 'Política de Privacidade',path: '/politica-privacidade' },
  { key: 'termos_uso',           label: 'Termos de Uso',          path: '/termos-de-uso' },
];

const EMPTY_PAGE: PageSEOData = {
  title: '',
  description: '',
  og_image: '',
  keywords: '',
  noindex: false,
};

// ── Panel ──

export default function SEOSettingsPanel() {
  const [seo, setSeo]     = useState<SEOState>({});
  const [origSeo, setOrigSeo] = useState<SEOState>({});
  const [ids, setIds]     = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('id, key, value')
      .eq('category', 'seo')
      .then(({ data }) => {
        const state: SEOState = {};
        const idMap: Record<string, string> = {};
        if (data) {
          for (const row of data) {
            const val = typeof row.value === 'string'
              ? (() => { try { return JSON.parse(row.value); } catch { return {}; } })()
              : row.value;
            state[row.key] = { ...EMPTY_PAGE, ...(val as Partial<PageSEOData>) };
            idMap[row.key] = row.id as string;
          }
        }
        setSeo(state);
        setOrigSeo(state);
        setIds(idMap);
        setLoading(false);
      });
  }, []);

  // ── Helpers ──
  function update(pageKey: string, field: keyof PageSEOData, value: string | boolean) {
    setSeo((prev) => ({
      ...prev,
      [pageKey]: { ...(prev[pageKey] || EMPTY_PAGE), [field]: value },
    }));
  }

  const hasChanges = JSON.stringify(seo) !== JSON.stringify(origSeo);

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    const newIds = { ...ids };

    const upserts = Object.entries(seo).map(async ([key, value]) => {
      if (newIds[key]) {
        await supabase.from('system_settings').update({ value }).eq('id', newIds[key]);
      } else {
        const { data } = await supabase
          .from('system_settings')
          .insert({ category: 'seo', key, value })
          .select('id')
          .single();
        if (data) newIds[key] = (data as { id: string }).id;
      }
    });

    await Promise.all(upserts);
    setIds(newIds);
    setOrigSeo({ ...seo });

    logAudit({
      action: 'update',
      module: 'settings',
      description: 'Configurações de SEO atualizadas',
      newData: seo,
    });

    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <Globe className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">SEO por Página</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Configure título, descrição e metadados para cada página pública. Esses valores são usados pelo Google e nas previews de redes sociais.
          </p>
        </div>
      </div>

      {/* Per-page SEO */}
      {SEO_PAGES.map(({ key, label, path }) => {
        const page = seo[key] || EMPTY_PAGE;
        return (
          <SettingsCard
            key={key}
            collapseId={`seo-${key}`}
            title={label}
            description={path}
            icon={Search}
          >
            <div className="space-y-4">
              <InputField
                label="Título da página"
                value={page.title}
                onChange={(e) => update(key, 'title', e.target.value)}
                placeholder={`Ex: ${label}`}
                maxLength={70}
                hint="Aparece na aba do navegador e nos resultados do Google. Máx 70 caracteres."
              />

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Meta Description
                </label>
                <textarea
                  value={page.description}
                  onChange={(e) => update(key, 'description', e.target.value)}
                  placeholder="Descrição da página para mecanismos de busca..."
                  maxLength={160}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all resize-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {page.description.length}/160 caracteres. Ideal: 120–160.
                </p>
              </div>

              <InputField
                label="Palavras-chave"
                value={page.keywords || ''}
                onChange={(e) => update(key, 'keywords', e.target.value)}
                placeholder="Ex: escola, educação, caruaru"
                hint="Separadas por vírgula. Uso secundário para SEO."
              />

              <InputField
                label="Imagem OG (override)"
                value={page.og_image || ''}
                onChange={(e) => update(key, 'og_image', e.target.value)}
                placeholder="URL da imagem para compartilhamento"
                hint="Se vazio, usa a imagem OG global definida em Marca > Logos."
              />

              {/* Noindex toggle */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    page.noindex ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  onClick={() => update(key, 'noindex', !page.noindex)}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      page.noindex ? 'translate-x-5' : ''
                    }`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {page.noindex ? (
                    <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {page.noindex ? 'Oculta dos buscadores (noindex)' : 'Indexável pelo Google'}
                  </span>
                </div>
              </label>
            </div>
          </SettingsCard>
        );
      })}

      {/* Floating Save */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
