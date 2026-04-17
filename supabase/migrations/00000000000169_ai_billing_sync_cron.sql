-- Migration 169: pg_cron ai-billing-sync — Sprint 13.IA-dash PR1
--
-- Job diário às 00:01 UTC que chama a Edge Function `ai-billing-sync`.
-- A função consulta as APIs admin de Anthropic e OpenAI, persiste em
-- `ai_usage_snapshots` e `ai_recharges`, e alimenta o dashboard de IA.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('ai-billing-sync-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ai-billing-sync-daily'
);

SELECT cron.schedule(
  'ai-billing-sync-daily',
  '1 0 * * *',  -- 00:01 UTC
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/ai-billing-sync',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'X-Trigger-Secret', (
        SELECT value::text FROM system_settings
        WHERE category = 'internal' AND key = 'trigger_secret'
        LIMIT 1
      )
    )
  );
  $$
);

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 169 (pg_cron ai-billing-sync-daily 00:01 UTC)');
