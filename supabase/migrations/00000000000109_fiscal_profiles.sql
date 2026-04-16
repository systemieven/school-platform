-- Migration 109: fiscal_profiles — Fase 16: Estrutura Fiscal
-- Perfis fiscais reutilizáveis (templates de configuração tributária).
-- Sem dependências de FK externas — deve rodar antes de product_fiscal_data (110).

CREATE TABLE IF NOT EXISTS fiscal_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  -- Classificação
  ncm           TEXT,
  cest          TEXT,
  cfop_saida    TEXT,
  origem        SMALLINT DEFAULT 0,
  unidade_trib  TEXT DEFAULT 'UN',
  -- ICMS
  cst_icms      TEXT,
  csosn         TEXT,
  mod_bc_icms   SMALLINT DEFAULT 3,
  aliq_icms     NUMERIC(5,2),
  red_bc_icms   NUMERIC(5,2),
  mva           NUMERIC(5,2),
  -- PIS
  cst_pis       TEXT,
  aliq_pis      NUMERIC(5,4),
  -- COFINS
  cst_cofins    TEXT,
  aliq_cofins   NUMERIC(5,4),
  -- IPI
  cst_ipi       TEXT,
  ex_tipi       TEXT,
  aliq_ipi      NUMERIC(5,2),
  -- Emissão
  gera_nfe      BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_fiscal_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER fiscal_profiles_updated_at
  BEFORE UPDATE ON fiscal_profiles
  FOR EACH ROW EXECUTE FUNCTION update_fiscal_profiles_updated_at();

-- RLS
ALTER TABLE fiscal_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_profiles_admin_all" ON fiscal_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  );

CREATE POLICY "fiscal_profiles_coordinator_select" ON fiscal_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );
