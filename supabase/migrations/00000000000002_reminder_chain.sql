-- ============================================================================
-- Migration 00000000000002: Multi-step reminder chain
--
-- Changes:
--   1. Add `reminders_sent` JSONB column to visit_appointments to track
--      which individual reminder steps (by minutes_before) have been sent.
--   2. Seed `visit.reminder_schedule` in system_settings if not already present.
--   3. Replace process_visit_reminders() to iterate over the JSON array
--      instead of reading a single reminder_hours_before value.
-- ============================================================================

-- 1. Add reminders_sent column
ALTER TABLE visit_appointments
  ADD COLUMN IF NOT EXISTS reminders_sent JSONB NOT NULL DEFAULT '[]';

-- 2. Seed visit.reminder_schedule (default: 24h + 1h before)
INSERT INTO system_settings (category, key, value)
VALUES ('visit', 'reminder_schedule', '[{"minutes_before":1440},{"minutes_before":60}]')
ON CONFLICT (category, key) DO NOTHING;

-- 3. Replace process_visit_reminders() with multi-step logic
CREATE OR REPLACE FUNCTION process_visit_reminders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule      JSONB;
  v_entry         JSONB;
  v_minutes       INT;
  v_window_start  TIMESTAMPTZ;
  v_window_end    TIMESTAMPTZ;
  v_appt          RECORD;
  v_tolerance     INT := 8; -- minutes of tolerance window (half the cron interval)
BEGIN
  -- Load reminder schedule; fall back to [{minutes_before:1440}] if missing
  SELECT value INTO v_schedule
  FROM system_settings
  WHERE category = 'visit' AND key = 'reminder_schedule';

  IF v_schedule IS NULL OR jsonb_array_length(v_schedule) = 0 THEN
    v_schedule := '[{"minutes_before":1440}]'::JSONB;
  END IF;

  -- Iterate over each reminder step in the chain
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_schedule)
  LOOP
    v_minutes := (v_entry->>'minutes_before')::INT;
    IF v_minutes IS NULL OR v_minutes <= 0 THEN CONTINUE; END IF;

    -- Window: appointment_datetime is between (now + minutes - tolerance) and (now + minutes + tolerance)
    -- i.e., the reminder fires when we are ~v_minutes before the appointment
    v_window_start := now() + make_interval(mins => v_minutes - v_tolerance);
    v_window_end   := now() + make_interval(mins => v_minutes + v_tolerance);

    FOR v_appt IN
      SELECT id
      FROM visit_appointments
      WHERE
        status IN ('pending', 'confirmed')
        -- appointment datetime falls inside our firing window
        AND (appointment_date + appointment_time) AT TIME ZONE 'America/Recife'
            BETWEEN v_window_start AND v_window_end
        -- this reminder step not yet sent
        AND NOT (reminders_sent @> jsonb_build_array(v_minutes))
    LOOP
      -- Fire the reminder via auto-notify
      PERFORM notify_auto_trigger('on_reminder', 'agendamento', v_appt.id, NULL, NULL);

      -- Record this step as sent
      UPDATE visit_appointments
         SET reminders_sent = reminders_sent || jsonb_build_array(v_minutes)
       WHERE id = v_appt.id;
    END LOOP;
  END LOOP;
END;
$$;

-- NOTE: pg_cron job (run once via Supabase SQL editor as superuser if not already scheduled):
-- SELECT cron.schedule('visit-reminders', '*/15 * * * *', 'SELECT process_visit_reminders()');
