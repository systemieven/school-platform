-- Migration 79: Planos de Aula (Fase 10.P)

CREATE TABLE IF NOT EXISTS lesson_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject_id      UUID REFERENCES school_subjects(id) ON DELETE SET NULL,
  teacher_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  objective       TEXT,
  competencies    TEXT[],
  content         TEXT,             -- conteudo programatico
  methodology     TEXT,
  resources       TEXT,
  assessment      TEXT,             -- avaliacao prevista
  planned_date    DATE,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','executed','cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adiciona FK em class_diary_entries para lesson_plans
ALTER TABLE class_diary_entries
  ADD CONSTRAINT fk_diary_lesson_plan
  FOREIGN KEY (lesson_plan_id) REFERENCES lesson_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_plans_class   ON lesson_plans(class_id, planned_date DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher ON lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_status  ON lesson_plans(status);

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator view plans"
  ON lesson_plans FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Admin full write plans"
  ON lesson_plans FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

CREATE POLICY "Teacher own lesson plans"
  ON lesson_plans FOR ALL
  USING (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  )
  WITH CHECK (teacher_id = auth.uid());

CREATE OR REPLACE FUNCTION update_lesson_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_lesson_plans_updated_at
  BEFORE UPDATE ON lesson_plans
  FOR EACH ROW EXECUTE FUNCTION update_lesson_plans_updated_at();
