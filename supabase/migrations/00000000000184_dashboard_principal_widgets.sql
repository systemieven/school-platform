-- 184: Dashboard Principal — gráficos personalizados + prefs do registry
--
-- Estende a infra de dashboards customizáveis (migration 74) para o painel
-- principal `/admin/dashboard`:
--
-- 1. `dashboard_widgets.module` ganha o valor `'principal'` (cross-module:
--    leads, agendamentos, financeiro agregado, etc.) — para gráficos custom.
--
-- 2. Nova tabela `dashboard_widget_prefs` armazena visibilidade e ordem dos
--    widgets estáticos do registry (`src/admin/pages/dashboard/registry.tsx`).
--    Um pref por (module, registry_widget_id) — config é global por escola
--    (mesmo padrão de `dashboard_widgets`: admin/super_admin editam,
--    coordinator lê).
--
-- RLS espelhada da migration 74.

-- ── 1. Estender CHECK do module em dashboard_widgets ──────────────────────────

ALTER TABLE dashboard_widgets
  DROP CONSTRAINT IF EXISTS dashboard_widgets_module_check;

ALTER TABLE dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_module_check
  CHECK (module IN ('financeiro', 'academico', 'principal'));

-- ── 2. Tabela de prefs do registry estático ──────────────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_widget_prefs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module              TEXT        NOT NULL CHECK (module IN ('principal', 'financeiro', 'academico')),
  registry_widget_id  TEXT        NOT NULL,
  is_visible          BOOLEAN     NOT NULL DEFAULT TRUE,
  position            INTEGER     NOT NULL DEFAULT 0,
  updated_by          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, registry_widget_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widget_prefs_module
  ON dashboard_widget_prefs(module);

ALTER TABLE dashboard_widget_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON dashboard_widget_prefs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "authenticated_read" ON dashboard_widget_prefs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger updated_at (reusa função se existir, senão cria)
CREATE OR REPLACE FUNCTION update_dashboard_widget_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dashboard_widget_prefs_updated_at
  BEFORE UPDATE ON dashboard_widget_prefs
  FOR EACH ROW EXECUTE FUNCTION update_dashboard_widget_prefs_updated_at();

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'settings',
  'Migration 184: dashboard principal — module=''principal'' em dashboard_widgets + tabela dashboard_widget_prefs (visibilidade/ordem de widgets do registry estático)'
);
