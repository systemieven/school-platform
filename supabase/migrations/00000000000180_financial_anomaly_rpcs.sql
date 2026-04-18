-- 180: RPCs para agentes financeiros proativos (Sprint 13.IA.v2 PR4)
-- delinquency_snapshot() — resumo agregado para financial_anomaly_scout
-- admin_pulse_snapshot() — snapshot de KPIs cross-módulo para admin_pulse

CREATE OR REPLACE FUNCTION delinquency_snapshot()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_overdue    NUMERIC := 0;
  v_count_overdue    INT     := 0;
  v_new_today        INT     := 0;
  v_top_overdue      JSONB;
  v_avg_days_overdue NUMERIC := 0;
  v_baseline_7d      NUMERIC := 0;
  v_delta_pct        NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0),
    COUNT(*),
    COALESCE(AVG((now()::date - due_date)), 0)
  INTO v_total_overdue, v_count_overdue, v_avg_days_overdue
  FROM financial_installments
  WHERE status IN ('overdue', 'pending')
    AND due_date < now()::date;

  SELECT COUNT(*) INTO v_new_today
  FROM financial_installments
  WHERE status = 'overdue'
    AND due_date = (now()::date - 1);

  SELECT jsonb_agg(sub) INTO v_top_overdue
  FROM (
    SELECT
      i.id, i.student_id,
      (now()::date - i.due_date) AS days_overdue,
      (i.amount - COALESCE(i.paid_amount, 0)) AS amount_open,
      s.full_name AS student_name
    FROM financial_installments i
    LEFT JOIN students s ON s.id = i.student_id
    WHERE i.status IN ('overdue', 'pending')
      AND i.due_date < now()::date
    ORDER BY (now()::date - i.due_date) DESC, (i.amount - COALESCE(i.paid_amount, 0)) DESC
    LIMIT 5
  ) sub;

  SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) / 7.0 INTO v_baseline_7d
  FROM financial_installments
  WHERE status IN ('overdue', 'pending')
    AND due_date BETWEEN (now()::date - 7) AND (now()::date - 1);

  v_delta_pct := CASE
    WHEN v_baseline_7d > 0 THEN 100.0 * (v_total_overdue - v_baseline_7d * 7) / (v_baseline_7d * 7)
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'total_overdue',    ROUND(v_total_overdue, 2),
    'count_overdue',    v_count_overdue,
    'new_today',        v_new_today,
    'avg_days_overdue', ROUND(v_avg_days_overdue, 1),
    'baseline_7d_avg',  ROUND(v_baseline_7d, 2),
    'delta_pct_vs_7d',  ROUND(v_delta_pct, 1),
    'top_overdue',      COALESCE(v_top_overdue, '[]'::jsonb),
    'snapshot_at',      now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_pulse_snapshot()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_enrollments INT := 0;
  v_new_contacts_24h    INT := 0;
  v_visits_today        INT := 0;
  v_delinquency         JSONB;
BEGIN
  SELECT COUNT(*) INTO v_pending_enrollments
    FROM enrollments
   WHERE status IN ('new', 'pending');

  BEGIN
    SELECT COUNT(*) INTO v_new_contacts_24h
      FROM contact_requests
     WHERE created_at >= now() - interval '24 hours';
  EXCEPTION WHEN undefined_table THEN v_new_contacts_24h := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_visits_today
      FROM visit_appointments
     WHERE scheduled_date = now()::date;
  EXCEPTION WHEN undefined_table THEN v_visits_today := 0;
  END;

  v_delinquency := delinquency_snapshot();

  RETURN jsonb_build_object(
    'pending_enrollments', v_pending_enrollments,
    'new_contacts_24h',    v_new_contacts_24h,
    'visits_today',        v_visits_today,
    'delinquency',         v_delinquency,
    'snapshot_at',         now()
  );
END;
$$;

REVOKE ALL ON FUNCTION delinquency_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_pulse_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delinquency_snapshot() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_pulse_snapshot() TO authenticated, service_role;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 180 (delinquency_snapshot + admin_pulse_snapshot RPCs)');
