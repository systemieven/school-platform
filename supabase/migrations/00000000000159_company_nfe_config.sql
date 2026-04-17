-- Migration 159: company_nfe_config — Sprint 14.S.P-ter: Emissão de NF-e (modelo 55)
--
-- Tabela singleton de configuração do emitente NF-e (SEFAZ estadual).
-- Separada de company_nfse_config e company_nfce_config porque NF-e, NFS-e e NFC-e
-- são documentos distintos com ambientes, séries, numeração e credenciais independentes.
--
-- Escopo v1: emissão de NF-e de devolução a partir de nfe_entries. Sem CSC/idCSC
-- (NF-e não usa QRCode SEFAZ como NFC-e) e sem auto_emit (operação sempre manual).
-- Certificado digital A1 é compartilhado via Nuvem Fiscal com NFS-e/NFC-e (mesmo CNPJ).

CREATE TABLE IF NOT EXISTS company_nfe_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente              TEXT NOT NULL DEFAULT 'homologacao'
                          CHECK (ambiente IN ('producao', 'homologacao')),
  serie                 INT NOT NULL DEFAULT 1,
  proximo_numero        INT NOT NULL DEFAULT 1,
  provider              TEXT NOT NULL DEFAULT 'nuvem_fiscal'
                          CHECK (provider IN ('nuvem_fiscal', 'outro')),
  api_token_enc         TEXT,
  api_base_url          TEXT,
  webhook_url           TEXT,
  webhook_secret        TEXT,
  integration_status    TEXT NOT NULL DEFAULT 'none'
                          CHECK (integration_status IN ('none', 'homologacao', 'ativa', 'erro')),
  last_test_at          TIMESTAMPTZ,
  last_test_result      TEXT,
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_nfe_config_singleton
  ON company_nfe_config ((true));

ALTER TABLE company_nfe_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_config_admin_all" ON company_nfe_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfe_config_coordinator_select" ON company_nfe_config
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE OR REPLACE FUNCTION set_nfe_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_nfe_config_updated_at
  BEFORE UPDATE ON company_nfe_config
  FOR EACH ROW EXECUTE FUNCTION set_nfe_config_updated_at();

-- RPC atômico para reserva de número (evita race em emissões simultâneas)
CREATE OR REPLACE FUNCTION increment_nfe_numero()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_numero INTEGER;
BEGIN
  UPDATE company_nfe_config
     SET proximo_numero = proximo_numero + 1, updated_at = now()
   WHERE id = (SELECT id FROM company_nfe_config LIMIT 1)
   RETURNING proximo_numero - 1 INTO v_numero;
  IF v_numero IS NULL THEN RAISE EXCEPTION 'company_nfe_config nao configurado'; END IF;
  RETURN v_numero;
END; $$;

REVOKE ALL ON FUNCTION increment_nfe_numero() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_nfe_numero() TO service_role;

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'fiscal',
  'Aplicada migration 159 (company_nfe_config + increment_nfe_numero)'
);
