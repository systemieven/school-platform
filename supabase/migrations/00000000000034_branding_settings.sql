-- Migration: Seed branding settings
-- Adds branding identity, colors, fonts and CTAs to system_settings
-- These are the current hardcoded values from the Colegio Batista codebase

INSERT INTO system_settings (category, key, value) VALUES
  -- Identity
  -- school_name and cnpj live in general (Dados Institucionais) — single source of truth
  ('branding', 'identity', '{
    "school_short_name": "Batista",
    "school_initials": "CB",
    "slogan": "Educação que Transforma Vidas"
  }'::jsonb),

  -- Logos
  ('branding', 'logos', '{
    "logo_url": "",
    "logo_dark_url": "",
    "favicon_url": "",
    "og_image_url": ""
  }'::jsonb),

  -- Colors
  ('branding', 'colors', '{
    "primary": "#003876",
    "primary_dark": "#002855",
    "secondary": "#ffd700",
    "secondary_light": "#ffe44d",
    "surface": "#f8f7f4",
    "surface_warm": "#f3f1ec",
    "text_on_primary": "#ffffff",
    "text_on_secondary": "#1a1a2e"
  }'::jsonb),

  -- Fonts
  ('branding', 'fonts', '{
    "display_family": "Playfair Display",
    "display_weight": "700",
    "sans_family": "Inter",
    "sans_weight": "400",
    "admin_family": "Sora",
    "google_fonts_url": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Sora:wght@300;400;500;600;700&display=swap"
  }'::jsonb),

  -- CTAs
  ('branding', 'cta', '{
    "enrollment_label": "Matrícula 2026",
    "enrollment_route": "/matricula",
    "enrollment_pulse": true,
    "hero_primary_label": "Conheça Nossa Escola",
    "hero_primary_route": "/sobre",
    "hero_secondary_label": "Agende uma Visita",
    "hero_secondary_route": "/agendar-visita",
    "band_label": "Faça sua matrícula",
    "band_route": "/matricula"
  }'::jsonb)

ON CONFLICT (category, key) DO NOTHING;

-- Allow anon users (public site) to read branding and appearance settings
DROP POLICY IF EXISTS "Anon can read public settings" ON system_settings;
CREATE POLICY "Anon can read public settings" ON system_settings
  FOR SELECT
  USING (category = ANY (ARRAY['contact', 'visit', 'enrollment', 'general', 'branding', 'appearance']));
