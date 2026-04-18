-- Migration 210: NF-e/NFS-e avulsas — view de saldo de estoque fiscal + expansão
-- de tipo_operacao / source para suportar emissão avulsa.
--
-- Contexto:
--  * Hoje `nfe_emitidas.tipo_operacao` só aceita 'devolucao'. Precisamos abrir
--    para 'saida_venda' | 'saida_doacao' | 'saida_remessa' (finNFe=1).
--  * `nfse_emitidas` não tem coluna `source` — a origem é derivada da
--    nullability de installment_id/receivable_id. Adicionamos coluna explícita
--    para suportar 'avulsa' (sem vínculo).
--  * Regra "só sai o que entrou" exige saldo por produto. Criamos view
--    `v_product_stock_nfe` que consolida entradas (nfe_entry_items) vs saídas
--    (itens JSONB de nfe_emitidas com tipo_operacao LIKE 'saida_%').
--  * RLS/policies herdadas — a view filtra via store_products (que já tem RLS).

-- ── 1. Amplia tipo_operacao em nfe_emitidas ───────────────────────────────────

ALTER TABLE nfe_emitidas
  DROP CONSTRAINT IF EXISTS nfe_emitidas_tipo_operacao_check;
ALTER TABLE nfe_emitidas
  ADD  CONSTRAINT nfe_emitidas_tipo_operacao_check
  CHECK (tipo_operacao IN ('devolucao','saida_venda','saida_doacao','saida_remessa'));

-- Campos úteis para avulsa — natureza da operação e informações adicionais
ALTER TABLE nfe_emitidas
  ADD COLUMN IF NOT EXISTS natureza_operacao TEXT;
ALTER TABLE nfe_emitidas
  ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT;

-- ── 2. Adiciona source em nfse_emitidas ───────────────────────────────────────

ALTER TABLE nfse_emitidas
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'installment';

-- Backfill: qualquer linha existente sem source coerente é classificada
UPDATE nfse_emitidas
  SET source = CASE
    WHEN installment_id IS NOT NULL THEN 'installment'
    WHEN receivable_id  IS NOT NULL THEN 'receivable'
    ELSE 'avulsa'
  END
  WHERE source IS NULL OR source = '';

ALTER TABLE nfse_emitidas
  DROP CONSTRAINT IF EXISTS nfse_emitidas_source_check;
ALTER TABLE nfse_emitidas
  ADD  CONSTRAINT nfse_emitidas_source_check
  CHECK (source IN ('installment','receivable','avulsa'));

ALTER TABLE nfse_emitidas
  ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT;

-- ── 3. View de saldo por produto (entradas − saídas) ──────────────────────────
--
-- `nfe_entry_items.store_product_id` pode ser NULL quando a importação do XML
-- não conseguiu vincular ao catálogo. Esses itens ficam de fora do saldo (não
-- podem ser emitidos em saída avulsa pelo catálogo, como esperado).
--
-- Saídas contabilizadas: apenas `tipo_operacao LIKE 'saida_%'` e
-- status IN ('autorizada','pendente') — rejeitadas/canceladas não descontam.

CREATE OR REPLACE VIEW v_product_stock_nfe AS
WITH entradas AS (
  SELECT store_product_id,
         SUM(quantidade)::numeric(14,4) AS qty_in
    FROM nfe_entry_items
   WHERE store_product_id IS NOT NULL
   GROUP BY store_product_id
),
saidas AS (
  SELECT (item->>'store_product_id')::uuid AS store_product_id,
         SUM((item->>'quantidade')::numeric)::numeric(14,4) AS qty_out
    FROM nfe_emitidas e,
         LATERAL jsonb_array_elements(COALESCE(e.itens, '[]'::jsonb)) AS item
   WHERE e.tipo_operacao LIKE 'saida_%'
     AND e.status IN ('autorizada','pendente')
     AND (item->>'store_product_id') IS NOT NULL
   GROUP BY 1
)
SELECT p.id          AS store_product_id,
       p.name,
       p.sku_base,
       p.sale_price,
       COALESCE(e.qty_in, 0)  AS qty_in,
       COALESCE(s.qty_out, 0) AS qty_out,
       COALESCE(e.qty_in, 0) - COALESCE(s.qty_out, 0) AS qty_available
  FROM store_products p
  LEFT JOIN entradas e ON e.store_product_id = p.id
  LEFT JOIN saidas   s ON s.store_product_id = p.id;

GRANT SELECT ON v_product_stock_nfe TO authenticated;

-- ── 4. Módulo `nfe-emitidas` (novo) + permissões ─────────────────────────────

INSERT INTO modules (key, label, description, icon, "group") VALUES
  ('nfe-emitidas', 'NF-e Saída', 'Visualizacao e emissao de NF-e de saida (modelo 55)', 'FileSignature', 'fiscal')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('super_admin','nfe-emitidas',  true, true, true,  true),
  ('admin',      'nfe-emitidas',  true, true, true,  false),
  ('coordinator','nfe-emitidas',  true, true, false, false),
  ('super_admin','nfse-emitidas', true, true, true,  true),
  ('admin',      'nfse-emitidas', true, true, true,  false),
  ('coordinator','nfse-emitidas', true, true, false, false)
ON CONFLICT (role, module_key) DO UPDATE SET
  can_view   = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create;

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'fiscal',
  'Aplicada migration 210 (NF-e/NFS-e avulsas + v_product_stock_nfe)'
);
