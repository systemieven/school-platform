-- 171: remove rastreamento de saldo do módulo de IA.
-- Motivo: nem Anthropic nem OpenAI expõem saldo/créditos restantes via Admin API
-- (só usage + cost). Manter cards de "saldo estimado" baseados em recargas
-- manuais dava falsa sensação de precisão — o saldo real é compartilhado entre
-- workspaces/projetos e só é confiável no console do provider.
--
-- O que sai:
--   * tabela ai_recharges (histórico de recargas manuais/inferidas)
--   * colunas balance_usd, auto_recharge_* de ai_usage_snapshots
--   * coluna balance_alert_threshold de company_ai_config
--
-- O que permanece:
--   * total_spent_usd, tokens_input/output, requests_count em ai_usage_snapshots
--     (dados reais do cost_report do provider)

DROP TABLE IF EXISTS ai_recharges CASCADE;

ALTER TABLE ai_usage_snapshots
  DROP COLUMN IF EXISTS balance_usd,
  DROP COLUMN IF EXISTS auto_recharge_enabled,
  DROP COLUMN IF EXISTS auto_recharge_threshold,
  DROP COLUMN IF EXISTS auto_recharge_amount;

ALTER TABLE company_ai_config
  DROP COLUMN IF EXISTS balance_alert_threshold;
