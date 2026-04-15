-- Migration 69: Contas a Receber (A/R geral, separado de financial_installments)
-- financial_installments cobre mensalidades via contratos (gateway-integrado).
-- financial_receivables cobre qualquer outro recebível: taxas, eventos, manual, etc.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Tabela
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_receivables (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_name            TEXT          NOT NULL,
  payer_type            TEXT          NOT NULL DEFAULT 'external'
                                      CHECK (payer_type IN ('student', 'responsible', 'external')),
  student_id            UUID          REFERENCES students(id) ON DELETE SET NULL,
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  account_category_id   UUID          REFERENCES financial_account_categories(id) ON DELETE SET NULL,
  description           TEXT          NOT NULL,
  due_date              DATE          NOT NULL,
  payment_method        TEXT,         -- cash, pix, credit_card, debit_card, transfer, boleto, other
  status                TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),
  amount_paid           NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at               TIMESTAMPTZ,
  late_fee_pct          NUMERIC(5,2)  NOT NULL DEFAULT 0, -- % multa por atraso
  interest_rate_pct     NUMERIC(5,4)  NOT NULL DEFAULT 0, -- % juros ao dia

  -- Parcelamento: registros filhos apontam para o pai via parent_id
  parent_id             UUID          REFERENCES financial_receivables(id) ON DELETE CASCADE,
  installment_number    INTEGER,
  total_installments    INTEGER,

  -- Recorrência
  is_recurring          BOOLEAN       NOT NULL DEFAULT FALSE,
  recurrence_interval   TEXT          CHECK (recurrence_interval IN ('monthly', 'quarterly', 'yearly')),
  recurrence_end_date   DATE,

  -- Rastreabilidade de integração
  source_type           TEXT          NOT NULL DEFAULT 'manual'
                                      CHECK (source_type IN ('manual', 'event', 'enrollment', 'cash_movement')),
  source_id             UUID,         -- ID do evento, matrícula ou movimento de origem

  notes                 TEXT,
  created_by            UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_financial_receivables_status_due
  ON financial_receivables(status, due_date);

CREATE INDEX IF NOT EXISTS idx_financial_receivables_student
  ON financial_receivables(student_id) WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_receivables_parent
  ON financial_receivables(parent_id) WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_receivables_source
  ON financial_receivables(source_type, source_id) WHERE source_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. RLS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE financial_receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_receivables"
  ON financial_receivables FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view financial_receivables"
  ON financial_receivables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. RPC: gerar parcelas de A/R
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_receivable_installments(p_receivable_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec       financial_receivables%ROWTYPE;
  v_amount    NUMERIC(12,2);
  v_due       DATE;
  v_i         INTEGER;
  v_count     INTEGER := 0;
BEGIN
  SELECT * INTO v_rec FROM financial_receivables WHERE id = p_receivable_id AND parent_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receivable não encontrado ou já é parcela: %', p_receivable_id;
  END IF;

  IF v_rec.total_installments IS NULL OR v_rec.total_installments <= 1 THEN
    RETURN 0; -- nada a gerar
  END IF;

  -- Deletar parcelas existentes antes de regerar
  DELETE FROM financial_receivables WHERE parent_id = p_receivable_id;

  v_amount := ROUND(v_rec.amount / v_rec.total_installments, 2);

  FOR v_i IN 1..v_rec.total_installments LOOP
    v_due := v_rec.due_date + ((v_i - 1) || ' months')::INTERVAL;
    INSERT INTO financial_receivables (
      payer_name, payer_type, student_id,
      amount, account_category_id, description, due_date,
      payment_method, status, late_fee_pct, interest_rate_pct,
      parent_id, installment_number, total_installments,
      source_type, source_id, created_by
    ) VALUES (
      v_rec.payer_name, v_rec.payer_type, v_rec.student_id,
      v_amount, v_rec.account_category_id,
      v_rec.description || ' (' || v_i || '/' || v_rec.total_installments || ')',
      v_due,
      v_rec.payment_method,
      CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
      v_rec.late_fee_pct, v_rec.interest_rate_pct,
      p_receivable_id, v_i, v_rec.total_installments,
      v_rec.source_type, v_rec.source_id, v_rec.created_by
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
