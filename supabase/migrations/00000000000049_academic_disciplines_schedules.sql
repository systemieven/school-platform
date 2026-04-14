-- Migration 49: Disciplinas, Atribuicao Turma-Disciplina, Grade Horaria
-- Fase 9 — Academico Completo (parte 1/3)

-- ============================================================================
-- DISCIPLINES — Cadastro de disciplinas escolares
-- ============================================================================
CREATE TABLE IF NOT EXISTS disciplines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  code         TEXT NOT NULL UNIQUE,
  weekly_hours INTEGER NOT NULL DEFAULT 1 CHECK (weekly_hours > 0),
  color        TEXT NOT NULL DEFAULT '#6366f1',
  segment_ids  UUID[] NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disciplines_active ON disciplines(is_active) WHERE is_active = TRUE;

ALTER TABLE disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on disciplines"
  ON disciplines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view disciplines"
  ON disciplines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

CREATE POLICY "Teacher view active disciplines"
  ON disciplines FOR SELECT
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
    )
  );

-- Auto updated_at
CREATE TRIGGER set_disciplines_updated_at
  BEFORE UPDATE ON disciplines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- CLASS_DISCIPLINES — Vincula disciplina + turma + professor
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_disciplines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  discipline_id UUID NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  teacher_id    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, discipline_id)
);

CREATE INDEX idx_class_disciplines_class      ON class_disciplines(class_id);
CREATE INDEX idx_class_disciplines_discipline  ON class_disciplines(discipline_id);
CREATE INDEX idx_class_disciplines_teacher     ON class_disciplines(teacher_id);

ALTER TABLE class_disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on class_disciplines"
  ON class_disciplines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator manage class_disciplines"
  ON class_disciplines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

CREATE POLICY "Teacher view own class_disciplines"
  ON class_disciplines FOR SELECT
  USING (teacher_id = auth.uid());

-- ============================================================================
-- CLASS_SCHEDULES — Grade horaria (dia x horario x disciplina x professor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  discipline_id UUID NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  teacher_id    UUID NOT NULL REFERENCES profiles(id),
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

-- Indice para detecção de conflito de professor
CREATE INDEX idx_class_schedules_teacher_day ON class_schedules(teacher_id, day_of_week);
CREATE INDEX idx_class_schedules_class       ON class_schedules(class_id);

ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on class_schedules"
  ON class_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator manage class_schedules"
  ON class_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

CREATE POLICY "Teacher view own class_schedules"
  ON class_schedules FOR SELECT
  USING (teacher_id = auth.uid());

-- Alunos (via portal) precisam ver a grade da sua turma
CREATE POLICY "Student view own class schedule"
  ON class_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.user_id = auth.uid()
      AND students.class_id = class_schedules.class_id
      AND students.status = 'active'
    )
  );

-- ============================================================================
-- ALTER activities — Adicionar discipline_id (nullable, backward compat)
-- ============================================================================
ALTER TABLE activities ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines(id);

CREATE INDEX IF NOT EXISTS idx_activities_discipline ON activities(discipline_id);

-- ============================================================================
-- ALTER grades — Adicionar discipline_id (nullable, backward compat)
-- ============================================================================
ALTER TABLE grades ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines(id);

CREATE INDEX IF NOT EXISTS idx_grades_discipline ON grades(discipline_id);

-- ============================================================================
-- Realtime
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE disciplines;
ALTER PUBLICATION supabase_realtime ADD TABLE class_disciplines;
ALTER PUBLICATION supabase_realtime ADD TABLE class_schedules;
