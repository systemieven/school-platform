-- Migration 83: Ficha de Saude do Aluno (Fase 11 — Secretaria Digital)

CREATE TABLE IF NOT EXISTS student_health_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,

  -- Alergias e intolerancias
  has_allergies         BOOLEAN NOT NULL DEFAULT false,
  allergies             TEXT[],            -- lista: 'amendoim', 'lactose', etc.
  allergy_notes         TEXT,

  -- Medicamentos de uso continuo
  uses_medication       BOOLEAN NOT NULL DEFAULT false,
  medications           JSONB,             -- [{name, dose, frequency, instructions}]

  -- Necessidades especiais
  has_special_needs     BOOLEAN NOT NULL DEFAULT false,
  special_needs         TEXT,              -- descricao livre
  learning_difficulties TEXT,

  -- Informacoes medicas gerais
  blood_type            TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-',NULL)),
  chronic_conditions    TEXT[],            -- diabetes, asma, epilepsia, etc.
  health_plan           TEXT,              -- plano de saude / convenio
  health_plan_number    TEXT,

  -- Contato de emergencia (alem do responsavel principal)
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_rel   TEXT,            -- parentesco

  -- Autorizacoes
  authorized_photo       BOOLEAN NOT NULL DEFAULT true,    -- autorizacao de imagem
  authorized_first_aid   BOOLEAN NOT NULL DEFAULT true,    -- primeiros socorros
  authorized_evacuation  BOOLEAN NOT NULL DEFAULT true,    -- plano de evacuacao

  notes                 TEXT,

  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_health_records ENABLE ROW LEVEL SECURITY;

-- Somente admin e coordinator tem acesso (dado sensivel)
CREATE POLICY "Admin coordinator full access health"
  ON student_health_records FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

-- Responsavel pode ver a ficha do proprio filho (somente leitura)
CREATE POLICY "Guardian view own child health"
  ON student_health_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = student_health_records.student_id
        AND sg.guardian_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_health_records_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_health_records_updated_at
  BEFORE UPDATE ON student_health_records
  FOR EACH ROW EXECUTE FUNCTION update_health_records_updated_at();
