-- Migration 78: Atividades e Notas (Fase 10.P)
-- Tabelas: class_activities, activity_scores

-- ── 1. class_activities ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject_id      UUID REFERENCES school_subjects(id) ON DELETE SET NULL,
  teacher_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'exercicio'
                    CHECK (type IN (
                      'exercicio','trabalho','prova','apresentacao',
                      'excursao','autoavaliacao','outro'
                    )),
  activity_date   DATE NOT NULL,
  weight          NUMERIC(5,2) NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  max_score       NUMERIC(6,2) NOT NULL DEFAULT 10.0 CHECK (max_score > 0),
  min_passing     NUMERIC(6,2),              -- nota minima de aprovacao (opcional)
  diary_entry_id  UUID REFERENCES class_diary_entries(id) ON DELETE SET NULL,
  description     TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT false,  -- professor controla visibilidade
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_activities_class   ON class_activities(class_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_activities_teacher ON class_activities(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_activities_subject ON class_activities(subject_id);

ALTER TABLE class_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator view activities"
  ON class_activities FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Admin full write activities"
  ON class_activities FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

CREATE POLICY "Teacher own activities"
  ON class_activities FOR ALL
  USING (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  )
  WITH CHECK (
    teacher_id = auth.uid()
  );

-- Responsavel: ve atividades publicadas dos filhos
CREATE POLICY "Guardian view published activities"
  ON class_activities FOR SELECT
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM student_guardians sg
      JOIN students s ON s.id = sg.student_id
      WHERE s.class_id = class_activities.class_id
        AND sg.guardian_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_class_activities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_class_activities_updated_at
  BEFORE UPDATE ON class_activities
  FOR EACH ROW EXECUTE FUNCTION update_class_activities_updated_at();

-- ── 2. activity_scores ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     UUID NOT NULL REFERENCES class_activities(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score           NUMERIC(6,2),              -- null = nao lancado ainda
  is_exempt       BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activity_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_scores_activity ON activity_scores(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_scores_student  ON activity_scores(student_id);

ALTER TABLE activity_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator view scores"
  ON activity_scores FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Admin full write scores"
  ON activity_scores FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- Professor: CRUD nas notas das proprias atividades
CREATE POLICY "Teacher own activity scores"
  ON activity_scores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_activities ca
      WHERE ca.id = activity_scores.activity_id
        AND ca.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_activities ca
      WHERE ca.id = activity_scores.activity_id
        AND ca.teacher_id = auth.uid()
    )
  );

-- Responsavel: ve notas dos proprios filhos (atividades publicadas)
CREATE POLICY "Guardian view own children scores"
  ON activity_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = activity_scores.student_id
        AND sg.guardian_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM class_activities ca
      WHERE ca.id = activity_scores.activity_id AND ca.is_published = true
    )
  );

CREATE OR REPLACE FUNCTION update_activity_scores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_activity_scores_updated_at
  BEFORE UPDATE ON activity_scores
  FOR EACH ROW EXECUTE FUNCTION update_activity_scores_updated_at();
