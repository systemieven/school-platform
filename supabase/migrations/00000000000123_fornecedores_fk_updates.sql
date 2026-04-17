-- Migration 123: fornecedores_fk_updates — Fase 14.E: Módulo de Fornecedores
-- Vincula fornecedor_id em financial_payables e nfe_entries.
-- Reescreve RPC generate_payable_installments para propagar fornecedor_id.

-- ── 1. financial_payables ────────────────────────────────────────────────────

ALTER TABLE financial_payables
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payables_fornecedor
  ON financial_payables (fornecedor_id)
  WHERE fornecedor_id IS NOT NULL;

-- ── 2. nfe_entries ───────────────────────────────────────────────────────────

ALTER TABLE nfe_entries
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nfe_entries_fornecedor
  ON nfe_entries (fornecedor_id)
  WHERE fornecedor_id IS NOT NULL;

-- ── 3. Reescrita da RPC generate_payable_installments ───────────────────────
-- Propaga fornecedor_id nas parcelas filhas (ADD ao INSERT existente).

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
      creditor_name, creditor_type, fornecedor_id,
      amount, account_category_id, category_type,
      description, due_date, payment_method, status,
      parent_id, installment_number, total_installments,
      alert_days_before, created_by
    ) VALUES (
      v_pay.creditor_name, v_pay.creditor_type, v_pay.fornecedor_id,
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

-- ── 4. Vinculação retroativa por CNPJ ────────────────────────────────────────
-- Associa nfe_entries existentes ao fornecedor cujo cnpj_cpf bate com emitente_cnpj.
-- Idempotente: só atualiza WHERE fornecedor_id IS NULL.

UPDATE nfe_entries ne
   SET fornecedor_id = f.id
  FROM fornecedores f
 WHERE ne.fornecedor_id IS NULL
   AND ne.emitente_cnpj IS NOT NULL
   AND ne.emitente_cnpj = f.cnpj_cpf;
