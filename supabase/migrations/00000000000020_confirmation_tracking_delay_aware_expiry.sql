-- Option A: snapshot do delay do template no tracking + expiração
-- que considera esse delay. Evita que confirmações pendentes expirem
-- antes da mensagem sair da fila da UazAPI quando o template usa
-- trigger_delay_minutes alto.

-- 1) Coluna de snapshot (em minutos). Zero = envio imediato.
ALTER TABLE confirmation_tracking
  ADD COLUMN IF NOT EXISTS delay_minutes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN confirmation_tracking.delay_minutes IS
  'Snapshot de whatsapp_templates.trigger_delay_minutes no momento do envio. Usado para calcular a expiração do tracking considerando o tempo que a mensagem fica enfileirada na UazAPI antes de chegar ao contato.';

-- 2) Função de expiração agora soma sent_at + delay_minutes + expiry_hours
CREATE OR REPLACE FUNCTION expire_pending_confirmations() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  expiry_hours int;
BEGIN
  SELECT COALESCE(value::int, 24) INTO expiry_hours
  FROM system_settings
  WHERE category = 'visit' AND key = 'auto_confirm_expiry_hours';

  IF expiry_hours IS NULL THEN expiry_hours := 24; END IF;

  -- Expirar apenas quando já passou:
  --   sent_at (enqueue) + delay_minutes (fila UazAPI) + expiry_hours (janela de resposta)
  UPDATE confirmation_tracking
  SET status = 'expired'
  WHERE status = 'pending'
    AND (
      sent_at
      + make_interval(mins => COALESCE(delay_minutes, 0))
      + make_interval(hours => expiry_hours)
    ) < now();

  -- Reset appointment confirmation_status for expired ones
  UPDATE visit_appointments va
  SET confirmation_status = 'none'
  FROM confirmation_tracking ct
  WHERE ct.appointment_id = va.id
    AND ct.status = 'expired'
    AND va.confirmation_status = 'awaiting';
END;
$$;
