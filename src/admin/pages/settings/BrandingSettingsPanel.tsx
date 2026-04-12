import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';
import {
  Save, Loader2, Check,
  Building2, Image, Palette, Type, MousePointer,
} from 'lucide-react';
import ImageField from '../../components/ImageField';
import FontPicker, { buildGoogleFontsUrl } from '../../components/FontPicker';
import RoutePicker from '../../components/RoutePicker';
import {
  InputField, SelectField, SectionLabel, SectionDivider, INPUT_CLS,
} from '../../components/FormField';

// ── Types ────────────────────────────────────────────────────────────────────

interface IdentityFields {
  school_short_name: string;
  school_initials: string;
  slogan: string;
}

interface LogosFields {
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  og_image_url: string;
}

interface ColorsFields {
  primary: string;
  primary_dark: string;
  secondary: string;
  secondary_light: string;
  surface: string;
  surface_warm: string;
  text_on_primary: string;
  text_on_secondary: string;
}

interface FontsFields {
  display_family: string;
  display_weight: string;
  sans_family: string;
  sans_weight: string;
  admin_family: string;
  google_fonts_url: string;
}

interface CtaFields {
  enrollment_label: string;
  enrollment_route: string;
  enrollment_pulse: boolean;
  hero_primary_label: string;
  hero_primary_route: string;
  hero_secondary_label: string;
  hero_secondary_route: string;
  band_label: string;
  band_route: string;
}

interface SettingIds {
  identity: string | null;
  logos: string | null;
  colors: string | null;
  fonts: string | null;
  cta: string | null;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_IDENTITY: IdentityFields = {
  school_short_name: '',
  school_initials: '',
  slogan: '',
};

const DEFAULT_LOGOS: LogosFields = {
  logo_url: '',
  logo_dark_url: '',
  favicon_url: '',
  og_image_url: '',
};

const DEFAULT_COLORS: ColorsFields = {
  primary: '#1e3a5f',
  primary_dark: '#152a45',
  secondary: '#c9a84c',
  secondary_light: '#f5e6b8',
  surface: '#f8f6f0',
  surface_warm: '#faf8f2',
  text_on_primary: '#ffffff',
  text_on_secondary: '#1e3a5f',
};

const DEFAULT_FONTS: FontsFields = {
  display_family: 'Playfair Display',
  display_weight: '700',
  sans_family: 'Inter',
  sans_weight: '400',
  admin_family: 'Sora',
  google_fonts_url: '',
};

const DEFAULT_CTA: CtaFields = {
  enrollment_label: '',
  enrollment_route: '',
  enrollment_pulse: false,
  hero_primary_label: '',
  hero_primary_route: '',
  hero_secondary_label: '',
  hero_secondary_route: '',
  band_label: '',
  band_route: '',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const WEIGHT_OPTIONS = ['300', '400', '500', '600', '700', '800', '900'];

const COLOR_LABELS: Record<keyof ColorsFields, string> = {
  primary: 'Primária',
  primary_dark: 'Primária escura',
  secondary: 'Secundária',
  secondary_light: 'Secundária clara',
  surface: 'Superfície',
  surface_warm: 'Superfície quente',
  text_on_primary: 'Texto sobre primária',
  text_on_secondary: 'Texto sobre secundária',
};

// ── Color Swatch ─────────────────────────────────────────────────────────────

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label className="group flex flex-col items-center gap-1.5 cursor-pointer">
      <div
        className="w-full h-14 rounded-xl border-2 border-gray-200 dark:border-gray-600 shadow-sm group-hover:border-brand-primary/50 transition-all duration-200 relative overflow-hidden"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 text-center leading-tight">
        {label}
      </span>
      <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase">
        {value}
      </span>
    </label>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function BrandingSettingsPanel() {
  const [identity, setIdentity] = useState<IdentityFields>(DEFAULT_IDENTITY);
  const [logos, setLogos]       = useState<LogosFields>(DEFAULT_LOGOS);
  const [colors, setColors]     = useState<ColorsFields>(DEFAULT_COLORS);
  const [fonts, setFonts]       = useState<FontsFields>(DEFAULT_FONTS);
  const [cta, setCta]           = useState<CtaFields>(DEFAULT_CTA);

  const [origIdentity, setOrigIdentity] = useState<IdentityFields>(DEFAULT_IDENTITY);
  const [origLogos, setOrigLogos]       = useState<LogosFields>(DEFAULT_LOGOS);
  const [origColors, setOrigColors]     = useState<ColorsFields>(DEFAULT_COLORS);
  const [origFonts, setOrigFonts]       = useState<FontsFields>(DEFAULT_FONTS);
  const [origCta, setOrigCta]           = useState<CtaFields>(DEFAULT_CTA);

  const [ids, setIds] = useState<SettingIds>({
    identity: null, logos: null, colors: null, fonts: null, cta: null,
  });

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('id, key, value')
      .eq('category', 'branding')
      .in('key', ['identity', 'logos', 'colors', 'fonts', 'cta'])
      .then(({ data }) => {
        if (data) {
          const newIds: SettingIds = { identity: null, logos: null, colors: null, fonts: null, cta: null };
          for (const row of data) {
            const val = row.value as Record<string, unknown>;
            switch (row.key) {
              case 'identity': {
                const v = { ...DEFAULT_IDENTITY, ...val } as IdentityFields;
                setIdentity(v); setOrigIdentity(v);
                newIds.identity = row.id as string;
                break;
              }
              case 'logos': {
                const v = { ...DEFAULT_LOGOS, ...val } as LogosFields;
                setLogos(v); setOrigLogos(v);
                newIds.logos = row.id as string;
                break;
              }
              case 'colors': {
                const v = { ...DEFAULT_COLORS, ...val } as ColorsFields;
                setColors(v); setOrigColors(v);
                newIds.colors = row.id as string;
                break;
              }
              case 'fonts': {
                const v = { ...DEFAULT_FONTS, ...val } as FontsFields;
                setFonts(v); setOrigFonts(v);
                newIds.fonts = row.id as string;
                break;
              }
              case 'cta': {
                const v = { ...DEFAULT_CTA, ...val } as CtaFields;
                setCta(v); setOrigCta(v);
                newIds.cta = row.id as string;
                break;
              }
            }
          }
          setIds(newIds);
        }
        setLoading(false);
      });
  }, []);

