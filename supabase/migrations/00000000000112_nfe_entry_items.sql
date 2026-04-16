-- Migration 112: nfe_entry_items — Fase 16: Estrutura Fiscal
-- Importação de NF-e de entrada: cabeçalho (nfe_entries) e itens com dados fiscais do XML (nfe_entry_items).
-- Permite vincular itens da NF-e a produtos do catálogo da loja para atualização automática de dados fiscais.

CREATE TABLE IF NOT EXISTS nfe_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xml_file_name  TEXT,
  emitente_cnpj  TEXT,
  emitente_nome  TEXT,
  chave_acesso   TEXT UNIQUE,
  data_emissao   TIMESTAMPTZ,
  valor_total    NUMERIC(12,2),
  status         TEXT NOT NULL DEFAULT 'imported'
                   CHECK (status IN ('imported','processed','error')),
  raw_xml        TEXT,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfe_entries_chave   ON nfe_entries(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_nfe_entries_status  ON nfe_entries(status);
CREATE INDEX IF NOT EXISTS idx_nfe_entries_created ON nfe_entries(created_at DESC);

CREATE TABLE IF NOT EXISTS nfe_entry_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_entry_id     UUID NOT NULL REFERENCES nfe_entries(id) ON DELETE CASCADE,
  store_product_id UUID REFERENCES store_products(id) ON DELETE SET NULL,
  -- Dados do item
  descricao        TEXT,
  quantidade       NUMERIC(10,4),
  valor_unitario   NUMERIC(12,4),
  valor_total      NUMERIC(12,2),
  -- Campos fiscais extraídos do XML
  ncm              TEXT,
  cfop             TEXT,
  ean              TEXT,
  unidade_trib     TEXT,
  origem           SMALLINT,
  cst_icms         TEXT,
  csosn            TEXT,
  aliq_icms        NUMERIC(5,2),
  cst_pis          TEXT,
  aliq_pis         NUMERIC(5,4),
  cst_cofins       TEXT,
  aliq_cofins      NUMERIC(5,4),
  cst_ipi          TEXT,
  aliq_ipi         NUMERIC(5,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nei_entry   ON nfe_entry_items(nfe_entry_id);
CREATE INDEX IF NOT EXISTS idx_nei_product ON nfe_entry_items(store_product_id);

-- RLS — nfe_entries
ALTER TABLE nfe_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_entries_admin_all" ON nfe_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  );

CREATE POLICY "nfe_entries_coordinator_select_create" ON nfe_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );

CREATE POLICY "nfe_entries_coordinator_insert" ON nfe_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );

-- RLS — nfe_entry_items
ALTER TABLE nfe_entry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_entry_items_admin_all" ON nfe_entry_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  );

CREATE POLICY "nfe_entry_items_coordinator_select" ON nfe_entry_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );

CREATE POLICY "nfe_entry_items_coordinator_insert" ON nfe_entry_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );
