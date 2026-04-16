-- Migration 110: product_fiscal_data — Fase 16: Estrutura Fiscal
-- Dados fiscais por produto (1:1 com store_products).
-- FK nullable para fiscal_profiles (109) — esse migration deve rodar após o 109.

CREATE TABLE IF NOT EXISTS product_fiscal_data (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_product_id UUID NOT NULL UNIQUE REFERENCES store_products(id) ON DELETE CASCADE,
  fiscal_profile_id UUID REFERENCES fiscal_profiles(id) ON DELETE SET NULL,
  -- Classificação
  ncm              TEXT,
  cest             TEXT,
  cfop_saida       TEXT,
  origem           SMALLINT DEFAULT 0,
  unidade_trib     TEXT DEFAULT 'UN',
  ean              TEXT,
  -- ICMS
  cst_icms         TEXT,
  csosn            TEXT,
  mod_bc_icms      SMALLINT DEFAULT 3,
  aliq_icms        NUMERIC(5,2),
  red_bc_icms      NUMERIC(5,2),
  mva              NUMERIC(5,2),
  -- PIS
  cst_pis          TEXT,
  aliq_pis         NUMERIC(5,4),
  -- COFINS
  cst_cofins       TEXT,
  aliq_cofins      NUMERIC(5,4),
  -- IPI
  cst_ipi          TEXT,
  ex_tipi          TEXT,
  aliq_ipi         NUMERIC(5,2),
  -- Emissão
  gera_nfe         BOOLEAN NOT NULL DEFAULT false,
  obs_fiscal       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pfd_product ON product_fiscal_data(store_product_id);
CREATE INDEX IF NOT EXISTS idx_pfd_profile ON product_fiscal_data(fiscal_profile_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_product_fiscal_data_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER product_fiscal_data_updated_at
  BEFORE UPDATE ON product_fiscal_data
  FOR EACH ROW EXECUTE FUNCTION update_product_fiscal_data_updated_at();

-- RLS
ALTER TABLE product_fiscal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_fiscal_data_admin_all" ON product_fiscal_data
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  );

CREATE POLICY "product_fiscal_data_coordinator_all" ON product_fiscal_data
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );
