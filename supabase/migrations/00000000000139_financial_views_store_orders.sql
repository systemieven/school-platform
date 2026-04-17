-- Migration 139: Inclui store_orders como fonte de receita nas views financeiras
-- financial_cash_flow_view e financial_dre_view não contabilizavam pedidos da loja.
--
-- Estratégia:
--   - financial_cash_flow_view: acrescenta UNION ALL com store_orders confirmados/concluídos,
--     com cláusula NOT EXISTS para evitar dupla contagem quando webhook cria
--     financial_receivables com source_type='store_order'.
--   - financial_dre_view: receivables com account_category_id já são capturados pela query
--     existente. Pedidos sem receivable correspondente entram via UNION ALL inline com
--     categoria virtual 'Loja / Pedidos', guarded pela mesma NOT EXISTS.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. financial_cash_flow_view — recriar com store_orders
-- ══════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS financial_cash_flow_view CASCADE;

CREATE VIEW financial_cash_flow_view AS
SELECT
  entry_date,
  direction,
  amount,
  description,
  category_name,
  payment_method,
  source
FROM (
  -- A/R pago
  SELECT
    fr.paid_at::DATE                        AS entry_date,
    'entrada'                               AS direction,
    fr.amount_paid                          AS amount,
    fr.description,
    fac.name                                AS category_name,
    fr.payment_method,
    'receivable'                            AS source
  FROM financial_receivables fr
  LEFT JOIN financial_account_categories fac ON fac.id = fr.account_category_id
  WHERE fr.status IN ('paid', 'partial')
    AND fr.paid_at IS NOT NULL

  UNION ALL

  -- Mensalidades pagas
  SELECT
    fi.paid_at::DATE,
    'entrada',
    fi.paid_amount,
    'Mensalidade ' || fi.reference_month,
    'Mensalidades',
    fi.payment_method,
    'installment'
  FROM financial_installments fi
  WHERE fi.status = 'paid'
    AND fi.paid_at IS NOT NULL
    AND fi.paid_amount > 0

  UNION ALL

  -- A/P pago
  SELECT
    fp.paid_at::DATE,
    'saida',
    fp.amount_paid,
    fp.description,
    fac.name,
    fp.payment_method,
    'payable'
  FROM financial_payables fp
  LEFT JOIN financial_account_categories fac ON fac.id = fp.account_category_id
  WHERE fp.status = 'paid'
    AND fp.paid_at IS NOT NULL

  UNION ALL

  -- Movimentações de caixa (excluindo abertura/fechamento que são snapshots)
  SELECT
    fcm.movement_date::DATE,
    CASE WHEN fcm.type IN ('inflow', 'suprimento', 'opening') THEN 'entrada' ELSE 'saida' END,
    fcm.amount,
    fcm.description,
    COALESCE(fac.name, 'Sem categoria'),
    fcm.payment_method,
    'cash_movement'
  FROM financial_cash_movements fcm
  LEFT JOIN financial_account_categories fac ON fac.id = fcm.account_category_id
  WHERE fcm.type NOT IN ('opening', 'closing')  -- abertura/fechamento são snapshots, não fluxo

  UNION ALL

  -- Pedidos da loja confirmados/concluídos
  -- NOT EXISTS evita dupla contagem quando webhook já criou financial_receivables para o pedido
  SELECT
    so.created_at::DATE,
    'entrada',
    so.total_amount,
    'Pedido loja #' || so.order_number,
    'Loja / Pedidos',
    so.payment_method,
    'store_order'
  FROM store_orders so
  WHERE so.status IN ('payment_confirmed', 'picking', 'ready_for_pickup', 'picked_up', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM financial_receivables fr
      WHERE fr.source_type = 'store_order'
        AND fr.source_id = so.id
    )
) t
ORDER BY entry_date DESC;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. financial_dre_view — recriar com store_orders
-- ══════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS financial_dre_view CASCADE;

CREATE VIEW financial_dre_view AS
SELECT
  fac.type                                AS account_type,    -- 'receita' | 'despesa'
  COALESCE(fac_parent.name, fac.name)     AS parent_category,
  fac.name                                AS category,
  SUM(linha.amount)                       AS total,
  COUNT(*)                                AS entry_count,
  MIN(linha.entry_date)                   AS first_entry,
  MAX(linha.entry_date)                   AS last_entry
FROM (
  -- Receivables realizados
  SELECT
    account_category_id,
    amount_paid        AS amount,
    paid_at::DATE      AS entry_date
  FROM financial_receivables
  WHERE status IN ('paid', 'partial') AND paid_at IS NOT NULL

  UNION ALL

  -- Mensalidades realizadas
  SELECT
    (SELECT id FROM financial_account_categories WHERE name = 'Mensalidades' LIMIT 1),
    paid_amount,
    paid_at::DATE
  FROM financial_installments
  WHERE status = 'paid' AND paid_at IS NOT NULL AND paid_amount > 0

  UNION ALL

  -- Payables realizados
  SELECT
    account_category_id,
    amount_paid,
    paid_at::DATE
  FROM financial_payables
  WHERE status = 'paid' AND paid_at IS NOT NULL
) linha
JOIN financial_account_categories fac ON fac.id = linha.account_category_id
LEFT JOIN financial_account_categories fac_parent ON fac_parent.id = fac.parent_id
GROUP BY fac.type, parent_category, fac.name

UNION ALL

-- Pedidos da loja sem receivable correspondente
-- Agrupados em categoria virtual; excluídos quando webhook já criou receivable
SELECT
  'receita'                          AS account_type,
  'Loja / Pedidos'                   AS parent_category,
  'Loja / Pedidos'                   AS category,
  SUM(so.total_amount)               AS total,
  COUNT(*)                           AS entry_count,
  MIN(so.created_at::DATE)           AS first_entry,
  MAX(so.created_at::DATE)           AS last_entry
FROM store_orders so
WHERE so.status IN ('payment_confirmed', 'picking', 'ready_for_pickup', 'picked_up', 'completed')
  AND NOT EXISTS (
    SELECT 1 FROM financial_receivables fr
    WHERE fr.source_type = 'store_order'
      AND fr.source_id = so.id
  )
HAVING COUNT(*) > 0

ORDER BY account_type DESC, parent_category, category;