  // ── Change detection ─────────────────────────────────────────────────────
  const hasChanges =
    JSON.stringify(identity) !== JSON.stringify(origIdentity) ||
    JSON.stringify(logos) !== JSON.stringify(origLogos) ||
    JSON.stringify(colors) !== JSON.stringify(origColors) ||
    JSON.stringify(fonts) !== JSON.stringify(origFonts) ||
    JSON.stringify(cta) !== JSON.stringify(origCta);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function upsertKey(
    key: string,
    value: Record<string, unknown>,
    existingId: string | null,
  ): Promise<string | null> {
    if (existingId) {
      await supabase
        .from('system_settings')
        .update({ value })
        .eq('id', existingId);
      return existingId;
    }
    const { data } = await supabase
      .from('system_settings')
      .insert({ category: 'branding', key, value })
      .select('id')
      .single();
    return data ? (data as { id: string }).id : null;
  }

  async function handleSave() {
    setSaving(true);

    const [idIdentity, idLogos, idColors, idFonts, idCta] = await Promise.all([
      upsertKey('identity', identity as unknown as Record<string, unknown>, ids.identity),
      upsertKey('logos', logos as unknown as Record<string, unknown>, ids.logos),
      upsertKey('colors', colors as unknown as Record<string, unknown>, ids.colors),
      upsertKey('fonts', fonts as unknown as Record<string, unknown>, ids.fonts),
      upsertKey('cta', cta as unknown as Record<string, unknown>, ids.cta),
    ]);

    setIds({
      identity: idIdentity,
      logos: idLogos,
      colors: idColors,
      fonts: idFonts,
      cta: idCta,
    });

    setOrigIdentity(identity);
    setOrigLogos(logos);
    setOrigColors(colors);
    setOrigFonts(fonts);
    setOrigCta(cta);

    logAudit({
      action: 'update',
      module: 'settings',
      description: 'Configuracoes de branding atualizadas',
      newData: { identity, logos, colors, fonts, cta },
    });

    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">

      {/* ─── 1. Identidade ───────────────────────────────────────────────── */}
      <SettingsCard
        collapseId="branding-identity"
        title="Identidade"
        description="Nome completo e CNPJ ficam em Dados Institucionais."
        icon={Building2}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Nome curto"
            icon={Building2}
            value={identity.school_short_name}
            onChange={(e) => setIdentity((s) => ({ ...s, school_short_name: e.target.value }))}
            placeholder="Ex: Colégio Batista"
            maxLength={40}
          />
          <InputField
            label="Sigla"
            value={identity.school_initials}
            onChange={(e) => setIdentity((s) => ({ ...s, school_initials: e.target.value.toUpperCase().slice(0, 4) }))}
            placeholder="Ex: CB"
            maxLength={4}
            hint="Até 4 caracteres"
          />
        </div>
        <InputField
          label="Slogan"
          value={identity.slogan}
          onChange={(e) => setIdentity((s) => ({ ...s, slogan: e.target.value }))}
          placeholder="Ex: Educação que Transforma Vidas"
          maxLength={80}
        />
      </SettingsCard>

      {/* ─── 2. Logos ────────────────────────────────────────────────────── */}
      <SettingsCard collapseId="branding-logos" title="Logos" icon={Image}>
        <ImageField
          label="Logo principal"
          value={logos.logo_url}
          onChange={(url) => setLogos((s) => ({ ...s, logo_url: url }))}
          storageKey="branding_logo"
          hint="Usado na navbar e cabeçalhos. Recomendado: fundo transparente (PNG)."
        />
        <ImageField
          label="Logo (modo escuro)"
          value={logos.logo_dark_url}
          onChange={(url) => setLogos((s) => ({ ...s, logo_dark_url: url }))}
          storageKey="branding_logo_dark"
          hint="Versão para fundos escuros. Opcional."
        />
        <ImageField
          label="Favicon"
          value={logos.favicon_url}
          onChange={(url) => setLogos((s) => ({ ...s, favicon_url: url }))}
          storageKey="branding_favicon"
          hint="Ícone da aba do navegador. Recomendado: 32×32px ou 64×64px."
          previewHeight="h-16"
        />
        <ImageField
          label="Imagem OG (compartilhamento)"
          value={logos.og_image_url}
          onChange={(url) => setLogos((s) => ({ ...s, og_image_url: url }))}
          storageKey="branding_og_image"
          hint="Exibida ao compartilhar links do site em redes sociais. Recomendado: 1200×630px."
        />
      </SettingsCard>

      {/* ─── 3. Cores ────────────────────────────────────────────────────── */}
      <SettingsCard collapseId="branding-colors" title="Cores" icon={Palette}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(Object.keys(COLOR_LABELS) as (keyof ColorsFields)[]).map((key) => (
            <ColorSwatch
              key={key}
              label={COLOR_LABELS[key]}
              value={colors[key]}
              onChange={(hex) => setColors((s) => ({ ...s, [key]: hex }))}
            />
          ))}
        </div>

