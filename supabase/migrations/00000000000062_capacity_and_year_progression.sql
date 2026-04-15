-- ============================================================
-- PR2 — Regras de negócio: capacidade de turma + progressão de série
-- ============================================================
-- 1. Trigger de capacidade em school_classes.max_students
-- 2. RPC create_student_with_capacity (inserção com override opcional)
-- 3. RPC suggest_year_progression (sugestões para próximo ano letivo)
-- ============================================================

-- ── 1. Trigger de capacidade ────────────────────────────────

CREATE OR REPLACE FUNCTION check_class_capacity()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_cap     int;
  v_current int;
  v_override boolean := false;
BEGIN
  -- Apenas valida quando class_id mudou (INSERT ou UPDATE com nova turma)
  IF TG_OP = 'UPDATE' AND OLD.class_id IS NOT DISTINCT FROM NEW.class_id THEN
    RETURN NEW;
  END IF;

  IF NEW.class_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Override autorizado por GUC de sessão
  BEGIN
    v_override := current_setting('app.capacity_override', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_override := false;
  END;

  IF v_override THEN
    RETURN NEW;
  END IF;

  SELECT max_students INTO v_cap
  FROM school_classes
  WHERE id = NEW.class_id;

  -- Sem limite definido = aceita
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_current
  FROM students
  WHERE class_id = NEW.class_id
    AND status = 'active'
    AND id IS DISTINCT FROM NEW.id;

  IF v_current >= v_cap THEN
    RAISE EXCEPTION 'capacity_exceeded'
      USING ERRCODE = 'P0001',
            HINT    = format('class:%s current:%s max:%s', NEW.class_id, v_current, v_cap),
            DETAIL  = format('Turma cheia (%s/%s alunos ativos).', v_current, v_cap);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_class_capacity ON students;
CREATE TRIGGER trg_check_class_capacity
  BEFORE INSERT OR UPDATE OF class_id ON students
  FOR EACH ROW EXECUTE FUNCTION check_class_capacity();

-- ── 2. RPC create_student_with_capacity ─────────────────────
-- Permite inserir aluno respeitando o trigger, e — quando force=true e o
-- usuário é admin/super_admin — bypassa via app.capacity_override e grava
-- audit log da autorização manual.

CREATE OR REPLACE FUNCTION create_student_with_capacity(
  payload jsonb,
  force   boolean DEFAULT false
) RETURNS students
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_role     text;
  v_rec      students;
  v_new_row  students;
  v_class_id uuid;
  v_cap      int;
  v_current  int;
BEGIN
  v_class_id := NULLIF(payload->>'class_id', '')::uuid;

  IF force THEN
    SELECT role INTO v_role
    FROM profiles
    WHERE id = auth.uid();

    IF v_role IS NULL OR v_role NOT IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'forbidden_override'
        USING ERRCODE = 'P0002',
              DETAIL  = 'Apenas administradores podem autorizar override de capacidade.';
    END IF;

    -- Snapshot da capacidade no momento do override (para audit)
    SELECT max_students INTO v_cap FROM school_classes WHERE id = v_class_id;
    SELECT count(*) INTO v_current
    FROM students
    WHERE class_id = v_class_id AND status = 'active';

    PERFORM set_config('app.capacity_override', 'true', true);
  END IF;

  -- Hidrata um record `students` a partir do JSON. jsonb_populate_record zera
  -- colunas ausentes para NULL, sobrescrevendo defaults — então recuperamos
  -- explicitamente as colunas obrigatórias que viriam de DEFAULT.
  v_rec := jsonb_populate_record(null::students, payload);
  v_rec.id          := COALESCE(v_rec.id, gen_random_uuid());
  v_rec.created_at  := COALESCE(v_rec.created_at, now());
  v_rec.updated_at  := COALESCE(v_rec.updated_at, now());
  v_rec.enrolled_at := COALESCE(v_rec.enrolled_at, now());
  v_rec.status      := COALESCE(v_rec.status, 'active');

  INSERT INTO students SELECT v_rec.* RETURNING * INTO v_new_row;

  IF force THEN
    PERFORM log_audit(
      'capacity_override',
      'students',
      v_new_row.id::text,
      format('Override de capacidade autorizado: turma %s (%s/%s)', v_class_id, v_current + 1, v_cap),
      NULL,
      jsonb_build_object(
        'class_id', v_class_id,
        'previous_count', v_current,
        'max_students', v_cap,
        'student_id', v_new_row.id
      )
    );
  END IF;

  RETURN v_new_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_student_with_capacity(jsonb, boolean) TO authenticated;

-- ── 2b. RPC move_student_with_capacity ──────────────────────
-- Move um aluno existente para uma nova turma, respeitando o trigger.
-- Mesma semântica de override que create_student_with_capacity.

CREATE OR REPLACE FUNCTION move_student_with_capacity(
  p_student_id uuid,
  p_class_id   uuid,
  p_force      boolean DEFAULT false
) RETURNS students
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_role     text;
  v_old_row  students;
  v_new_row  students;
  v_cap      int;
  v_current  int;
BEGIN
  SELECT * INTO v_old_row FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student_not_found' USING ERRCODE = 'P0003';
  END IF;

  IF p_force THEN
    SELECT role INTO v_role FROM profiles WHERE id = auth.uid();

    IF v_role IS NULL OR v_role NOT IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'forbidden_override'
        USING ERRCODE = 'P0002',
              DETAIL  = 'Apenas administradores podem autorizar override de capacidade.';
    END IF;

    SELECT max_students INTO v_cap FROM school_classes WHERE id = p_class_id;
    SELECT count(*) INTO v_current
    FROM students
    WHERE class_id = p_class_id AND status = 'active';

    PERFORM set_config('app.capacity_override', 'true', true);
  END IF;

  UPDATE students
     SET class_id = p_class_id,
         updated_at = now()
   WHERE id = p_student_id
   RETURNING * INTO v_new_row;

  IF p_force THEN
    PERFORM log_audit(
      'capacity_override',
      'students',
      v_new_row.id::text,
      format('Override de capacidade autorizado em movimentação: turma %s (%s/%s)', p_class_id, v_current + 1, v_cap),
      jsonb_build_object('class_id', v_old_row.class_id),
      jsonb_build_object(
        'class_id', p_class_id,
        'previous_count', v_current,
        'max_students', v_cap,
        'student_id', v_new_row.id
      )
    );
  END IF;

  RETURN v_new_row;
END;
$$;

GRANT EXECUTE ON FUNCTION move_student_with_capacity(uuid, uuid, boolean) TO authenticated;

-- ── 3. RPC suggest_year_progression ─────────────────────────
-- Para um target_year, retorna sugestão de série/ação para cada aluno
-- ativo do ano anterior, baseada no agregado de student_results.
-- Não aplica nada — apenas propõe. Confirmação humana obrigatória.

CREATE OR REPLACE FUNCTION suggest_year_progression(target_year int)
RETURNS TABLE (
  student_id            uuid,
  student_name          text,
  current_class_id      uuid,
  current_class_name    text,
  current_series_id     uuid,
  current_series_name   text,
  current_school_year   int,
  segment_id            uuid,
  segment_name          text,
  overall_result        text,
  suggested_action      text,
  suggested_series_id   uuid,
  suggested_series_name text
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  -- Aliases prefixados com s_ no CTE evitam ambiguidade com OUT params da função
  RETURN QUERY
  WITH student_summary AS (
    SELECT
      st.id          AS s_student_id,
      st.full_name   AS s_student_name,
      st.class_id    AS s_current_class_id,
      sc.name        AS s_current_class_name,
      sc.series_id   AS s_current_series_id,
      ss.name        AS s_current_series_name,
      sc.school_year AS s_current_school_year,
      sc.segment_id  AS s_segment_id,
      sg.name        AS s_segment_name,
      ss.order_index AS s_current_order_index,
      CASE
        WHEN bool_or(sr.result IN ('failed_grade','failed_attendance')) THEN 'failed'
        WHEN bool_or(sr.result = 'recovery')                            THEN 'recovery'
        WHEN bool_and(sr.result = 'approved')                           THEN 'approved'
        ELSE 'in_progress'
      END AS s_overall_result
    FROM students st
    JOIN school_classes  sc ON sc.id = st.class_id
    JOIN school_series   ss ON ss.id = sc.series_id
    JOIN school_segments sg ON sg.id = sc.segment_id
    LEFT JOIN student_results sr
      ON sr.student_id = st.id
     AND sr.school_year = target_year - 1
    WHERE st.status = 'active'
      AND sc.school_year = target_year - 1
    GROUP BY st.id, st.full_name, st.class_id, sc.name, sc.series_id,
             sc.school_year, sc.segment_id, ss.name, sg.name, ss.order_index
  )
  SELECT
    s.s_student_id,
    s.s_student_name,
    s.s_current_class_id,
    s.s_current_class_name,
    s.s_current_series_id,
    s.s_current_series_name,
    s.s_current_school_year,
    s.s_segment_id,
    s.s_segment_name,
    s.s_overall_result,
    CASE
      WHEN s.s_overall_result = 'approved'                  THEN 'advance'
      WHEN s.s_overall_result IN ('failed','recovery')      THEN 'repeat'
      ELSE 'pending'
    END AS suggested_action,
    CASE
      WHEN s.s_overall_result = 'approved' THEN next_series.id
      ELSE s.s_current_series_id
    END AS suggested_series_id,
    CASE
      WHEN s.s_overall_result = 'approved' THEN next_series.name
      ELSE s.s_current_series_name
    END AS suggested_series_name
  FROM student_summary s
  LEFT JOIN LATERAL (
    SELECT ss2.id, ss2.name
    FROM school_series ss2
    WHERE ss2.segment_id = s.s_segment_id
      AND ss2.order_index > s.s_current_order_index
      AND ss2.is_active = true
    ORDER BY ss2.order_index ASC
    LIMIT 1
  ) next_series ON true
  ORDER BY s.s_segment_name, s.s_current_order_index, s.s_student_name;
END;
$$;

GRANT EXECUTE ON FUNCTION suggest_year_progression(int) TO authenticated;

-- ── 4. Audit log entry de mudança ──────────────────────────────
COMMENT ON FUNCTION check_class_capacity() IS
  'PR2: trigger BEFORE INSERT/UPDATE OF class_id em students. Bloqueia ' ||
  'inserção quando class.max_students é atingido, exceto se o GUC ' ||
  'app.capacity_override estiver setado para true na sessão.';

COMMENT ON FUNCTION create_student_with_capacity(jsonb, boolean) IS
  'PR2: insere student respeitando o trigger de capacidade. Quando force=true ' ||
  'e o caller é admin/super_admin, seta o GUC app.capacity_override para ' ||
  'bypassar e grava audit log da autorização.';

COMMENT ON FUNCTION suggest_year_progression(int) IS
  'PR2: dado target_year, retorna sugestões de progressão de série para ' ||
  'cada aluno ativo do ano anterior baseadas em student_results. ' ||
  'Não aplica nada — apenas propõe.';
