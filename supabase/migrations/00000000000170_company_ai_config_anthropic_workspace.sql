-- 170: Anthropic workspace filter para ai-billing-sync.
-- Permite escopar o consumo a um Workspace específico em vez da organização inteira.
-- Usado pelo edge function ai-billing-sync quando chama
--   /v1/organizations/usage_report/messages
--   /v1/organizations/cost_report
-- via query param `workspace_ids[]`.
ALTER TABLE company_ai_config
  ADD COLUMN IF NOT EXISTS anthropic_workspace_id TEXT;
