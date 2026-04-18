-- ============================================================================
-- Migration 35: Navigation Settings
-- Seeds topbar, navbar, and footer configuration into system_settings
-- so the public site navigation is admin-editable.
-- ============================================================================

INSERT INTO system_settings (category, key, value) VALUES
  -- social_links and whatsapp live in general (Dados Institucionais) — single source of truth
  -- NOTA: rotas dos portais corrigidas em migration 196 (antes apontavam
  -- para /portal-aluno, /area-professor e /biblioteca-virtual — nenhuma
  -- existente em App.tsx). Seed default abaixo ja esta nos paths reais.
  ('navigation', 'topbar', '{
    "show_topbar": true,
    "quick_links": [
      { "label": "Portal do Aluno",       "route": "/portal/login" },
      { "label": "Portal do Responsável", "route": "/responsavel/login" },
      { "label": "Área do Professor",     "route": "/professor/login" }
    ]
  }'::jsonb),

  -- logo_url lives in branding > logos (single source of truth)
  ('navigation', 'navbar', '{
    "items": [
      { "label": "Início", "route": "/" },
      {
        "label": "Segmentos",
        "route": null,
        "children": [
          { "label": "Educação Infantil",    "route": "/educacao-infantil" },
          { "label": "Ensino Fundamental I",  "route": "/ensino-fundamental-1" },
          { "label": "Ensino Fundamental II", "route": "/ensino-fundamental-2" },
          { "label": "Ensino Médio",          "route": "/ensino-medio" }
        ]
      },
      { "label": "Sobre",     "route": "/sobre" },
      { "label": "Estrutura", "route": "/estrutura" },
      { "label": "Contato",   "route": "/contato" }
    ]
  }'::jsonb),

  ('navigation', 'footer', '{
    "columns": [
      {
        "title": "Links Rápidos",
        "links": [
          { "label": "Portal do Aluno",       "route": "/portal/login" },
          { "label": "Portal do Responsável", "route": "/responsavel/login" },
          { "label": "Área do Professor",     "route": "/professor/login" }
        ]
      },
      {
        "title": "Segmentos",
        "links": [
          { "label": "Educação Infantil",    "route": "/educacao-infantil" },
          { "label": "Ensino Fundamental I",  "route": "/ensino-fundamental-1" },
          { "label": "Ensino Fundamental II", "route": "/ensino-fundamental-2" },
          { "label": "Ensino Médio",          "route": "/ensino-medio" }
        ]
      }
    ],
    "legal_links": [
      { "label": "Política de Privacidade", "route": "/politica-privacidade" },
      { "label": "Termos de Uso",           "route": "/termos-de-uso" }
    ],
    "copyright_text": "Todos os direitos reservados.",
    "show_cnpj": true
  }'::jsonb)
ON CONFLICT (category, key) DO NOTHING;

-- Update RLS policy to allow anon read of 'navigation' category
DROP POLICY IF EXISTS "Anon can read public settings" ON system_settings;
CREATE POLICY "Anon can read public settings" ON system_settings
  FOR SELECT
  USING (category = ANY (ARRAY['contact', 'visit', 'enrollment', 'general', 'branding', 'appearance', 'navigation']));
