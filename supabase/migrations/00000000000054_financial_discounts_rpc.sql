-- Migration 54: Atualizar RPC generate_installments para aplicar descontos/bolsas
-- Adiciona funcao auxiliar calculate_applicable_discounts

CREATE OR REPLACE FUNCTION calculate_applicable_discounts(
  p_student_id  UUID,
  p_plan_id     UUID,
  p_amount      NUMERIC,
  p_ref_date    DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_discount   NUMERIC,
  discount_ids     UUID[],
  scholarship_ids  UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student        students%ROWTYPE;
  v_total          NUMERIC(10,2) := 0;
  v_discount_ids   UUID[] := ARRAY[]::UUID[];
  v_scholarship_ids UUID[] := ARRAY[]::UUID[];
  v_rec            RECORD;
  v_apply          NUMERIC(10,2);
BEGIN
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, ARRAY[]::UUID[], ARRAY[]::UUID[];
    RETURN;
  END IF;

  -- Aplicar descontos (exclusivo ou cumulativo conforme flag)
  FOR v_rec IN
    SELECT fd.*
    FROM financial_discounts fd
    WHERE fd.is_active = TRUE
      AND (fd.valid_from IS NULL OR fd.valid_from <= p_ref_date)
      AND (fd.valid_until IS NULL OR fd.valid_until >= p_ref_date)
      AND (fd.school_year IS NULL OR fd.school_year = v_student.school_year)
      AND (
        fd.scope = 'global'
        OR (fd.scope = 'student' AND fd.student_id = p_student_id)
        OR (fd.scope = 'group' AND (
          (fd.plan_id IS NOT NULL AND fd.plan_id = p_plan_id)
          OR (fd.segment_id IS NOT NULL AND fd.segment_id = v_student.segment_id)
          OR (fd.class_id IS NOT NULL AND fd.class_id = v_student.class_id)
        ))
      )
    ORDER BY fd.is_cumulative DESC, fd.priority DESC, fd.scope DESC
  LOOP
    IF v_rec.discount_type = 'percentage' THEN
      v_apply := ROUND(p_amount * v_rec.discount_value / 100, 2);
    ELSE
      v_apply := v_rec.discount_value;
    END IF;

    IF NOT v_rec.is_cumulative AND array_length(v_discount_ids, 1) IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_total := v_total + v_apply;
    v_discount_ids := array_append(v_discount_ids, v_rec.id);
  END LOOP;

  -- Bolsas aprovadas vigentes (sempre cumulativas)
  FOR v_rec IN
    SELECT fs.*
    FROM financial_scholarships fs
    WHERE fs.student_id = p_student_id
      AND fs.status = 'approved'
      AND fs.valid_from <= p_ref_date
      AND fs.valid_until >= p_ref_date
  LOOP
    IF v_rec.scholarship_type = 'full' THEN
      v_apply := p_amount;
    ELSIF v_rec.scholarship_type = 'percentage' THEN
      v_apply := ROUND(p_amount * v_rec.scholarship_value / 100, 2);
    ELSE
      v_apply := v_rec.scholarship_value;
    END IF;

    v_total := v_total + v_apply;
    v_scholarship_ids := array_append(v_scholarship_ids, v_rec.id);
  END LOOP;

  IF v_total > p_amount THEN
    v_total := p_amount;
  END IF;

  RETURN QUERY SELECT v_total, v_discount_ids, v_scholarship_ids;
END;
$$;

-- Atualizar generate_installments_for_contract para usar calculate_applicable_discounts
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

  -- 1) Desconto manual do contrato (legado — admin pode digitar no form)
  IF v_contract.discount_type = 'percentage' AND v_contract.discount_value > 0 THEN
    v_amount := v_amount * (1 - v_contract.discount_value / 100);
  ELSIF v_contract.discount_type = 'fixed' AND v_contract.discount_value > 0 THEN
    v_amount := v_amount - v_contract.discount_value;
  END IF;

  -- 2) Descontos/bolsas automaticos
  SELECT * INTO v_disc_rec
  FROM calculate_applicable_discounts(
    v_contract.student_id,
    v_contract.plan_id,
    v_amount,
    CURRENT_DATE
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
      ROUND(v_amount * (1 - v_plan.punctuality_discount_pct / 100), 2),
      CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
    )
    ON CONFLICT (contract_id, installment_number) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
