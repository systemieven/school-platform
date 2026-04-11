-- ============================================================
-- Opção de numeração contínua (sem reset diário)
-- ============================================================

-- 1. Substituir a função de geração de número de senha para suportar daily_reset
CREATE OR REPLACE FUNCTION next_attendance_ticket_number(
  p_sector_key TEXT,
  p_format JSONB
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_prefix_mode       TEXT;
  v_custom_prefix     TEXT;
  v_digits            INT;
  v_per_sector        BOOLEAN;
  v_daily_reset       BOOLEAN;
  v_count             INT;
  v_prefix            TEXT;
BEGIN
  v_prefix_mode   := COALESCE(p_format ->> 'prefix_mode', 'none');
  v_custom_prefix := COALESCE(p_format ->> 'custom_prefix', '');
  v_digits        := COALESCE((p_format ->> 'digits')::INT, 3);
  v_per_sector    := COALESCE((p_format ->> 'per_sector_counter')::BOOLEAN, false);
  v_daily_reset   := COALESCE((p_format ->> 'daily_reset')::BOOLEAN, true);

  IF v_daily_reset THEN
    -- Modo diário: conta apenas tickets emitidos hoje
    IF v_per_sector THEN
      SELECT COUNT(*) INTO v_count
      FROM attendance_tickets
      WHERE issued_at::date = CURRENT_DATE
        AND sector_key = p_sector_key;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM attendance_tickets
      WHERE issued_at::date = CURRENT_DATE;
    END IF;
  ELSE
    -- Modo contínuo: conta TODOS os tickets já emitidos
    IF v_per_sector THEN
      SELECT COUNT(*) INTO v_count
      FROM attendance_tickets
      WHERE sector_key = p_sector_key;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM attendance_tickets;
    END IF;
  END IF;

  v_count := v_count + 1;

  IF v_prefix_mode = 'sector' THEN
    v_prefix := UPPER(LEFT(p_sector_key, 1));
  ELSIF v_prefix_mode = 'custom' THEN
    v_prefix := v_custom_prefix;
  ELSE
    v_prefix := '';
  END IF;

  RETURN v_prefix || LPAD(v_count::TEXT, v_digits, '0');
END; $$;

-- 2. Garantir que o setting existente tenha o campo daily_reset
UPDATE system_settings
SET value = value || '{"daily_reset": true}'::jsonb
WHERE category = 'attendance' AND key = 'ticket_format'
  AND NOT (value ? 'daily_reset');
