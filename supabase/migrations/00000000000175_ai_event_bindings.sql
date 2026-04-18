-- 175: ai_event_bindings + extensão de ai_agents para disparos proativos
-- Tabela de bindings: mapeia event_type (emitido por triggers Postgres ou
-- pelo scheduled-runner) para o agent_slug que deve ser invocado. Permite
-- configurar debounce por binding (evita runaway de triggers em alta volume).

CREATE TABLE IF NOT EXISTS ai_event_bindings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  agent_slug      TEXT NOT NULL REFERENCES ai_agents(slug) ON DELETE CASCADE,
  debounce_hours  INT  NOT NULL DEFAULT 6 CHECK (debounce_hours >= 0),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_type, agent_slug)
);

CREATE INDEX IF NOT EXISTS ai_event_bindings_event
  ON ai_event_bindings(event_type) WHERE enabled = true;

DROP TRIGGER IF EXISTS trg_ai_event_bindings_updated_at ON ai_event_bindings;
CREATE TRIGGER trg_ai_event_bindings_updated_at
  BEFORE UPDATE ON ai_event_bindings
  FOR EACH ROW EXECUTE FUNCTION set_ai_agents_updated_at();

ALTER TABLE ai_event_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_event_bindings_admin_all" ON ai_event_bindings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')
    )
  );

-- Extensão de ai_agents para suporte a modos proativos
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS run_on_login BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS run_on_event TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS run_on_cron  TEXT,
  ADD COLUMN IF NOT EXISTS debounce_hours INT NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS audience TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 175 (ai_event_bindings + ai_agents alter proativo)');
