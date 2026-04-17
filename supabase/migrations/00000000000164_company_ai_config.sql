-- Migration 164: company_ai_config — Sprint 13 PR1.5
--
-- Singleton de configuração de IA para que o admin possa gerenciar as chaves
-- de API Anthropic/OpenAI pela UI (mesmo padrão dos providers fiscais),
-- sem precisar do dashboard Supabase.
--
-- RLS: apenas admin/super_admin (chaves são segredos).

CREATE TABLE IF NOT EXISTS company_ai_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anthropic_api_key    TEXT,
  openai_api_key       TEXT,
  updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_ai_config_singleton
  ON company_ai_config ((true));

ALTER TABLE company_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_config_admin_all" ON company_ai_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE OR REPLACE FUNCTION set_ai_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ai_config_updated_at
  BEFORE UPDATE ON company_ai_config
  FOR EACH ROW EXECUTE FUNCTION set_ai_config_updated_at();

INSERT INTO company_ai_config (anthropic_api_key, openai_api_key)
SELECT NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM company_ai_config);

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 164 (company_ai_config singleton)');
