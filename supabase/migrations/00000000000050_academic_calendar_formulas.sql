-- Migration 50: Calendario Letivo e Formulas de Media
-- Fase 9 — Academico Completo (parte 2/3)

-- ============================================================================
-- SCHOOL_CALENDAR_EVENTS — Calendario letivo com periodos e eventos
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_calendar_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN (
    'holiday', 'exam_period', 'recess', 'deadline',
    'institutional', 'period_start', 'period_end'
  )),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  school_year   INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  period_number INTEGER,
  segment_ids   UUID[] NOT NULL DEFAULT '{}',
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_calendar_events_year     ON school_calendar_events(school_year);
CREATE INDEX idx_calendar_events_type     ON school_calendar_events(type);
CREATE INDEX idx_calendar_events_dates    ON school_calendar_events(start_date, end_date);

ALTER TABLE school_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on school_calendar_events"
  ON school_calendar_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator manage school_calendar_events"
  ON school_calendar_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

CREATE POLICY "Teacher view school_calendar_events"
  ON school_calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

-- Alunos podem ver o calendario (via portal)
CREATE POLICY "Student view school_calendar_events"
  ON school_calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid()
      AND students.status = 'active'
    )
  );

-- ============================================================================
-- GRADE_FORMULAS — Formula de media configuravel por segmento/ano
-- ============================================================================
CREATE TABLE IF NOT EXISTS grade_formulas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id         UUID NOT NULL REFERENCES school_segments(id) ON DELETE CASCADE,
  school_year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  formula_type       TEXT NOT NULL DEFAULT 'simple' CHECK (formula_type IN (
    'simple', 'weighted', 'by_period', 'custom'
  )),
  config             JSONB NOT NULL DEFAULT '{}',
  passing_grade      NUMERIC(4,1) NOT NULL DEFAULT 7.0,
  recovery_grade     NUMERIC(4,1) NOT NULL DEFAULT 5.0,
  min_attendance_pct NUMERIC(5,2) NOT NULL DEFAULT 75.00,
  grade_scale        TEXT NOT NULL DEFAULT 'numeric' CHECK (grade_scale IN ('numeric', 'conceptual')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(segment_id, school_year)
);

ALTER TABLE grade_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on grade_formulas"
  ON grade_formulas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view grade_formulas"
  ON grade_formulas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- Auto updated_at
CREATE TRIGGER set_grade_formulas_updated_at
  BEFORE UPDATE ON grade_formulas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ALTER student_attendance — Adicionar vinculo com calendario e disciplina
-- ============================================================================
ALTER TABLE student_attendance
  ADD COLUMN IF NOT EXISTS school_calendar_event_id UUID REFERENCES school_calendar_events(id);

ALTER TABLE student_attendance
  ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines(id);

CREATE INDEX IF NOT EXISTS idx_student_attendance_calendar_event
  ON student_attendance(school_calendar_event_id);

CREATE INDEX IF NOT EXISTS idx_student_attendance_discipline
  ON student_attendance(discipline_id);

-- ============================================================================
-- Realtime
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE school_calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE grade_formulas;
