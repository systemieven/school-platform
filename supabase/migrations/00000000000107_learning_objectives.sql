-- Migration 107 — learning_objectives + lesson_plan_objectives (Fase 12)
-- Objetivos de aprendizagem com referência BNCC e associação com planos de aula.

-- ── Objetivos de aprendizagem ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_objectives (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID        REFERENCES school_subjects(id) ON DELETE SET NULL,
  segment_id  UUID        REFERENCES school_segments(id) ON DELETE SET NULL,
  school_year INT,
  code        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  competency  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lo_subject  ON learning_objectives(subject_id);
CREATE INDEX IF NOT EXISTS idx_lo_segment  ON learning_objectives(segment_id);
CREATE INDEX IF NOT EXISTS idx_lo_active   ON learning_objectives(is_active);
CREATE INDEX IF NOT EXISTS idx_lo_code     ON learning_objectives(code);

ALTER TABLE learning_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator read objectives"
  ON learning_objectives FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND role IN ('super_admin','admin','coordinator','teacher'))
  );

CREATE POLICY "Admin coordinator write objectives"
  ON learning_objectives FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND role IN ('super_admin','admin','coordinator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND role IN ('super_admin','admin','coordinator'))
  );

CREATE OR REPLACE FUNCTION update_learning_objectives_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_lo_updated_at
  BEFORE UPDATE ON learning_objectives
  FOR EACH ROW EXECUTE FUNCTION update_learning_objectives_updated_at();

-- ── Associação plano de aula ↔ objetivo ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_plan_objectives (
  lesson_plan_id        UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  learning_objective_id UUID NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_plan_id, learning_objective_id)
);

CREATE INDEX IF NOT EXISTS idx_lpo_plan      ON lesson_plan_objectives(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_lpo_objective ON lesson_plan_objectives(learning_objective_id);

ALTER TABLE lesson_plan_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator full lpo"
  ON lesson_plan_objectives FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND role IN ('super_admin','admin','coordinator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Teacher manage own plan objectives"
  ON lesson_plan_objectives FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lesson_plans lp
      JOIN profiles p ON p.id = auth.uid()
      WHERE lp.id = lesson_plan_objectives.lesson_plan_id
        AND lp.teacher_id = auth.uid()
        AND p.role = 'teacher'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lesson_plans lp
      JOIN profiles p ON p.id = auth.uid()
      WHERE lp.id = lesson_plan_objectives.lesson_plan_id
        AND lp.teacher_id = auth.uid()
        AND p.role = 'teacher'
    )
  );

-- ── Module permission: objetivos-bncc ─────────────────────────────────────────
INSERT INTO module_permissions (module_key, role, can_view, can_edit)
VALUES
  ('objetivos-bncc', 'super_admin', true, true),
  ('objetivos-bncc', 'admin',       true, true),
  ('objetivos-bncc', 'coordinator', true, true),
  ('objetivos-bncc', 'teacher',     true, false),
  ('objetivos-bncc', 'user',        false, false)
ON CONFLICT (module_key, role) DO NOTHING;
