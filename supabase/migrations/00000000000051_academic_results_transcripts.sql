-- Migration 51: Resultado Final e Historico Escolar
-- Fase 9 — Academico Completo (parte 3/3)

-- ============================================================================
-- STUDENT_RESULTS — Resultado final por aluno/disciplina/turma/ano
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  discipline_id   UUID NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  school_year     INTEGER NOT NULL,
  period1_avg     NUMERIC(4,1),
  period2_avg     NUMERIC(4,1),
  period3_avg     NUMERIC(4,1),
  period4_avg     NUMERIC(4,1),
  recovery_grade  NUMERIC(4,1),
  final_avg       NUMERIC(4,1),
  attendance_pct  NUMERIC(5,2),
  result          TEXT NOT NULL DEFAULT 'in_progress' CHECK (result IN (
    'approved', 'recovery', 'failed_grade', 'failed_attendance', 'in_progress'
  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, discipline_id, class_id, school_year)
);

CREATE INDEX idx_student_results_student    ON student_results(student_id);
CREATE INDEX idx_student_results_class      ON student_results(class_id);
CREATE INDEX idx_student_results_discipline ON student_results(discipline_id);
CREATE INDEX idx_student_results_year       ON student_results(school_year);
CREATE INDEX idx_student_results_result     ON student_results(result);

ALTER TABLE student_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on student_results"
  ON student_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator manage student_results"
  ON student_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

CREATE POLICY "Teacher view own class student_results"
  ON student_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_disciplines cd
      WHERE cd.class_id = student_results.class_id
      AND cd.discipline_id = student_results.discipline_id
      AND cd.teacher_id = auth.uid()
    )
  );

-- Aluno ve seus proprios resultados
CREATE POLICY "Student view own results"
  ON student_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_results.student_id
      AND students.user_id = auth.uid()
    )
  );

-- Auto updated_at
CREATE TRIGGER set_student_results_updated_at
  BEFORE UPDATE ON student_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- STUDENT_TRANSCRIPTS — Historico escolar por ano
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_transcripts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year  INTEGER NOT NULL,
  class_id     UUID NOT NULL REFERENCES school_classes(id),
  segment_id   UUID NOT NULL REFERENCES school_segments(id),
  final_result TEXT NOT NULL DEFAULT 'in_progress',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, school_year)
);

CREATE INDEX idx_student_transcripts_student ON student_transcripts(student_id);
CREATE INDEX idx_student_transcripts_year    ON student_transcripts(school_year);

ALTER TABLE student_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on student_transcripts"
  ON student_transcripts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view student_transcripts"
  ON student_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- Aluno ve seu proprio historico
CREATE POLICY "Student view own transcripts"
  ON student_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_transcripts.student_id
      AND students.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Realtime
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE student_results;
ALTER PUBLICATION supabase_realtime ADD TABLE student_transcripts;
