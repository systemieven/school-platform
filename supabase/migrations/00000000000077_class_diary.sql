-- Migration 77: Diario de Classe (Fase 10.P)
-- Tabelas: class_diary_entries, diary_attendance

-- ── 1. class_diary_entries ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_diary_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject_id      UUID REFERENCES school_subjects(id) ON DELETE SET NULL,
  teacher_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  entry_date      DATE NOT NULL,
  type            TEXT NOT NULL DEFAULT 'aula'
                    CHECK (type IN ('aula','reposicao','avaliacao','evento','excursao','outro')),
  content         TEXT NOT NULL,            -- conteudo ministrado
  objectives      TEXT,                     -- objetivos da aula
  materials       TEXT,                     -- recursos utilizados
  notes           TEXT,                     -- observacoes gerais
  lesson_plan_id  UUID,                     -- FK para lesson_plans (add depois)
  is_locked       BOOLEAN NOT NULL DEFAULT false,  -- travado apos 48h
  locked_by       UUID REFERENCES auth.users(id),
  locked_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_class   ON class_diary_entries(class_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_teacher ON class_diary_entries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_subject ON class_diary_entries(subject_id);

ALTER TABLE class_diary_entries ENABLE ROW LEVEL SECURITY;

-- Admin/coordinator: leitura de tudo
CREATE POLICY "Admin coordinator view diary"
  ON class_diary_entries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

-- Admin: pode editar/excluir (inclusive entradas travadas)
CREATE POLICY "Admin full write diary"
  ON class_diary_entries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- Professor: CRUD nas proprias entradas nao travadas
CREATE POLICY "Teacher own diary entries"
  ON class_diary_entries FOR ALL
  USING (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND NOT is_locked
  );

-- Aluno/Responsavel: leitura das entradas da propria turma
CREATE POLICY "Student view diary"
  ON class_diary_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.class_id = class_diary_entries.class_id
        AND s.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Guardian view diary"
  ON class_diary_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_guardians sg
      JOIN students s ON s.id = sg.student_id
      WHERE s.class_id = class_diary_entries.class_id
        AND sg.guardian_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_diary_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_diary_entries_updated_at
  BEFORE UPDATE ON class_diary_entries
  FOR EACH ROW EXECUTE FUNCTION update_diary_entries_updated_at();

-- ── 2. diary_attendance ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_entry_id  UUID NOT NULL REFERENCES class_diary_entries(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'present'
                    CHECK (status IN ('present','absent','justified','late')),
  justification   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diary_entry_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_attendance_entry   ON diary_attendance(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_attendance_student ON diary_attendance(student_id);

ALTER TABLE diary_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator view diary_attendance"
  ON diary_attendance FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Admin full write diary_attendance"
  ON diary_attendance FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- Professor: CRUD na presenca de suas entradas
CREATE POLICY "Teacher own diary_attendance"
  ON diary_attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_diary_entries cde
      WHERE cde.id = diary_attendance.diary_entry_id
        AND cde.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_diary_entries cde
      WHERE cde.id = diary_attendance.diary_entry_id
        AND cde.teacher_id = auth.uid()
        AND NOT cde.is_locked
    )
  );

-- Responsavel: ve a presenca dos proprios filhos
CREATE POLICY "Guardian view own children attendance"
  ON diary_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = diary_attendance.student_id
        AND sg.guardian_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_diary_attendance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_diary_attendance_updated_at
  BEFORE UPDATE ON diary_attendance
  FOR EACH ROW EXECUTE FUNCTION update_diary_attendance_updated_at();
