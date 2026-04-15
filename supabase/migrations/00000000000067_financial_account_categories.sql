-- Migration 67: Plano de Contas (financial_account_categories)
-- Tabela hierárquica de categorias financeiras, usada como FK em caixas, A/R e A/P.
-- Deve ser criada ANTES das tabelas que referenciam account_category_id.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Tabela
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_account_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('receita', 'despesa')),
  parent_id   UUID        REFERENCES financial_account_categories(id) ON DELETE SET NULL,
  code        TEXT,                              -- código contábil opcional (ex.: "1.1.1")
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE, -- defaults protegidos: não podem ser excluídos
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  position    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_account_categories_parent
  ON financial_account_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_financial_account_categories_type
  ON financial_account_categories(type);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. RLS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE financial_account_categories ENABLE ROW LEVEL SECURITY;

-- Admin: CRUD completo
CREATE POLICY "Admin full access financial_account_categories"
  ON financial_account_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Coordinator: somente leitura
CREATE POLICY "Coordinator view financial_account_categories"
  ON financial_account_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Categorias padrão (is_system = true — protegidas contra exclusão)
-- ══════════════════════════════════════════════════════════════════════════════

-- Receitas (raiz)
INSERT INTO financial_account_categories (name, type, parent_id, is_system, position) VALUES
  ('Receitas',             'receita', NULL, TRUE, 0),
  ('Despesas',             'despesa', NULL, TRUE, 1)
ON CONFLICT DO NOTHING;

-- Subcategorias de Receita
WITH rec AS (SELECT id FROM financial_account_categories WHERE name = 'Receitas' AND parent_id IS NULL)
INSERT INTO financial_account_categories (name, type, parent_id, is_system, position)
SELECT v.name, 'receita', rec.id, TRUE, v.pos
FROM rec,
  (VALUES
    ('Mensalidades',    0),
    ('Taxas e Eventos', 1),
    ('Matrículas',      2),
    ('Outras Receitas', 3)
  ) AS v(name, pos)
ON CONFLICT DO NOTHING;

-- Subcategorias de Despesa — Fixas
WITH desp AS (SELECT id FROM financial_account_categories WHERE name = 'Despesas' AND parent_id IS NULL)
INSERT INTO financial_account_categories (name, type, parent_id, is_system, position)
SELECT 'Despesas Fixas', 'despesa', desp.id, TRUE, 0
FROM desp
ON CONFLICT DO NOTHING;

WITH fixas AS (SELECT id FROM financial_account_categories WHERE name = 'Despesas Fixas')
INSERT INTO financial_account_categories (name, type, parent_id, is_system, position)
SELECT v.name, 'despesa', fixas.id, TRUE, v.pos
FROM fixas,
  (VALUES
    ('Aluguel',              0),
    ('Folha de Pagamento',   1),
    ('Contratos de Serviço', 2)
  ) AS v(name, pos)
ON CONFLICT DO NOTHING;

-- Subcategorias de Despesa — Variáveis
WITH desp AS (SELECT id FROM financial_account_categories WHERE name = 'Despesas' AND parent_id IS NULL)
INSERT INTO financial_account_categories (name, type, parent_id, is_system, position)
SELECT 'Despesas Variáveis', 'despesa', desp.id, TRUE, 1
FROM desp
ON CONFLICT DO NOTHING;

WITH variaveis AS (SELECT id FROM financial_account_categories WHERE name = 'Despesas Variáveis')
INSERT INTO financial_account_categories (name, type, parent_id, is_system, position)
SELECT v.name, 'despesa', variaveis.id, TRUE, v.pos
FROM variaveis,
  (VALUES
    ('Material de Consumo',  0),
    ('Eventos e Passeios',   1),
    ('Manutenção',           2)
  ) AS v(name, pos)
ON CONFLICT DO NOTHING;
