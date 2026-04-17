-- Migration 137: adiciona parâmetro p_start_month em generate_installments_for_contract
-- Quando p_start_month > 0 (1-12), inicia as parcelas naquele mês.
-- Quando p_start_month = 0 (default), mantém comportamento legado (janeiro).
-- Compatibilidade retroativa preservada: chamadas sem o parâmetro continuam funcionando.

CREATE OR REPLACE FUNCTION generate_installments_for_contract(
  p_contract_id UUID,
  p_start_month INT DEFAULT 0   -- 1-12; 0 = comportamento legado (janeiro)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract    financial_contracts%ROWTYPE;
  v_plan        financial_plans%ROWTYPE;
  v_amount      NUMERIC(10,2);
  v_due         DATE;
  v_count       INTEGER := 0;
  v_i           INTEGER;
  v_month       DATE;
  v_start_month INT;
BEGIN
  SELECT * INTO v_contract FROM financial_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado: %', p_contract_id; END IF;

  SELECT * INTO v_plan FROM financial_plans WHERE id = v_contract.plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano nao encontrado: %', v_contract.plan_id; END IF;

  v_start_month := CASE
    WHEN p_start_month BETWEEN 1 AND 12 THEN p_start_month
    ELSE 1  -- legado: janeiro
  END;

  v_amount := v_plan.amount;
  IF v_contract.discount_type = 'percentage' AND v_contract.discount_value > 0 THEN
    v_amount := v_amount * (1 - v_contract.discount_value / 100);
  ELSIF v_contract.discount_type = 'fixed' AND v_contract.discount_value > 0 THEN
    v_amount := v_amount - v_contract.discount_value;
  END IF;
  IF v_amount < 0 THEN v_amount := 0; END IF;

  UPDATE financial_contracts SET net_amount = v_amount WHERE id = p_contract_id;

  v_amount := ROUND(v_amount / v_plan.installments, 2);

  FOR v_i IN 1..v_plan.installments LOOP
    v_month := make_date(v_contract.school_year, v_start_month, 1) + ((v_i - 1) || ' months')::INTERVAL;
    v_due   := make_date(
                 EXTRACT(YEAR FROM v_month)::INTEGER,
                 EXTRACT(MONTH FROM v_month)::INTEGER,
                 LEAST(v_plan.due_day, 28)
               );

    INSERT INTO financial_installments (
      contract_id, student_id, installment_number, reference_month,
      due_date, amount, amount_with_discount, status
    ) VALUES (
      p_contract_id, v_contract.student_id, v_i,
      to_char(v_month, 'YYYY-MM'),
      v_due, v_amount,
      ROUND(v_amount * (1 - v_plan.punctuality_discount_pct / 100), 2),
      CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
    )
    ON CONFLICT (contract_id, installment_number) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
