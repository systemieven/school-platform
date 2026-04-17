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
  maintenanceMode: boolean;
  loading: boolean;
}

// ── Defaults (from client config — used as fallback before DB loads) ──

import { CLIENT_DEFAULTS } from '../config/client';

const DEFAULT_COLORS: BrandingColors = { ...CLIENT_DEFAULTS.colors };

const DEFAULT_FONTS: BrandingFonts = { ...CLIENT_DEFAULTS.fonts };

const DEFAULT_IDENTITY: BrandingIdentity = {
  school_name:       CLIENT_DEFAULTS.identity.school_name,
  school_short_name: CLIENT_DEFAULTS.identity.school_short_name,
  school_initials:   CLIENT_DEFAULTS.identity.school_initials,
  slogan:            CLIENT_DEFAULTS.identity.slogan,
  cnpj:              CLIENT_DEFAULTS.identity.cnpj,
  logo_url: '',
  logo_dark_url: '',
  favicon_url: '',
  og_image_url: '',
};

const DEFAULT_CTA: BrandingCTA = { ...CLIENT_DEFAULTS.cta };

// ── Context ──

const BrandingContext = createContext<BrandingContextValue>({
  colors: DEFAULT_COLORS,
  fonts: DEFAULT_FONTS,
  identity: DEFAULT_IDENTITY,
  cta: DEFAULT_CTA,
  maintenanceMode: false,
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

// ── Dynamic theme-color (PWA + mobile browser chrome) ──

function injectThemeColor(color: string) {
  if (!color) return;
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  if (meta.content !== color) meta.content = color;
}

// ── Dynamic Web App Manifest (PWA install values per-client) ──

const MANIFEST_LINK_ID = 'app-manifest-dynamic';

function injectManifest(opts: {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  icon_url?: string;
}) {
  const icons = opts.icon_url
    ? [
        { src: opts.icon_url, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: opts.icon_url, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
      ]
    : [
        { src: '/pwa-icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
        { src: '/pwa-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        { src: '/pwa-icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
      ];

  const manifest = {
    name: opts.name,
    short_name: opts.short_name,
    description: opts.description,
    theme_color: opts.theme_color,
    background_color: opts.background_color,
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    lang: 'pt-BR',
    icons,
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const url = URL.createObjectURL(blob);

  let link = document.getElementById(MANIFEST_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = MANIFEST_LINK_ID;
    link.rel = 'manifest';
    document.head.appendChild(link);
  } else if (link.href) {
    URL.revokeObjectURL(link.href);
  }
  link.href = url;
}

function injectFavicon(url: string) {
  if (!url) return;
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
  if (link) {
    if (link.href === url) return;
    link.href = url;
  } else {
    link = document.createElement('link');
    link.rel = 'icon';
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
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      // Branding settings
      supabase.from('system_settings').select('key, value').eq('category', 'branding'),
      // Institutional settings (school_name, cnpj, maintenance_mode — single source of truth)
      supabase.from('system_settings').select('key, value').eq('category', 'general').in('key', ['school_name', 'cnpj', 'maintenance_mode']),
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
        if ('maintenance_mode' in general) {
          setMaintenanceMode(general.maintenance_mode === 'true');
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
            case 'logos': {
              const logoData = val as Partial<BrandingIdentity>;
              setIdentity((prev) => ({ ...prev, ...logoData }));
              if (logoData.favicon_url) injectFavicon(logoData.favicon_url);
              break;
            }
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

  // Sync <meta theme-color> + <link rel="manifest"> with current branding.
  useEffect(() => {
    injectThemeColor(colors.primary);
    injectManifest({
      name: identity.school_name,
      short_name: identity.school_short_name || identity.school_name,
      description: identity.slogan || identity.school_name,
      theme_color: colors.primary,
      background_color: colors.surface,
      icon_url: identity.logo_url || undefined,
    });
  }, [
    colors.primary,
    colors.surface,
    identity.school_name,
    identity.school_short_name,
    identity.slogan,
    identity.logo_url,
  ]);

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
            case 'logos': {
              const logoData = val as Partial<BrandingIdentity>;
              setIdentity((prev) => ({ ...prev, ...logoData }));
              if (logoData.favicon_url) injectFavicon(logoData.favicon_url);
              break;
            }
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

    // Listen for maintenance_mode changes in general category
    const generalChannel = supabase
      .channel('general-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: "category=eq.general" },
        (payload) => {
          const { key, value } = payload.new as { key: string; value: unknown };
          if (key === 'maintenance_mode') {
            setMaintenanceMode(value === true || value === 'true');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(brandingChannel);
      supabase.removeChannel(ctaChannel);
      supabase.removeChannel(generalChannel);
    };
  }, []);

  return (
    <BrandingContext.Provider value={{ colors, fonts, identity, cta, maintenanceMode, loading }}>
      {children}
    </BrandingContext.Provider>
  );
}

// ── Hook ──

export function useBranding() {
  return useContext(BrandingContext);
}
