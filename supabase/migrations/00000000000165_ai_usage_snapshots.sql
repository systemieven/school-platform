-- Migration 165: ai_usage_snapshots — Sprint 13.IA-dash PR1
--
-- Snapshot diário por provider com dados consolidados do billing oficial
-- (Anthropic /v1/organizations/usage_report + OpenAI /v1/organization/usage|costs).
-- O job `pg_cron` dispara `ai-billing-sync` às 00:01 UTC e persiste aqui.
--
-- RLS: admin/super_admin SELECT; inserts apenas via service_role na Edge Function.

CREATE TABLE IF NOT EXISTS ai_usage_snapshots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                  TEXT NOT NULL CHECK (provider IN ('anthropic','openai')),
  snapshot_date             DATE NOT NULL,
  balance_usd               NUMERIC(14,4),
  total_spent_usd           NUMERIC(14,4),
  tokens_input              BIGINT,
  tokens_output             BIGINT,
  requests_count            INTEGER,
  auto_recharge_enabled     BOOLEAN,
  auto_recharge_threshold   NUMERIC(14,4),
  auto_recharge_amount      NUMERIC(14,4),
  raw_payload               JSONB,
  fetched_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_snapshots_date
  ON ai_usage_snapshots (snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_snapshots_provider_date
  ON ai_usage_snapshots (provider, snapshot_date DESC);

ALTER TABLE ai_usage_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_snapshots_admin_select" ON ai_usage_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 165 (ai_usage_snapshots)');
