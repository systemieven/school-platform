-- Migration 111: company_fiscal_config — Fase 16: Estrutura Fiscal
-- Configuração fiscal da empresa emitente (singleton via partial unique index).
-- Armazena regime tributário, ambiente NF-e, séries, CFOPs padrão e integração com provedor.

CREATE TABLE IF NOT EXISTS company_fiscal_config (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Emitente
  razao_social              TEXT,
  nome_fantasia             TEXT,
  cnpj                      TEXT,
  ie                        TEXT,
  im                        TEXT,
  logradouro                TEXT,
  numero                    TEXT,
  complemento               TEXT,
  bairro                    TEXT,
  cep                       TEXT,
  municipio                 TEXT,
  uf                        TEXT,
  regime_tributario         TEXT NOT NULL DEFAULT 'simples_nacional'
                              CHECK (regime_tributario IN ('simples_nacional','lucro_presumido','lucro_real')),
  -- Emissão
  ambiente                  TEXT NOT NULL DEFAULT 'homologacao'
                              CHECK (ambiente IN ('producao','homologacao')),
  serie_nfe                 INT NOT NULL DEFAULT 1,
  proximo_numero_nfe        BIGINT NOT NULL DEFAULT 1,
  cfop_venda_interna        TEXT DEFAULT '5102',
  cfop_venda_interestadual  TEXT DEFAULT '6102',
  cfop_devolucao            TEXT DEFAULT '1202',
  aliq_pis_padrao           NUMERIC(5,4) DEFAULT 0.0065,
  aliq_cofins_padrao        NUMERIC(5,4) DEFAULT 0.0300,
  -- Integração (estrutural — token sensível deve ser criptografado na camada de aplicação)
  nfe_provider              TEXT NOT NULL DEFAULT ''
                              CHECK (nfe_provider IN ('focus','enotas','nuvem_fiscal','outro','')),
  nfe_api_token             TEXT,
  nfe_webhook_url           TEXT,
  nfe_integration_status    TEXT NOT NULL DEFAULT 'none'
                              CHECK (nfe_integration_status IN ('none','homologacao','ativa')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Singleton: apenas uma linha permitida
CREATE UNIQUE INDEX IF NOT EXISTS company_fiscal_config_singleton ON company_fiscal_config ((TRUE));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_company_fiscal_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER company_fiscal_config_updated_at
  BEFORE UPDATE ON company_fiscal_config
  FOR EACH ROW EXECUTE FUNCTION update_company_fiscal_config_updated_at();

-- RLS
ALTER TABLE company_fiscal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_fiscal_config_admin_all" ON company_fiscal_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  );

CREATE POLICY "company_fiscal_config_coordinator_select" ON company_fiscal_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );
