-- Migration 201 — Dashboards Secretaria + Área do Professor
--
-- 1. Estende o CHECK de `dashboard_widgets.module` e `dashboard_widget_prefs.module`
--    (antes: financeiro/academico/principal) para aceitar os dois novos módulos
--    com gráficos personalizáveis: `secretaria` e `area-professor`.
-- 2. Cria o módulo granular `secretaria-dashboard` (nova aba "Visão Geral"
--    da Secretaria Digital) com RLS coerente com as demais sub-abas.
--
-- Idempotente (DROP IF EXISTS + ON CONFLICT DO NOTHING).

-- ── 1. CHECKs ────────────────────────────────────────────────────────────────

ALTER TABLE dashboard_widgets
  DROP CONSTRAINT IF EXISTS dashboard_widgets_module_check;
ALTER TABLE dashboard_widgets
  ADD  CONSTRAINT dashboard_widgets_module_check
  CHECK (module IN ('financeiro','academico','principal','secretaria','area-professor'));

ALTER TABLE dashboard_widget_prefs
  DROP CONSTRAINT IF EXISTS dashboard_widget_prefs_module_check;
ALTER TABLE dashboard_widget_prefs
  ADD  CONSTRAINT dashboard_widget_prefs_module_check
  CHECK (module IN ('financeiro','academico','principal','secretaria','area-professor'));

-- ── 2. Módulo granular Secretaria - Dashboard ───────────────────────────────

INSERT INTO modules (key, label, description, is_active, position) VALUES
  ('secretaria-dashboard', 'Secretaria - Dashboard',
   'Visao geral operacional da secretaria digital', true, 59)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('super_admin', 'secretaria-dashboard', true, true, true, true),
  ('admin',       'secretaria-dashboard', true, true, true, true),
  ('coordinator', 'secretaria-dashboard', true, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;
