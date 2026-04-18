-- 183: pg_cron para ai-scheduled-runner (Sprint 13.IA.v2 PR5)
-- Agenda 3 jobs (hourly, 6h, 12h) que disparam ai-scheduled-runner com
-- cadence correspondente. Cada agente registrado com run_on_cron=<cadence>
-- é fan-out pelo runner para o ai-event-dispatcher.

DO $$
DECLARE
  v_secret  TEXT;
  v_url     TEXT := 'https://dinbwugbwnkrzljuocbs.supabase.co';
  v_headers TEXT;
BEGIN
  SELECT value #>> '{}' INTO v_secret
    FROM system_settings
   WHERE category = 'internal' AND key = 'trigger_secret';

  IF v_secret IS NULL THEN
    RAISE NOTICE '[migration 183] trigger_secret ausente — cron jobs não agendados';
    RETURN;
  END IF;

  v_headers := format(
    '{"Content-Type":"application/json","x-trigger-secret":"%s"}',
    v_secret
  );

  -- Remove jobs antigos (idempotência em reexecuções)
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname IN ('ai_runner_hourly', 'ai_runner_6h', 'ai_runner_12h');

  PERFORM cron.schedule(
    'ai_runner_hourly',
    '3 * * * *',
    format(
      $cmd$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      );$cmd$,
      v_url || '/functions/v1/ai-scheduled-runner',
      v_headers,
      '{"cadence":"hourly"}'
    )
  );

  PERFORM cron.schedule(
    'ai_runner_6h',
    '5 */6 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      );$cmd$,
      v_url || '/functions/v1/ai-scheduled-runner',
      v_headers,
      '{"cadence":"6h"}'
    )
  );

  PERFORM cron.schedule(
    'ai_runner_12h',
    '7 */12 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      );$cmd$,
      v_url || '/functions/v1/ai-scheduled-runner',
      v_headers,
      '{"cadence":"12h"}'
    )
  );
END $$;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 183 (pg_cron ai_runner hourly/6h/12h)');
