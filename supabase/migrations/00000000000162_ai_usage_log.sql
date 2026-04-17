-- Migration 162: ai_usage_log — Sprint 13: Observabilidade de IA
--
-- Log imutável de toda chamada feita através do `ai-orchestrator`. Serve para
-- auditoria (quem chamou o quê), billing interno (tokens), e observabilidade
-- (latência, taxa de erro). Nunca atualizado — apenas INSERT.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug        TEXT NOT NULL,
  provider          TEXT NOT NULL
                      CHECK (provider IN ('anthropic', 'openai')),
  model             TEXT NOT NULL,
  caller_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  input_tokens      INT,
  output_tokens     INT,
  latency_ms        INT,
  status            TEXT NOT NULL
                      CHECK (status IN ('ok', 'error')),
  error_message     TEXT,
  context_hash      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at
  ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_agent_slug
  ON ai_usage_log (agent_slug, created_at DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Admin/super_admin visualizam; inserts só via service_role (edge functions).
CREATE POLICY "ai_usage_log_admin_select" ON ai_usage_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 162 (ai_usage_log)');
