-- ============================================================================
-- Migration 00000000000006: Auto-create lead from visit appointment
--
-- Creates a SECURITY DEFINER trigger function that fires after each INSERT
-- on visit_appointments. If the selected visit_reason has lead_integrated=true
-- in system_settings[visit/reasons], a lead is automatically created in the
-- leads table (with deduplication by phone number).
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_lead_from_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reasons         JSONB;
  v_reason          JSONB;
  v_lead_integrated BOOLEAN := FALSE;
  v_existing_lead   UUID;
BEGIN
  -- Load reason config from system_settings
  SELECT value INTO v_reasons
  FROM system_settings
  WHERE category = 'visit' AND key = 'reasons';

  -- If no reasons configured in DB, nothing to do
  IF v_reasons IS NULL OR jsonb_array_length(v_reasons) = 0 THEN
    RETURN NEW;
  END IF;

  -- Find the reason that matches the appointment's visit_reason
  SELECT elem INTO v_reason
  FROM jsonb_array_elements(v_reasons) AS elem
  WHERE elem->>'key' = NEW.visit_reason
  LIMIT 1;

  -- Check lead_integrated flag (defaults to false if not present)
  v_lead_integrated := COALESCE((v_reason->>'lead_integrated')::BOOLEAN, FALSE);

  IF v_lead_integrated THEN
    -- Deduplication: skip if a lead with the same phone already exists
    SELECT id INTO v_existing_lead
    FROM leads
    WHERE phone = NEW.visitor_phone
    LIMIT 1;

    IF v_existing_lead IS NULL THEN
      INSERT INTO leads (
        source_module,
        source_record_id,
        name,
        phone,
        email,
        stage,
        priority,
        tags
      ) VALUES (
        'agendamento',
        NEW.id,
        NEW.visitor_name,
        NEW.visitor_phone,
        NEW.visitor_email,
        'new_lead',
        'medium',
        ARRAY['agendamento']
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if present (idempotent)
DROP TRIGGER IF EXISTS trg_lead_from_appointment ON visit_appointments;

-- Create the trigger
CREATE TRIGGER trg_lead_from_appointment
  AFTER INSERT ON visit_appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_lead_from_appointment();