        {/* Barra de contraste */}
        <SectionDivider />
        <SectionLabel>Contraste</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div
            className="h-14 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm transition-colors"
            style={{ backgroundColor: colors.primary, color: colors.text_on_primary }}
          >
            <span className="text-sm font-semibold">Aa Texto Primário</span>
          </div>
          <div
            className="h-14 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm transition-colors"
            style={{ backgroundColor: colors.secondary, color: colors.text_on_secondary }}
          >
            <span className="text-sm font-semibold">Aa Texto Secundário</span>
          </div>
        </div>

        {/* Edição direta hex */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(COLOR_LABELS) as (keyof ColorsFields)[]).map((key) => (
            <div key={key}>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                {COLOR_LABELS[key]}
              </label>
              <input
                className={INPUT_CLS}
                value={colors[key]}
                onChange={(e) => {
                  let v = e.target.value;
                  if (!v.startsWith('#')) v = '#' + v;
                  setColors((s) => ({ ...s, [key]: v.slice(0, 7) }));
                }}
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* ─── 4. Fontes ───────────────────────────────────────────────────── */}
      <SettingsCard collapseId="branding-fonts" title="Fontes" icon={Type}>
        <div className="space-y-5">
          <div>
            <FontPicker
              label="Fonte de Títulos"
              value={fonts.display_family}
              onChange={(f) => {
                const url = buildGoogleFontsUrl([f, fonts.sans_family, fonts.admin_family]);
                setFonts((s) => ({ ...s, display_family: f, google_fonts_url: url }));
              }}
            />
            <div className="mt-2 max-w-[180px]">
              <SelectField label="Peso" value={fonts.display_weight}
                onChange={(e) => setFonts((s) => ({ ...s, display_weight: e.target.value }))}>
                {WEIGHT_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </SelectField>
            </div>
          </div>

          <SectionDivider />

          <div>
            <FontPicker
              label="Fonte de Texto"
              value={fonts.sans_family}
              onChange={(f) => {
                const url = buildGoogleFontsUrl([fonts.display_family, f, fonts.admin_family]);
                setFonts((s) => ({ ...s, sans_family: f, google_fonts_url: url }));
              }}
            />
            <div className="mt-2 max-w-[180px]">
              <SelectField label="Peso" value={fonts.sans_weight}
                onChange={(e) => setFonts((s) => ({ ...s, sans_weight: e.target.value }))}>
                {WEIGHT_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </SelectField>
            </div>
          </div>

          <SectionDivider />

          <FontPicker
            label="Fonte do Admin"
            value={fonts.admin_family}
            onChange={(f) => {
              const url = buildGoogleFontsUrl([fonts.display_family, fonts.sans_family, f]);
              setFonts((s) => ({ ...s, admin_family: f, google_fonts_url: url }));
            }}
          />
        </div>
      </SettingsCard>

      {/* ─── 5. CTAs ─────────────────────────────────────────────────────── */}
      <SettingsCard collapseId="branding-cta" title="CTAs" icon={MousePointer}>
        <SectionLabel>Matrícula</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Label"
            value={cta.enrollment_label}
            onChange={(e) => setCta((s) => ({ ...s, enrollment_label: e.target.value }))}
            placeholder="Ex: Matricule-se"
          />
          <RoutePicker
            label="Rota"
            value={cta.enrollment_route}
            onChange={(v) => setCta((s) => ({ ...s, enrollment_route: v }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">Efeito pulse</span>
          <Toggle
            checked={cta.enrollment_pulse}
            onChange={(v) => setCta((s) => ({ ...s, enrollment_pulse: v }))}
          />
        </div>

        <SectionDivider />

        <SectionLabel>Hero</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Botão primário — label"
            value={cta.hero_primary_label}
            onChange={(e) => setCta((s) => ({ ...s, hero_primary_label: e.target.value }))}
            placeholder="Ex: Agendar Visita"
          />
          <RoutePicker
            label="Botão primário — rota"
            value={cta.hero_primary_route}
            onChange={(v) => setCta((s) => ({ ...s, hero_primary_route: v }))}
          />
          <InputField
            label="Botão secundário — label"
            value={cta.hero_secondary_label}
            onChange={(e) => setCta((s) => ({ ...s, hero_secondary_label: e.target.value }))}
            placeholder="Ex: Conhecer mais"
          />
          <RoutePicker
            label="Botão secundário — rota"
            value={cta.hero_secondary_route}
            onChange={(v) => setCta((s) => ({ ...s, hero_secondary_route: v }))}
          />
        </div>

        <SectionDivider />

        <SectionLabel>Faixa (Band)</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Label"
            value={cta.band_label}
            onChange={(e) => setCta((s) => ({ ...s, band_label: e.target.value }))}
            placeholder="Ex: Garanta sua vaga"
          />
          <RoutePicker
            label="Rota"
            value={cta.band_route}
            onChange={(v) => setCta((s) => ({ ...s, band_route: v }))}
          />
        </div>
      </SettingsCard>

      {/* ─── Floating Save ───────────────────────────────────────────────── */}
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
