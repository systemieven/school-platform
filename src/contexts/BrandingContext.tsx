import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ──

interface BrandingColors {
  primary: string;
  primary_dark: string;
  secondary: string;
  secondary_light: string;
  surface: string;
  surface_warm: string;
  text_on_primary: string;
  text_on_secondary: string;
}

interface BrandingFonts {
  display_family: string;
  display_weight: string;
  sans_family: string;
  sans_weight: string;
  admin_family: string;
  google_fonts_url: string;
}

interface BrandingIdentity {
  /** Sourced from general settings (Dados Institucionais) — single source of truth */
  school_name: string;
  cnpj: string;
  /** Branding-specific fields */
  school_short_name: string;
  school_initials: string;
  slogan: string;
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  og_image_url: string;
}

interface BrandingCTA {
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

interface BrandingContextValue {
  colors: BrandingColors;
  fonts: BrandingFonts;
  identity: BrandingIdentity;
  cta: BrandingCTA;
  loading: boolean;
}

// ── Defaults (current hardcoded values — used as fallback) ──

const DEFAULT_COLORS: BrandingColors = {
  primary: '#003876',
  primary_dark: '#002855',
  secondary: '#ffd700',
  secondary_light: '#ffe44d',
  surface: '#f8f7f4',
  surface_warm: '#f3f1ec',
  text_on_primary: '#ffffff',
  text_on_secondary: '#1a1a2e',
};

const DEFAULT_FONTS: BrandingFonts = {
  display_family: 'Playfair Display',
  display_weight: '700',
  sans_family: 'Inter',
  sans_weight: '400',
  admin_family: 'Sora',
  google_fonts_url:
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Sora:wght@300;400;500;600;700&display=swap',
};

const DEFAULT_IDENTITY: BrandingIdentity = {
  school_name: 'Colégio Batista em Caruaru',
  school_short_name: 'Batista',
  school_initials: 'CB',
  slogan: 'Educação que Transforma Vidas',
  cnpj: '01.873.279/0002-61',
  logo_url: '',
  logo_dark_url: '',
  favicon_url: '',
  og_image_url: '',
};

const DEFAULT_CTA: BrandingCTA = {
  enrollment_label: 'Matrícula 2026',
  enrollment_route: '/matricula',
  enrollment_pulse: true,
  hero_primary_label: 'Conheça Nossa Escola',
  hero_primary_route: '/sobre',
  hero_secondary_label: 'Agende uma Visita',
  hero_secondary_route: '/agendar-visita',
  band_label: 'Faça sua matrícula',
  band_route: '/matricula',
};

// ── Context ──

const BrandingContext = createContext<BrandingContextValue>({
  colors: DEFAULT_COLORS,
  fonts: DEFAULT_FONTS,
  identity: DEFAULT_IDENTITY,
  cta: DEFAULT_CTA,
  loading: true,
});

// ── CSS Variable Injection ──

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
}

function injectCSSVariables(colors: BrandingColors) {
  const root = document.documentElement;
  // Hex values — used by index.css classes (var(--brand-primary))
  root.style.setProperty('--brand-primary', colors.primary);
  root.style.setProperty('--brand-primary-dark', colors.primary_dark);
  root.style.setProperty('--brand-secondary', colors.secondary);
  root.style.setProperty('--brand-secondary-light', colors.secondary_light);
  root.style.setProperty('--brand-surface', colors.surface);
  root.style.setProperty('--brand-surface-warm', colors.surface_warm);
  // RGB channels — used by Tailwind brand-* tokens for opacity support
  root.style.setProperty('--brand-primary-rgb', hexToRgb(colors.primary));
  root.style.setProperty('--brand-primary-dark-rgb', hexToRgb(colors.primary_dark));
  root.style.setProperty('--brand-secondary-rgb', hexToRgb(colors.secondary));
  root.style.setProperty('--brand-secondary-light-rgb', hexToRgb(colors.secondary_light));
  root.style.setProperty('--brand-surface-rgb', hexToRgb(colors.surface));
  root.style.setProperty('--brand-surface-warm-rgb', hexToRgb(colors.surface_warm));
}

// ── Google Fonts Injection ──

const FONTS_LINK_ID = 'branding-google-fonts';

function injectGoogleFonts(url: string) {
  if (!url) return;

  let link = document.getElementById(FONTS_LINK_ID) as HTMLLinkElement | null;
  if (link) {
    if (link.href === url) return; // already loaded
    link.href = url;
  } else {
    link = document.createElement('link');
    link.id = FONTS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }
}

