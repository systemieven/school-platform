-- Migration 70: Contas a Pagar (financial_payables)
-- Despesas fixas e variáveis com parcelamento, recorrência e baixa com comprovante.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Tabela
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_payables (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  creditor_name         TEXT          NOT NULL,
  creditor_type         TEXT          NOT NULL DEFAULT 'supplier'
                                      CHECK (creditor_type IN ('supplier', 'employee', 'other')),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  account_category_id   UUID          REFERENCES financial_account_categories(id) ON DELETE SET NULL,
  category_type         TEXT          NOT NULL
                                      CHECK (category_type IN ('fixed', 'variable')),
  description           TEXT          NOT NULL,
  due_date              DATE          NOT NULL,
  payment_method        TEXT,         -- cash, pix, credit_card, debit_card, transfer, boleto, other
  status                TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  amount_paid           NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at               TIMESTAMPTZ,
  receipt_url           TEXT,
  receipt_path          TEXT,

  -- Parcelamento: mesmo padrão de financial_receivables
  parent_id             UUID          REFERENCES financial_payables(id) ON DELETE CASCADE,
  installment_number    INTEGER,
  total_installments    INTEGER,

  -- Recorrência
  is_recurring          BOOLEAN       NOT NULL DEFAULT FALSE,
  recurrence_interval   TEXT          CHECK (recurrence_interval IN ('monthly', 'quarterly', 'yearly')),
  recurrence_end_date   DATE,

  -- Alertas de vencimento
  alert_days_before     INTEGER       NOT NULL DEFAULT 3,

  notes                 TEXT,
  created_by            UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_financial_payables_status_due
  ON financial_payables(status, due_date);

CREATE INDEX IF NOT EXISTS idx_financial_payables_category_type
  ON financial_payables(category_type);

CREATE INDEX IF NOT EXISTS idx_financial_payables_parent
  ON financial_payables(parent_id) WHERE parent_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. RLS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE financial_payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_payables"
  ON financial_payables FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view financial_payables"
  ON financial_payables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. RPC: gerar parcelas de A/P
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_payable_installments(p_payable_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pay       financial_payables%ROWTYPE;
  v_amount    NUMERIC(12,2);
  v_due       DATE;
  v_i         INTEGER;
  v_count     INTEGER := 0;
BEGIN
  SELECT * INTO v_pay FROM financial_payables WHERE id = p_payable_id AND parent_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payable não encontrado ou já é parcela: %', p_payable_id;
  END IF;

  IF v_pay.total_installments IS NULL OR v_pay.total_installments <= 1 THEN
    RETURN 0;
  END IF;

  DELETE FROM financial_payables WHERE parent_id = p_payable_id;

  v_amount := ROUND(v_pay.amount / v_pay.total_installments, 2);

  FOR v_i IN 1..v_pay.total_installments LOOP
    v_due := v_pay.due_date + ((v_i - 1) || ' months')::INTERVAL;
    INSERT INTO financial_payables (
      creditor_name, creditor_type,
      amount, account_category_id, category_type,
      description, due_date, payment_method, status,
      parent_id, installment_number, total_installments,
      alert_days_before, created_by
    ) VALUES (
      v_pay.creditor_name, v_pay.creditor_type,
      v_amount, v_pay.account_category_id, v_pay.category_type,
      v_pay.description || ' (' || v_i || '/' || v_pay.total_installments || ')',
      v_due, v_pay.payment_method,
      CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
      p_payable_id, v_i, v_pay.total_installments,
      v_pay.alert_days_before, v_pay.created_by
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
