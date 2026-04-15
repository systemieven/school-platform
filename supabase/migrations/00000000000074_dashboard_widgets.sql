-- Migration 74: dashboard_widgets
-- Graficos personalizaveis por modulo (financeiro / academico).
-- Sistema single-tenant: sem school_id. RLS via profiles.role.

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module      TEXT        NOT NULL CHECK (module IN ('financeiro', 'academico')),
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL,
  chart_type  TEXT        NOT NULL CHECK (chart_type IN (
                'bar', 'bar_horizontal', 'line', 'area',
                'pie', 'donut', 'metric'
              )),
  data_source TEXT        NOT NULL,
  config      JSONB       NOT NULL DEFAULT '{}',
  -- config: { period, color_scheme, show_legend, show_grid }
  position    INTEGER     NOT NULL DEFAULT 0,
  is_visible  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_module ON dashboard_widgets(module);

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Admin e super_admin: acesso total
CREATE POLICY "admin_full_access" ON dashboard_widgets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- Coordinator: leitura
CREATE POLICY "coordinator_read" ON dashboard_widgets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'coordinator'
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_dashboard_widgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dashboard_widgets_updated_at
  BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION update_dashboard_widgets_updated_at();
