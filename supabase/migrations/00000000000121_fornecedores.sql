-- Migration 121: fornecedores — Fase 14.E: Módulo de Fornecedores
-- Tabela principal de fornecedores com dados cadastrais, contato,
-- endereço, dados fiscais e condições comerciais.

CREATE TABLE IF NOT EXISTS fornecedores (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificação
  tipo_pessoa                 TEXT          NOT NULL DEFAULT 'juridica'
                                            CHECK (tipo_pessoa IN ('fisica','juridica')),
  cnpj_cpf                    TEXT          NOT NULL,
  razao_social                TEXT          NOT NULL,
  nome_fantasia               TEXT,
  ie                          TEXT,
  im                          TEXT,
  suframa                     TEXT,
  optante_simples             BOOLEAN       NOT NULL DEFAULT false,
  -- Contato
  email                       TEXT,
  email_financeiro            TEXT,
  telefone                    TEXT,
  telefone_secundario         TEXT,
  contato_nome                TEXT,
  contato_telefone            TEXT,
  site                        TEXT,
  -- Endereço
  cep                         TEXT,
  logradouro                  TEXT,
  numero                      TEXT,
  complemento                 TEXT,
  bairro                      TEXT,
  municipio                   TEXT,
  uf                          TEXT,
  pais                        TEXT          NOT NULL DEFAULT 'Brasil',
  codigo_municipio_ibge       TEXT,
  -- Dados fiscais
  regime_tributario           TEXT          CHECK (regime_tributario IN (
                                              'simples_nacional','lucro_presumido',
                                              'lucro_real','mei','nao_contribuinte',''
                                            )),
  cnae_principal              TEXT,
  contribuinte_icms           TEXT          CHECK (contribuinte_icms IN (
                                              'contribuinte','nao_contribuinte','isento',''
                                            )),
  -- Condições comerciais
  prazo_pagamento_dias        INT           DEFAULT 30,
  forma_pagamento_preferencial TEXT         CHECK (forma_pagamento_preferencial IN (
                                              'pix','boleto','transferencia','cartao','outro',''
                                            )),
  limite_credito              NUMERIC(12,2),
  observacoes                 TEXT,
  -- Classificação
  categoria                   TEXT,         -- material_escolar | fardamento | alimentacao |
                                            --   servicos | tecnologia | manutencao | outro
  tags                        TEXT[]        NOT NULL DEFAULT '{}',
  status                      TEXT          NOT NULL DEFAULT 'ativo'
                                            CHECK (status IN ('ativo','inativo','bloqueado')),
  -- Auditoria
  created_by                  UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- cnpj_cpf único por fornecedor
CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_cnpj_cpf
  ON fornecedores (cnpj_cpf);

-- Busca textual por razao_social e nome_fantasia
CREATE INDEX IF NOT EXISTS idx_fornecedores_razao
  ON fornecedores (razao_social);

CREATE INDEX IF NOT EXISTS idx_fornecedores_status
  ON fornecedores (status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_fornecedores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER fornecedores_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION update_fornecedores_updated_at();

-- RLS
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

-- super_admin e admin: acesso total
CREATE POLICY "fornecedores_admin_all" ON fornecedores
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  );

-- coordinator: somente leitura
CREATE POLICY "fornecedores_coordinator_select" ON fornecedores
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );
