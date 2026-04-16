-- 1. absence_reason_options — configurable absence reasons
CREATE TABLE absence_reason_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO absence_reason_options (key, label, position) VALUES
  ('saude',              'Saúde',               1),
  ('compromisso_medico', 'Compromisso Médico',   2),
  ('viagem',             'Viagem',               3),
  ('familiar',           'Questão Familiar',     4),
  ('outro',              'Outro',                5);

-- 2. absence_communications — absence messages from guardian
CREATE TABLE absence_communications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id         UUID NOT NULL REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('planned','justification')),
  absence_date        DATE NOT NULL,
  reason_key          TEXT REFERENCES absence_reason_options(key),
  notes               TEXT,
  attachment_url      TEXT,
  attachment_path     TEXT,
  status              TEXT NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent','analyzing','accepted','rejected')),
  reviewed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  diary_attendance_id UUID, -- FK to diary_attendance.id — set when coordinator links to actual diary record
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON absence_communications (student_id);
CREATE INDEX ON absence_communications (guardian_id);
CREATE INDEX ON absence_communications (status, absence_date);

-- 3. Add FK column to diary_attendance (add if not exists)
ALTER TABLE diary_attendance
  ADD COLUMN IF NOT EXISTS absence_communication_id UUID
    REFERENCES absence_communications(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE absence_reason_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read absence_reason_options" ON absence_reason_options
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage absence_reason_options" ON absence_reason_options
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

ALTER TABLE absence_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view absence_communications" ON absence_communications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );
CREATE POLICY "admin update absence_communications" ON absence_communications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );
CREATE POLICY "guardian view own absence_communications" ON absence_communications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM guardian_profiles WHERE id = guardian_id AND user_id = auth.uid())
  );
CREATE POLICY "guardian insert absence_communications" ON absence_communications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM guardian_profiles WHERE id = guardian_id AND user_id = auth.uid())
  );
