-- Migration 167: company_ai_config — admin keys — Sprint 13.IA-dash PR1
--
-- Adiciona colunas para Admin API keys (separadas das keys de inference) e o
-- OpenAI Organization ID. As admin keys são usadas por `ai-billing-sync` para
-- ler usage/cost das APIs oficiais:
--   - Anthropic: Organization Admin Key (console → Organization → Admin Keys)
--   - OpenAI:    sk-admin-* + header OpenAI-Organization: org-...
--
-- Mantém padrão singleton e o mesmo fluxo de UI (card "Chaves de API" em
-- AiAgentsPanel), sem exigir acesso ao dashboard Supabase.

ALTER TABLE company_ai_config
  ADD COLUMN IF NOT EXISTS anthropic_admin_api_key TEXT,
  ADD COLUMN IF NOT EXISTS openai_admin_api_key    TEXT,
  ADD COLUMN IF NOT EXISTS openai_organization_id  TEXT,
  ADD COLUMN IF NOT EXISTS balance_alert_threshold NUMERIC(10,2);

COMMENT ON COLUMN company_ai_config.anthropic_admin_api_key IS
  'Organization Admin Key do console Anthropic (distinta da key de inference).';
COMMENT ON COLUMN company_ai_config.openai_admin_api_key IS
  'sk-admin-* gerada em Settings → Organization → Admin keys.';
COMMENT ON COLUMN company_ai_config.openai_organization_id IS
  'org-... usado no header OpenAI-Organization das chamadas admin.';
COMMENT ON COLUMN company_ai_config.balance_alert_threshold IS
  'Saldo estimado (USD) abaixo do qual o dashboard exibe alerta vermelho.';

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 167 (company_ai_config + admin keys)');
