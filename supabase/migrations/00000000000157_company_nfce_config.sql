-- Migration 157: company_nfce_config — Sprint 14.S.P-bis: Emissão de NFC-e (modelo 65)
--
-- Tabela singleton de configuração do emitente NFC-e. Separada de company_nfse_config
-- porque NFC-e e NFS-e são documentos distintos (SEFAZ estadual vs prefeitura),
-- com ambientes, séries, numeração e credenciais independentes.
--
-- CSC (Código de Segurança do Contribuinte) e idCSC: fornecidos pela SEFAZ estadual
-- ao credenciar o emitente, usados para assinar o QRCode impresso no DANFE NFC-e.
--
-- Dados do emitente (CNPJ, razão social, IE) são herdados de company_fiscal_config —
-- NFC-e usa a mesma pessoa jurídica.

CREATE TABLE IF NOT EXISTS company_nfce_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente              TEXT NOT NULL DEFAULT 'homologacao'
                          CHECK (ambiente IN ('producao', 'homologacao')),
  serie                 INT NOT NULL DEFAULT 1,
  proximo_numero        INT NOT NULL DEFAULT 1,
  csc                   TEXT,
  id_csc                TEXT,
  provider              TEXT NOT NULL DEFAULT 'nuvem_fiscal'
                          CHECK (provider IN ('nuvem_fiscal', 'outro')),
  api_token_enc         TEXT,
  api_base_url          TEXT,
  webhook_url           TEXT,
  webhook_secret        TEXT,
  integration_status    TEXT NOT NULL DEFAULT 'none'
                          CHECK (integration_status IN ('none', 'homologacao', 'ativa')),
  auto_emit_on_payment  BOOLEAN NOT NULL DEFAULT false,
  last_test_at          TIMESTAMPTZ,
  last_test_result      TEXT,
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_nfce_config_singleton
  ON company_nfce_config ((true));

ALTER TABLE company_nfce_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfce_config_admin_all" ON company_nfce_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfce_config_coordinator_select" ON company_nfce_config
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE OR REPLACE FUNCTION set_nfce_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_nfce_config_updated_at
  BEFORE UPDATE ON company_nfce_config
  FOR EACH ROW EXECUTE FUNCTION set_nfce_config_updated_at();

-- RPC atomico para reserva de numero (evita race em emissoes simultaneas)
CREATE OR REPLACE FUNCTION increment_nfce_numero()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_numero INTEGER;
BEGIN
  UPDATE company_nfce_config
     SET proximo_numero = proximo_numero + 1, updated_at = now()
   WHERE id = (SELECT id FROM company_nfce_config LIMIT 1)
   RETURNING proximo_numero - 1 INTO v_numero;
  IF v_numero IS NULL THEN RAISE EXCEPTION 'company_nfce_config nao configurado'; END IF;
  RETURN v_numero;
END; $$;

REVOKE ALL ON FUNCTION increment_nfce_numero() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_nfce_numero() TO service_role;

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'fiscal',
  'Aplicada migration 157 (company_nfce_config + increment_nfce_numero)'
);
