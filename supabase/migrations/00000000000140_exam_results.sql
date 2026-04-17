-- Migration 140: exam_results + discipline_id/period em class_exams
-- Conecta provas ao boletim: professores lancam notas por aluno por prova;
-- discipline_id e period em class_exams permitem que o calculo de medias
-- associe a nota ao bimestre e disciplina corretos.

-- ── 1. Colunas adicionais em class_exams ─────────────────────────────────────
ALTER TABLE class_exams
  ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period        TEXT;   -- '1º Bimestre' … '4º Bimestre'

-- ── 2. Tabela exam_results ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_results (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     UUID        NOT NULL REFERENCES class_exams(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES students(id)    ON DELETE CASCADE,
  score       NUMERIC(6,2),
  feedback    TEXT,
  graded_at   TIMESTAMPTZ DEFAULT now(),
  graded_by   UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_exam_results"
  ON exam_results FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
