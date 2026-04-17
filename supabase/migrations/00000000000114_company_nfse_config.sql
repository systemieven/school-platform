-- Migration 114: company_nfse_config — Fase 14.S: Emissão Automática de NFS-e
-- Tabela singleton de configuração do emitente NFS-e

CREATE TABLE IF NOT EXISTS company_nfse_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_municipal   TEXT,
  codigo_municipio_ibge TEXT,
  ambiente              TEXT NOT NULL DEFAULT 'homologacao'
                          CHECK (ambiente IN ('producao', 'homologacao')),
  serie                 TEXT NOT NULL DEFAULT 'RPS',
  proximo_numero        INT NOT NULL DEFAULT 1,
  aliq_iss_padrao       NUMERIC(5,2) DEFAULT 5.00,
  reter_pis             BOOLEAN NOT NULL DEFAULT false,
  reter_cofins          BOOLEAN NOT NULL DEFAULT false,
  reter_csll            BOOLEAN NOT NULL DEFAULT false,
  reter_irpj            BOOLEAN NOT NULL DEFAULT false,
  reter_inss            BOOLEAN NOT NULL DEFAULT false,
  optante_simples       BOOLEAN NOT NULL DEFAULT false,
  incentivador_cultural BOOLEAN NOT NULL DEFAULT false,
  provider              TEXT NOT NULL DEFAULT 'outro'
                          CHECK (provider IN ('focus', 'enotas', 'nuvem_fiscal', 'nfse_io', 'outro')),
  api_token_enc         TEXT,
  api_base_url          TEXT,
  webhook_url           TEXT,
  webhook_secret        TEXT,
  cert_pfx_enc          TEXT,
  integration_status    TEXT NOT NULL DEFAULT 'none'
                          CHECK (integration_status IN ('none', 'homologacao', 'ativa')),
  last_test_at          TIMESTAMPTZ,
  last_test_result      TEXT,
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_nfse_config_singleton
  ON company_nfse_config ((true));

ALTER TABLE company_nfse_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfse_config_admin_all" ON company_nfse_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfse_config_coordinator_select" ON company_nfse_config
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE OR REPLACE FUNCTION set_nfse_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_nfse_config_updated_at
  BEFORE UPDATE ON company_nfse_config
  FOR EACH ROW EXECUTE FUNCTION set_nfse_config_updated_at();
