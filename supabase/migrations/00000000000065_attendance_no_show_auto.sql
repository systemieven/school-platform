-- Migration 65: Auto-no-show for past appointments
-- Creates a function that reads the `no_show_config` attendance setting and marks
-- 'pending'/'confirmed' appointments as 'no_show' after the configured timeout.
--
-- The cron job must be scheduled once manually via the Supabase SQL editor (as superuser):
--   SELECT cron.schedule('no-show-checker', '*/15 * * * *', 'SELECT mark_appointment_no_shows()');

CREATE OR REPLACE FUNCTION mark_appointment_no_shows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cfg             jsonb;
  v_enabled         boolean;
  v_timeout_minutes int;
BEGIN
  -- Read configuration from system_settings
  SELECT value INTO v_cfg
  FROM   system_settings
  WHERE  category = 'attendance'
    AND  key      = 'no_show_config';

  -- If no config row yet, do nothing
  IF v_cfg IS NULL THEN
    RETURN;
  END IF;

  v_enabled         := COALESCE((v_cfg->>'enabled')::boolean, false);
  v_timeout_minutes := COALESCE((v_cfg->>'timeout_minutes')::int, 60);

  IF NOT v_enabled THEN
    RETURN;
  END IF;

  -- Mark as no_show: appointments whose scheduled datetime + timeout has passed
  -- and have not yet been acted on (still pending or confirmed).
  -- appointment_date (DATE) + appointment_time (TIME) → timestamp interpreted in
  -- America/Recife to match the existing reminder_chain timezone convention.
  UPDATE visit_appointments
  SET    status     = 'no_show',
         updated_at = now()
  WHERE  status IN ('pending', 'confirmed')
    AND  (appointment_date + appointment_time) AT TIME ZONE 'America/Recife'
         < now() - (v_timeout_minutes * INTERVAL '1 minute');
END;
$$;

-- NOTE: Schedule the cron job once via Supabase SQL editor as superuser:
-- SELECT cron.schedule('no-show-checker', '*/15 * * * *', 'SELECT mark_appointment_no_shows()');
