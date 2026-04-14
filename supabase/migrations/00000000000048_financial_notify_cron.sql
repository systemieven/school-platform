-- ══════════════════════════════════════════════════════════════════════════════
-- pg_cron job: financial-notify — dispara diariamente às 08:00 BRT (11:00 UTC)
-- Chama a Edge Function financial-notify via pg_net.
-- ══════════════════════════════════════════════════════════════════════════════

-- Garantir extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover job anterior se existir
SELECT cron.unschedule('financial-notify-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'financial-notify-daily'
);

-- Agendar execução diária
SELECT cron.schedule(
  'financial-notify-daily',
  '0 11 * * *',  -- 11:00 UTC = 08:00 BRT
  $$
  SELECT net.http_post(
    url    := current_setting('app.settings.supabase_url') || '/functions/v1/financial-notify',
    body   := '{}'::jsonb,
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
