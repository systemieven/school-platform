-- Migration 80: Elaboracao de Provas (Fase 10.P)
-- Tabelas: class_exams, exam_questions

-- ── 1. class_exams ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_exams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject_id      UUID REFERENCES school_subjects(id) ON DELETE SET NULL,
  teacher_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  instructions    TEXT,
  exam_date       DATE,
  total_score     NUMERIC(6,2),              -- calculado a partir das questoes (ou manual)
  activity_id     UUID REFERENCES class_activities(id) ON DELETE SET NULL,  -- liga a atividade
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','applied','corrected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_exams_class   ON class_exams(class_id);
CREATE INDEX IF NOT EXISTS idx_class_exams_teacher ON class_exams(teacher_id);

ALTER TABLE class_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator view exams"
  ON class_exams FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Admin full write exams"
  ON class_exams FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

CREATE POLICY "Teacher own exams"
  ON class_exams FOR ALL
  USING (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  )
  WITH CHECK (teacher_id = auth.uid());

CREATE OR REPLACE FUNCTION update_class_exams_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_class_exams_updated_at
  BEFORE UPDATE ON class_exams
  FOR EACH ROW EXECUTE FUNCTION update_class_exams_updated_at();

-- ── 2. exam_questions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID NOT NULL REFERENCES class_exams(id) ON DELETE CASCADE,
  block_number    INT NOT NULL DEFAULT 1,
  question_number INT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'dissertativa'
                    CHECK (type IN (
                      'dissertativa','multipla_escolha','verdadeiro_falso','associacao'
                    )),
  stem            TEXT NOT NULL,           -- enunciado
  options         JSONB,                   -- [{key, text}] para multipla_escolha/associacao
  correct_answer  TEXT,                    -- chave da resposta correta (objetivas)
  score           NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, block_number, question_number)
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id, block_number, question_number);

ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

-- Herda acesso do exam: quem ve o exam, ve as questoes
CREATE POLICY "Admin coordinator view questions"
  ON exam_questions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Admin full write questions"
  ON exam_questions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

CREATE POLICY "Teacher own exam questions"
  ON exam_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_exams ce
      WHERE ce.id = exam_questions.exam_id
        AND ce.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_exams ce
      WHERE ce.id = exam_questions.exam_id
        AND ce.teacher_id = auth.uid()
    )
  );
