-- Migration 73: Views SQL para relatórios financeiros gerenciais
-- Views: financial_cash_flow_view, financial_dre_view, financial_delinquency_view
-- Todas as views consolidam dados de financial_receivables + financial_payables +
-- financial_cash_movements + financial_installments (mensalidades).

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Fluxo de Caixa — entradas e saídas por data
-- ══════════════════════════════════════════════════════════════════════════════
-- Consolida:
--   ENTRADAS: receivables pagas + installments pagos + cash_movements (inflow/opening/suprimento)
--   SAÍDAS:   payables pagas + cash_movements (outflow/closing/sangria)

CREATE OR REPLACE VIEW financial_cash_flow_view AS
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

  -- Movimentações de caixa (excluindo tipos de abertura/fechamento que são snapshots)
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
) t
ORDER BY entry_date DESC;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. DRE Simplificado — receitas e despesas por categoria
-- ══════════════════════════════════════════════════════════════════════════════
-- Agrupa todos os lançamentos realizados por categoria do plano de contas.
-- Permite filtrar por período no frontend via RPC ou query com WHERE.

CREATE OR REPLACE VIEW financial_dre_view AS
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
ORDER BY fac.type DESC, parent_category, fac.name;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Inadimplência — receivables + installments vencidos em aberto
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW financial_delinquency_view AS
SELECT
  id,
  payer_name,
  'receivable'::TEXT   AS source,
  amount - amount_paid AS amount_open,
  due_date,
  (CURRENT_DATE - due_date) AS days_overdue,
  description,
  NULL::UUID           AS student_id,
  payment_method
FROM financial_receivables
WHERE status IN ('overdue', 'partial')
  AND due_date < CURRENT_DATE

UNION ALL

SELECT
  fi.id,
  s.full_name,
  'installment'::TEXT,
  fi.total_due - COALESCE(fi.paid_amount, 0),
  fi.due_date,
  (CURRENT_DATE - fi.due_date),
  'Mensalidade ' || fi.reference_month,
  fi.student_id,
  fi.payment_method
FROM financial_installments fi
JOIN students s ON s.id = fi.student_id
WHERE fi.status = 'overdue'
  AND fi.due_date < CURRENT_DATE

ORDER BY days_overdue DESC;
