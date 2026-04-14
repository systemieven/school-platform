-- ══════════════════════════════════════════════════════════════════════════════
-- RPC: get_pix_key()
-- Retorna a chave PIX configurada para o portal do aluno.
-- SECURITY DEFINER para que alunos (sem acesso a system_settings) possam ler.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_pix_key()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type  TEXT;
  v_value TEXT;
BEGIN
  SELECT value INTO v_type
    FROM system_settings
   WHERE category = 'financial' AND key = 'pix_key_type'
   LIMIT 1;

  SELECT value INTO v_value
    FROM system_settings
   WHERE category = 'financial' AND key = 'pix_key_value'
   LIMIT 1;

  IF v_type IS NULL OR v_value IS NULL OR v_value = '' THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object('type', v_type, 'value', v_value);
END;
$$;

-- Permitir que qualquer autenticado chame (alunos do portal)
GRANT EXECUTE ON FUNCTION get_pix_key() TO authenticated;
