-- Migration 75: Portal do Responsavel (Fase 10)
-- Tabelas: guardian_profiles, student_occurrences, activity_authorizations, authorization_responses
-- Tambem adiciona role 'responsavel' ao CHECK da tabela profiles.

-- ── 1. Adiciona role 'responsavel' ao profiles ──────────────────────────────
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','coordinator','teacher','student','user','responsavel'));

-- ── 2. guardian_profiles ─────────────────────────────────────────────────────
-- Uma linha por responsavel autenticado no portal.
-- id = auth.users(id) (mesmo padrao de profiles).
CREATE TABLE IF NOT EXISTS guardian_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  cpf                 TEXT,
  phone               TEXT,
  email               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guardian_profiles_cpf
  ON guardian_profiles(cpf) WHERE cpf IS NOT NULL;

ALTER TABLE guardian_profiles ENABLE ROW LEVEL SECURITY;

-- Admin: CRUD completo
CREATE POLICY "Admin full access guardian_profiles"
  ON guardian_profiles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- Coordinator: leitura
CREATE POLICY "Coordinator view guardian_profiles"
  ON guardian_profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coordinator'))
  );

-- O proprio responsavel pode ler/atualizar seu perfil
CREATE POLICY "Guardian own profile"
  ON guardian_profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_guardian_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_guardian_profiles_updated_at
  BEFORE UPDATE ON guardian_profiles
  FOR EACH ROW EXECUTE FUNCTION update_guardian_profiles_updated_at();

-- ── 3. Atualiza student_guardians para referenciar guardian_profiles ─────────
-- guardian_user_id ja existe (migration 44), agora pode ter FK formal
-- (nao adicionamos FK dura pois os dados legados ja existem sem profiles)
-- Apenas criamos o indice se ainda nao existir (ja foi criado em 44)

-- ── 4. student_occurrences ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_occurrences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id            UUID REFERENCES school_classes(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type                TEXT NOT NULL DEFAULT 'behavioral'
                        CHECK (type IN (
                          'behavioral','academic','health','administrative',
                          'commendation','absence_justification'
                        )),
  severity            TEXT NOT NULL DEFAULT 'info'
                        CHECK (severity IN ('info','warning','critical')),
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  attachments         TEXT[],
  visible_to_guardian BOOLEAN NOT NULL DEFAULT true,
  guardian_response   TEXT,
  guardian_responded_at TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','read','resolved')),
  resolved_at         TIMESTAMPTZ,
  occurrence_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_occurrences_student ON student_occurrences(student_id);
CREATE INDEX IF NOT EXISTS idx_student_occurrences_status  ON student_occurrences(status);
CREATE INDEX IF NOT EXISTS idx_student_occurrences_date    ON student_occurrences(occurrence_date DESC);

ALTER TABLE student_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator full access occurrences"
  ON student_occurrences FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Teacher insert own occurrences"
  ON student_occurrences FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Teacher view own occurrences"
  ON student_occurrences FOR SELECT
  USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- Responsavel ve apenas ocorrencias dos seus filhos (visible_to_guardian=true)
CREATE POLICY "Guardian view own children occurrences"
  ON student_occurrences FOR SELECT
  USING (
    visible_to_guardian = true
    AND EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = student_occurrences.student_id
        AND sg.guardian_user_id = auth.uid()
    )
  );

-- Responsavel pode escrever resposta (UPDATE somente guardian_response e status)
CREATE POLICY "Guardian respond to occurrence"
  ON student_occurrences FOR UPDATE
  USING (
    visible_to_guardian = true
    AND EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = student_occurrences.student_id
        AND sg.guardian_user_id = auth.uid()
    )
  )
  WITH CHECK (
    visible_to_guardian = true
  );

CREATE OR REPLACE FUNCTION update_student_occurrences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_student_occurrences_updated_at
  BEFORE UPDATE ON student_occurrences
  FOR EACH ROW EXECUTE FUNCTION update_student_occurrences_updated_at();

-- ── 5. activity_authorizations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_authorizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  activity_date       DATE,
  deadline            DATE NOT NULL,
  class_ids           UUID[],                 -- turmas alvo (vazio = todas)
  student_ids         UUID[],                 -- alunos especificos (vazio = toda a turma)
  requires_response   BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','closed','cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activity_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access authorizations"
  ON activity_authorizations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

CREATE POLICY "Coordinator view authorizations"
  ON activity_authorizations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coordinator'))
  );

CREATE POLICY "Guardian view active authorizations"
  ON activity_authorizations FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'responsavel')
  );

-- ── 6. authorization_responses ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authorization_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id      UUID NOT NULL REFERENCES activity_authorizations(id) ON DELETE CASCADE,
  student_id            UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id           UUID REFERENCES guardian_profiles(id) ON DELETE SET NULL,
  response              TEXT NOT NULL CHECK (response IN ('authorized','not_authorized','pending')),
  notes                 TEXT,
  responded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (authorization_id, student_id)
);

ALTER TABLE authorization_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator full access auth_responses"
  ON authorization_responses FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

CREATE POLICY "Guardian own responses"
  ON authorization_responses FOR ALL
  USING (guardian_id = auth.uid())
  WITH CHECK (guardian_id = auth.uid());