// ── Provider ──

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<BrandingColors>(DEFAULT_COLORS);
  const [fonts, setFonts] = useState<BrandingFonts>(DEFAULT_FONTS);
  const [identity, setIdentity] = useState<BrandingIdentity>(DEFAULT_IDENTITY);
  const [cta, setCta] = useState<BrandingCTA>(DEFAULT_CTA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      // Branding settings
      supabase.from('system_settings').select('key, value').eq('category', 'branding'),
      // Institutional settings (school_name, cnpj — single source of truth)
      supabase.from('system_settings').select('key, value').eq('category', 'general').in('key', ['school_name', 'cnpj']),
      // CTA settings (now in navigation category)
      supabase.from('system_settings').select('key, value').eq('category', 'navigation').eq('key', 'cta'),
    ]).then(([brandingRes, generalRes, ctaRes]) => {
      // Apply general (institutional) fields to identity
      if (generalRes.data) {
        const general: Record<string, string> = {};
        for (const row of generalRes.data) {
          const v = typeof row.value === 'string' ? row.value : String(row.value ?? '');
          general[row.key] = v;
        }
        if (general.school_name || general.cnpj) {
          setIdentity((prev) => ({
            ...prev,
            ...(general.school_name ? { school_name: general.school_name } : {}),
            ...(general.cnpj ? { cnpj: general.cnpj } : {}),
          }));
        }
      }

      // Apply branding settings
      if (brandingRes.data) {
        for (const row of brandingRes.data) {
          let val = row.value;
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch { /* keep as string */ }
          }

          switch (row.key) {
            case 'colors':
              setColors((prev) => ({ ...prev, ...(val as Partial<BrandingColors>) }));
              injectCSSVariables({ ...DEFAULT_COLORS, ...(val as Partial<BrandingColors>) });
              break;
            case 'fonts':
              setFonts((prev) => {
                const merged = { ...prev, ...(val as Partial<BrandingFonts>) };
                injectGoogleFonts(merged.google_fonts_url);
                return merged;
              });
              break;
            case 'identity':
              setIdentity((prev) => ({ ...prev, ...(val as Partial<BrandingIdentity>) }));
              break;
            case 'logos':
              setIdentity((prev) => ({ ...prev, ...(val as Partial<BrandingIdentity>) }));
              break;
          }
        }
      }

      // Apply CTA settings from navigation
      if (ctaRes.data && ctaRes.data.length > 0) {
        let val = ctaRes.data[0].value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch { /* keep */ }
        }
        setCta((prev) => ({ ...prev, ...(val as Partial<BrandingCTA>) }));
      }

      setLoading(false);
    });
  }, []);

  // Listen for realtime changes to branding settings
  useEffect(() => {
    const brandingChannel = supabase
      .channel('branding-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: "category=eq.branding" },
        (payload) => {
          const { key, value } = payload.new as { key: string; value: unknown };
          let val = value;
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch { /* keep */ }
          }

          switch (key) {
            case 'colors':
              setColors((prev) => {
                const merged = { ...prev, ...(val as Partial<BrandingColors>) };
                injectCSSVariables(merged);
                return merged;
              });
              break;
            case 'fonts':
              setFonts((prev) => {
                const merged = { ...prev, ...(val as Partial<BrandingFonts>) };
                injectGoogleFonts(merged.google_fonts_url);
                return merged;
              });
              break;
            case 'identity':
              setIdentity((prev) => ({ ...prev, ...(val as Partial<BrandingIdentity>) }));
              break;
          }
        },
      )
      .subscribe();

    // Listen for CTA changes in navigation category
    const ctaChannel = supabase
      .channel('cta-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: "category=eq.navigation" },
        (payload) => {
          const { key, value } = payload.new as { key: string; value: unknown };
          if (key !== 'cta') return;
          let val = value;
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch { /* keep */ }
          }
          setCta((prev) => ({ ...prev, ...(val as Partial<BrandingCTA>) }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(brandingChannel);
      supabase.removeChannel(ctaChannel);
    };
  }, []);

  return (
    <BrandingContext.Provider value={{ colors, fonts, identity, cta, loading }}>
      {children}
    </BrandingContext.Provider>
  );
}

// ── Hook ──

export function useBranding() {
  return useContext(BrandingContext);
}
