-- ============================================================================
-- Migration 00000000000007: Auto-create lead from contact request
--
-- SECURITY DEFINER trigger that fires after each INSERT on contact_requests.
-- If the contact_reason's lead_integrated flag is true in
-- system_settings[contact/contact_reasons], creates a lead in leads table
-- (deduplicating by phone). Also marks the contact_request as is_lead = true.
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_lead_from_contact()
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
  -- Load contact reason config from system_settings
  SELECT value INTO v_reasons
  FROM system_settings
  WHERE category = 'contact' AND key = 'contact_reasons';

  -- If no reasons configured, nothing to do
  IF v_reasons IS NULL OR jsonb_array_length(v_reasons) = 0 THEN
    RETURN NEW;
  END IF;

  -- Find the reason matching the contact_reason field
  -- Reasons stored with key field; fallback to value field for legacy data
  SELECT elem INTO v_reason
  FROM jsonb_array_elements(v_reasons) AS elem
  WHERE
    elem->>'key'   = NEW.contact_reason OR
    elem->>'value' = NEW.contact_reason
  LIMIT 1;

  v_lead_integrated := COALESCE((v_reason->>'lead_integrated')::BOOLEAN, FALSE);

  IF v_lead_integrated THEN
    -- Deduplication: skip if lead with same phone already exists
    SELECT id INTO v_existing_lead
    FROM leads
    WHERE phone = NEW.phone
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
        'contato',
        NEW.id,
        NEW.name,
        NEW.phone,
        NEW.email,
        'new_lead',
        'medium',
        ARRAY['contato']
      );
    END IF;

    -- Mark the contact request itself as a lead
    UPDATE contact_requests
       SET is_lead = TRUE
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_from_contact ON contact_requests;

CREATE TRIGGER trg_lead_from_contact
  AFTER INSERT ON contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_lead_from_contact();
