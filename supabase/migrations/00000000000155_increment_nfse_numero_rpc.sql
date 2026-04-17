-- Migration 155: increment_nfse_numero RPC — Sprint 14.S.P.1
--
-- RPC atomico para reservar e incrementar o proximo numero da NFS-e.
-- Evita race-condition quando ha emissoes simultaneas.
-- Retorna o numero RESERVADO (o que sera gravado em nfse_emitidas.numero) e
-- deixa company_nfse_config.proximo_numero com o numero seguinte ja aplicado.

CREATE OR REPLACE FUNCTION increment_nfse_numero()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  UPDATE company_nfse_config
     SET proximo_numero = proximo_numero + 1,
         updated_at     = now()
   WHERE id = (SELECT id FROM company_nfse_config LIMIT 1)
   RETURNING proximo_numero - 1
      INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'company_nfse_config nao configurado';
  END IF;

  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION increment_nfse_numero() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_nfse_numero() TO service_role;

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'fiscal',
  'Aplicada migration 155 (increment_nfse_numero RPC)'
);
