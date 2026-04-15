-- ============================================================
-- PR3 — Financeiro por série
-- ============================================================
-- 1. financial_plans.series_ids (uuid[])      — plano vinculado a séries
-- 2. financial_discounts.series_id (uuid)     — desconto com escopo de série
-- 3. Reescrita do RPC calculate_applicable_discounts:
--    - Deriva segment_id e series_id via JOIN school_classes (corrige bug
--      antigo onde v_student.segment_id era referenciado mas a coluna não
--      existe em students)
--    - Adiciona prioridade por série na cadeia de matching
--    - Drop do overload de 4 args (legado da migration 54) para evitar
--      ambiguidade
-- ============================================================

-- ── 1. financial_plans.series_ids ────────────────────────────
ALTER TABLE financial_plans
  ADD COLUMN IF NOT EXISTS series_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN financial_plans.series_ids IS
  'PR3: séries (school_series.id) vinculadas ao plano. Pelo menos um de ' ||
  'segment_ids ou series_ids deve estar preenchido. series_ids tem ' ||
  'prioridade sobre segment_ids para casamento contrato↔plano.';

-- ── 2. financial_discounts.series_id ─────────────────────────
ALTER TABLE financial_discounts
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES school_series(id) ON DELETE CASCADE;

COMMENT ON COLUMN financial_discounts.series_id IS
  'PR3: quando preenchido (com scope=group), aplica o desconto a todos os ' ||
  'alunos cuja school_classes.series_id bate. Mais específico que segment_id, ' ||
  'menos específico que class_id.';

CREATE INDEX IF NOT EXISTS idx_financial_discounts_series
  ON financial_discounts (series_id) WHERE series_id IS NOT NULL;

-- ── 3. Drop do overload legado (4 args) ──────────────────────
DROP FUNCTION IF EXISTS calculate_applicable_discounts(uuid, uuid, numeric, date);

-- ── 4. RPC reescrita ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_applicable_discounts(
  p_student_id    uuid,
  p_plan_id       uuid,
  p_amount        numeric,
  p_ref_date      date DEFAULT CURRENT_DATE,
  p_payment_date  date DEFAULT NULL,
  p_due_date      date DEFAULT NULL
)
RETURNS TABLE(
  total_discount   numeric,
  discount_ids     uuid[],
  scholarship_ids  uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student         students%ROWTYPE;
  v_segment_id      uuid;
  v_series_id       uuid;
  v_school_year     int;
  v_total           numeric(10,2) := 0;
  v_discount_ids    uuid[] := ARRAY[]::uuid[];
  v_scholarship_ids uuid[] := ARRAY[]::uuid[];
  v_rec             RECORD;
  v_apply           numeric(10,2);
  v_has_progressive boolean;
  v_days_before     int;
  v_best_pct        numeric(10,2);
  v_rule            jsonb;
  v_rule_days       int;
  v_rule_pct        numeric(10,2);
BEGIN
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, ARRAY[]::uuid[], ARRAY[]::uuid[];
    RETURN;
  END IF;

  -- Deriva série/segmento via JOIN com a turma. students NÃO tem segment_id;
  -- a hierarquia 3-níveis é: students.class_id → school_classes →
  -- (segment_id, series_id, school_year).
  SELECT sc.segment_id, sc.series_id, sc.school_year
    INTO v_segment_id, v_series_id, v_school_year
  FROM school_classes sc
  WHERE sc.id = v_student.class_id;

  -- Fallback: students.school_year sobrescreve o da turma se a turma for null
  v_school_year := COALESCE(v_school_year, v_student.school_year);

  -- ── Descontos ──
  -- Cadeia de prioridade (mais específico → mais genérico):
  --   student_id → class_id → series_id → segment_id → plan_id → global
  -- A flag is_cumulative + ordenação determinam se múltiplos descontos somam.
  FOR v_rec IN
    SELECT fd.*
    FROM financial_discounts fd
    WHERE fd.is_active = TRUE
      AND (fd.valid_from  IS NULL OR fd.valid_from  <= p_ref_date)
      AND (fd.valid_until IS NULL OR fd.valid_until >= p_ref_date)
      AND (fd.school_year IS NULL OR fd.school_year = v_school_year)
      AND (
        fd.scope = 'global'
        OR (fd.scope = 'student' AND fd.student_id = p_student_id)
        OR (fd.scope = 'group' AND (
          (fd.student_id IS NOT NULL AND fd.student_id = p_student_id)
          OR (fd.class_id   IS NOT NULL AND fd.class_id   = v_student.class_id)
          OR (fd.series_id  IS NOT NULL AND fd.series_id  = v_series_id)
          OR (fd.segment_id IS NOT NULL AND fd.segment_id = v_segment_id)
          OR (fd.plan_id    IS NOT NULL AND fd.plan_id    = p_plan_id)
        ))
      )
    ORDER BY
      fd.is_cumulative DESC,
      fd.priority      DESC,
      -- Especificidade: student > class > series > segment > plan > global
      CASE
        WHEN fd.student_id IS NOT NULL THEN 6
        WHEN fd.class_id   IS NOT NULL THEN 5
        WHEN fd.series_id  IS NOT NULL THEN 4
        WHEN fd.segment_id IS NOT NULL THEN 3
        WHEN fd.plan_id    IS NOT NULL THEN 2
        ELSE 1
      END DESC
  LOOP
    v_has_progressive := (jsonb_array_length(COALESCE(v_rec.progressive_rules, '[]'::jsonb)) > 0);

    IF v_has_progressive THEN
      -- Desconto progressivo: só aplica se houver payment_date + due_date
      IF p_payment_date IS NULL OR p_due_date IS NULL THEN
        CONTINUE;
      END IF;

      v_days_before := p_due_date - p_payment_date;
      IF v_days_before < 0 THEN
        CONTINUE;
      END IF;

      v_best_pct := NULL;
      FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rec.progressive_rules)
      LOOP
        v_rule_days := (v_rule->>'days_before_due')::int;
        v_rule_pct  := (v_rule->>'percentage')::numeric;
        IF v_days_before >= v_rule_days THEN
          IF v_best_pct IS NULL OR v_rule_pct > v_best_pct THEN
            v_best_pct := v_rule_pct;
          END IF;
        END IF;
      END LOOP;

      IF v_best_pct IS NULL OR v_best_pct = 0 THEN
        CONTINUE;
      END IF;

      v_apply := ROUND(p_amount * v_best_pct / 100, 2);
    ELSE
      IF v_rec.discount_type = 'percentage' THEN
        v_apply := ROUND(p_amount * v_rec.discount_value / 100, 2);
      ELSE
        v_apply := v_rec.discount_value;
      END IF;
    END IF;

    -- Não-cumulativo: pega o primeiro (já vem ordenado por prioridade)
    IF NOT v_rec.is_cumulative AND array_length(v_discount_ids, 1) IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_total := v_total + v_apply;
    v_discount_ids := array_append(v_discount_ids, v_rec.id);
  END LOOP;

  -- ── Bolsas (sempre cumulativas) ──
  FOR v_rec IN
    SELECT fs.*
    FROM financial_scholarships fs
    WHERE fs.student_id = p_student_id
      AND fs.status = 'approved'
      AND fs.valid_from  <= p_ref_date
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

COMMENT ON FUNCTION calculate_applicable_discounts(uuid, uuid, numeric, date, date, date) IS
  'PR3: calcula descontos+bolsas aplicáveis a um aluno, derivando ' ||
  'series_id e segment_id via school_classes (students.class_id). ' ||
  'Cadeia de especificidade: student → class → series → segment → plan → global.';
