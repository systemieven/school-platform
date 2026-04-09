-- ============================================================================
-- Migration 18: Confirmation Tracking
-- Automated appointment confirmation via WhatsApp button responses.
-- ============================================================================

-- Tabela de rastreamento de confirmações pendentes
CREATE TABLE IF NOT EXISTS confirmation_tracking (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id        text NOT NULL UNIQUE,
  appointment_id       uuid NOT NULL REFERENCES visit_appointments(id) ON DELETE CASCADE,
  template_id          uuid REFERENCES whatsapp_templates(id),
  phone                text NOT NULL,
  sent_at              timestamptz NOT NULL DEFAULT now(),
  responded_at         timestamptz,
  response_button_id   text,
  response_button_text text,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','confirmed','cancelled','expired','ignored')),
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ct_wa_message   ON confirmation_tracking(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_ct_appointment  ON confirmation_tracking(appointment_id);
CREATE INDEX IF NOT EXISTS idx_ct_status       ON confirmation_tracking(status);

-- Coluna no agendamento para status de confirmação
ALTER TABLE visit_appointments
  ADD COLUMN IF NOT EXISTS confirmation_status text DEFAULT 'none'
    CHECK (confirmation_status IN ('none','awaiting','confirmed','cancelled'));

-- Settings para confirmação automática
INSERT INTO system_settings (category, key, value, description) VALUES
  ('visit', 'auto_confirm_enabled',      'false',                          'Ativar confirmação automática de agendamentos via WhatsApp'),
  ('visit', 'auto_confirm_positive_ids', '["sim","confirmar","yes"]',      'IDs de botão que confirmam o agendamento'),
  ('visit', 'auto_confirm_negative_ids', '["nao","cancelar","no"]',        'IDs de botão que cancelam o agendamento'),
  ('visit', 'auto_confirm_expiry_hours', '24',                             'Horas até expirar confirmação pendente')
ON CONFLICT (category, key) DO NOTHING;

-- Função de expiração de confirmações pendentes
CREATE OR REPLACE FUNCTION expire_pending_confirmations() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  expiry_hours int;
BEGIN
  SELECT COALESCE(value::int, 24) INTO expiry_hours
  FROM system_settings
  WHERE category = 'visit' AND key = 'auto_confirm_expiry_hours';

  IF expiry_hours IS NULL THEN expiry_hours := 24; END IF;

  -- Expire pending trackings
  UPDATE confirmation_tracking
  SET status = 'expired'
  WHERE status = 'pending'
    AND sent_at < now() - (expiry_hours || ' hours')::interval;

  -- Reset appointment confirmation_status for expired ones
  UPDATE visit_appointments va
  SET confirmation_status = 'none'
  FROM confirmation_tracking ct
  WHERE ct.appointment_id = va.id
    AND ct.status = 'expired'
    AND va.confirmation_status = 'awaiting';
END;
$$;

-- pg_cron: expirar confirmações a cada hora
SELECT cron.schedule(
  'expire-confirmations',
  '0 * * * *',
  'SELECT expire_pending_confirmations()'
);
