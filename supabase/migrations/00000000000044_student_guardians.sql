-- Migration 44: Tabela student_guardians (N:N aluno-responsavel)
-- Motivo: Unificar dados do responsavel em uma unica fonte de verdade (guardian_profiles, fase 10).
-- Prepara a estrutura N:N para suportar multiplos responsaveis por aluno e multiplos filhos por responsavel.
-- Os campos guardian_* e financial_guardian_* de students serao mantidos por ora para compatibilidade,
-- mas a tabela student_guardians sera a fonte de verdade apos a Fase 10.

CREATE TABLE IF NOT EXISTS student_guardians (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_name    TEXT NOT NULL,
  guardian_phone   TEXT,
  guardian_email   TEXT,
  guardian_cpf     TEXT,
  relationship     TEXT NOT NULL DEFAULT 'outro'
                   CHECK (relationship IN ('pai', 'mae', 'avo', 'tio', 'responsavel_legal', 'outro')),
  is_financial     BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary       BOOLEAN NOT NULL DEFAULT TRUE,
  guardian_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- vinculo futuro com guardian_profiles (fase 10)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, guardian_cpf)
);

-- Indice para busca por telefone (usado no atendimento presencial)
CREATE INDEX IF NOT EXISTS idx_student_guardians_phone ON student_guardians(guardian_phone);

-- Indice para busca por CPF (usado na auth do portal do responsavel)
CREATE INDEX IF NOT EXISTS idx_student_guardians_cpf ON student_guardians(guardian_cpf);

-- Indice para busca por guardian_user_id (fase 10)
CREATE INDEX IF NOT EXISTS idx_student_guardians_user_id ON student_guardians(guardian_user_id);

-- RLS
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access student_guardians"
  ON student_guardians FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view student_guardians"
  ON student_guardians FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('coordinator', 'teacher')
    )
  );

-- Migrar dados existentes de students.guardian_* para student_guardians
-- Insere um registro por aluno que tenha guardian_name preenchido
INSERT INTO student_guardians (student_id, guardian_name, guardian_phone, guardian_email, relationship, is_primary, is_financial)
SELECT
  id,
  guardian_name,
  guardian_phone,
  guardian_email,
  'responsavel_legal',
  TRUE,
  TRUE
FROM students
WHERE guardian_name IS NOT NULL AND guardian_name != ''
ON CONFLICT DO NOTHING;
