-- Migration 166: ai_recharges — Sprint 13.IA-dash PR1
--
-- Histórico de recargas (créditos adicionados) por provider. Como nem Anthropic
-- nem OpenAI expõem endpoint público de recharges, esta tabela alimenta-se de:
--   a) registro manual pelo admin via UI ("Registrar recarga")
--   b) inferência automática em `ai-billing-sync` quando o saldo oficial salta
--      entre dois snapshots consecutivos (source = 'auto').

CREATE TABLE IF NOT EXISTS ai_recharges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       TEXT NOT NULL CHECK (provider IN ('anthropic','openai')),
  amount_usd     NUMERIC(14,4) NOT NULL,
  recharged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  source         TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto','inferred')),
  external_id    TEXT,
  raw_payload    JSONB,
  recorded_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recharges_provider_date
  ON ai_recharges (provider, recharged_at DESC);

ALTER TABLE ai_recharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_recharges_admin_all" ON ai_recharges
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 166 (ai_recharges)');
