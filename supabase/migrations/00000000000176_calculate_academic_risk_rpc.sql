-- 176: RPC calculate_academic_risk (Sprint 13.IA.v2 PR2)
-- Agrega sinais de risco acadêmico por aluno: frequência últimos 30 dias,
-- notas mais baixas no bimestre corrente, justificativas recentes.
-- Usado por agente `academic_pulse` e também disponível para invocação manual.

CREATE OR REPLACE FUNCTION calculate_academic_risk(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student        RECORD;
  v_attendance_pct NUMERIC;
  v_absences       INT;
  v_total_lessons  INT;
  v_low_grades     JSONB;
  v_risk_level     TEXT;
  v_signals        INT := 0;
BEGIN
  SELECT id, full_name, class_id, status
    INTO v_student
    FROM students
   WHERE id = p_student_id;

  IF v_student.id IS NULL OR v_student.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'student_not_found_or_inactive');
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'absent'),
    COUNT(*)
  INTO v_absences, v_total_lessons
  FROM diary_attendance da
  JOIN class_diary_entries cde ON cde.id = da.diary_entry_id
  WHERE da.student_id = p_student_id
    AND cde.created_at >= now() - interval '30 days';

  v_attendance_pct := CASE
    WHEN v_total_lessons = 0 THEN 100
    ELSE 100.0 * (v_total_lessons - v_absences) / v_total_lessons
  END;

  IF v_attendance_pct < 75 THEN v_signals := v_signals + 1; END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'discipline_id', discipline_id,
    'period1', period1_avg,
    'period2', period2_avg,
    'period3', period3_avg,
    'period4', period4_avg,
    'final_avg', final_avg,
    'result', result
  ))
  INTO v_low_grades
  FROM student_results
  WHERE student_id = p_student_id
    AND school_year = EXTRACT(YEAR FROM now())::INT
    AND (
      COALESCE(final_avg, period1_avg, period2_avg, period3_avg, period4_avg) < 6.0
      OR result IN ('recovery', 'failed_grade', 'failed_attendance')
    );

  IF v_low_grades IS NOT NULL AND jsonb_array_length(v_low_grades) > 0 THEN
    v_signals := v_signals + jsonb_array_length(v_low_grades);
  END IF;

  v_risk_level := CASE
    WHEN v_attendance_pct < 70 THEN 'critical'
    WHEN v_signals >= 3 THEN 'high'
    WHEN v_signals >= 1 THEN 'medium'
    ELSE 'low'
  END;

  RETURN jsonb_build_object(
    'student_id',       v_student.id,
    'student_name',     v_student.full_name,
    'class_id',         v_student.class_id,
    'attendance_pct',   ROUND(v_attendance_pct, 2),
    'absences_30d',     v_absences,
    'total_lessons_30d', v_total_lessons,
    'low_grades',       COALESCE(v_low_grades, '[]'::jsonb),
    'signals_count',    v_signals,
    'risk_level',       v_risk_level
  );
END;
$$;

REVOKE ALL ON FUNCTION calculate_academic_risk(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_academic_risk(UUID) TO authenticated, service_role;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 176 (calculate_academic_risk RPC)');
