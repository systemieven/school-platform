-- Fix: auto_create_lead_from_appointment crashava com
--   "cannot get array length of a scalar"
-- quando system_settings.visit.reasons estava salvo como string JSON
-- (em vez de array jsonb nativo). Normaliza o valor antes de usar
-- jsonb_array_length, aceitando string JSON, array nativo ou null.

CREATE OR REPLACE FUNCTION public.auto_create_lead_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_raw             JSONB;
  v_reasons         JSONB;
  v_reason          JSONB;
  v_lead_integrated BOOLEAN := FALSE;
  v_existing_lead   UUID;
BEGIN
  -- Load reason config from system_settings
  SELECT value INTO v_raw
  FROM system_settings
  WHERE category = 'visit' AND key = 'reasons';

  -- Normaliza: se for string JSON, parseia; se já for array, usa direto
  IF v_raw IS NULL THEN
    RETURN NEW;
  ELSIF jsonb_typeof(v_raw) = 'string' THEN
    BEGIN
      v_reasons := (v_raw #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RETURN NEW;
    END;
  ELSE
    v_reasons := v_raw;
  END IF;

  IF v_reasons IS NULL
     OR jsonb_typeof(v_reasons) <> 'array'
     OR jsonb_array_length(v_reasons) = 0 THEN
    RETURN NEW;
  END IF;

  -- Find the reason that matches the appointment's visit_reason
  SELECT elem INTO v_reason
  FROM jsonb_array_elements(v_reasons) AS elem
  WHERE elem->>'key' = NEW.visit_reason
  LIMIT 1;

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
$function$;
