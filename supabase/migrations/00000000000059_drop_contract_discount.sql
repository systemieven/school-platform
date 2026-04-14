-- Migration 59: Remover desconto legado de financial_contracts
-- Motivo: O modulo financial_discounts (scope=student/group/global) substitui
-- completamente o desconto manual por contrato, com mais recursos (validade,
-- prioridade, cumulativo, regras progressivas). Mantendo unica fonte de verdade.

-- ============================================================================
-- 1) DROP colunas discount_type / discount_value
-- ============================================================================
ALTER TABLE financial_contracts
  DROP COLUMN IF EXISTS discount_type,
  DROP COLUMN IF EXISTS discount_value;

-- ============================================================================
-- 2) Simplificar generate_installments_for_contract
--    (removido bloco legado que aplicava desconto do contrato)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_installments_for_contract(p_contract_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract      financial_contracts%ROWTYPE;
  v_plan          financial_plans%ROWTYPE;
  v_amount        NUMERIC(10,2);
  v_auto_discount NUMERIC(10,2) := 0;
  v_due           DATE;
  v_count         INTEGER := 0;
  v_i             INTEGER;
  v_month         DATE;
  v_disc_rec      RECORD;
BEGIN
  SELECT * INTO v_contract FROM financial_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado: %', p_contract_id; END IF;

  SELECT * INTO v_plan FROM financial_plans WHERE id = v_contract.plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano nao encontrado: %', v_contract.plan_id; END IF;

  v_amount := v_plan.amount;

  -- Descontos/bolsas automaticos (unico ponto de aplicacao de desconto)
  -- Regras progressivas sao ignoradas aqui (payment_date NULL) e aplicadas no pagamento
  SELECT * INTO v_disc_rec
  FROM calculate_applicable_discounts(
    v_contract.student_id,
    v_contract.plan_id,
    v_amount,
    CURRENT_DATE,
    NULL,
    NULL
  );

  IF v_disc_rec.total_discount IS NOT NULL AND v_disc_rec.total_discount > 0 THEN
    v_auto_discount := v_disc_rec.total_discount;
    v_amount := v_amount - v_auto_discount;
  END IF;

  IF v_amount < 0 THEN v_amount := 0; END IF;

  UPDATE financial_contracts SET net_amount = v_amount WHERE id = p_contract_id;

  v_amount := ROUND(v_amount / v_plan.installments, 2);

  FOR v_i IN 1..v_plan.installments LOOP
    v_month := make_date(v_contract.school_year, 1, 1) + ((v_i - 1) || ' months')::INTERVAL;
    v_due   := make_date(EXTRACT(YEAR FROM v_month)::INTEGER, EXTRACT(MONTH FROM v_month)::INTEGER, LEAST(v_plan.due_day, 28));

    INSERT INTO financial_installments (
      contract_id, student_id, installment_number, reference_month,
      due_date, amount, amount_with_discount, status
    ) VALUES (
      p_contract_id, v_contract.student_id, v_i,
      to_char(v_month, 'YYYY-MM'),
      v_due, v_amount,
      NULL,  -- progressive rules sao aplicadas no momento do pagamento
      CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
    )
    ON CONFLICT (contract_id, installment_number) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
