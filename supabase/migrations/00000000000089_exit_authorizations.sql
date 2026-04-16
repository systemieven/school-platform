-- 1. authorized_persons — permanent authorized people per student
CREATE TABLE authorized_persons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  cpf          TEXT NOT NULL,
  phone        TEXT NOT NULL,
  photo_url    TEXT,
  photo_path   TEXT,
  relationship TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON authorized_persons (student_id);

-- 2. exit_authorizations — exceptional one-time exit authorization
CREATE TABLE exit_authorizations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id               UUID NOT NULL REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  third_party_name          TEXT NOT NULL,
  third_party_cpf           TEXT NOT NULL,
  third_party_phone         TEXT NOT NULL,
  third_party_rel           TEXT NOT NULL
                              CHECK (third_party_rel IN ('tio_a','primo_a','vizinho_a','amigo_a','conhecido_a','outro')),
  third_party_photo_url     TEXT,
  third_party_photo_path    TEXT,
  valid_from                DATE NOT NULL,
  valid_until               DATE NOT NULL,
  period                    TEXT CHECK (period IN ('morning','afternoon','full_day')),
  password_confirmed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                    TEXT NOT NULL DEFAULT 'requested'
                              CHECK (status IN ('requested','analyzing','authorized','rejected','completed','expired')),
  reviewed_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at               TIMESTAMPTZ,
  rejection_reason          TEXT,
  exited_at                 TIMESTAMPTZ,
  exit_confirmed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  audit_log                 JSONB NOT NULL DEFAULT '[]',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON exit_authorizations (student_id, status);
CREATE INDEX ON exit_authorizations (guardian_id);

-- Append-only trigger for audit_log
CREATE OR REPLACE FUNCTION prevent_audit_log_reduction()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_array_length(NEW.audit_log) < jsonb_array_length(OLD.audit_log) THEN
    RAISE EXCEPTION 'audit_log is append-only';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER exit_auth_audit_log_immutable
  BEFORE UPDATE ON exit_authorizations
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_reduction();

-- RLS
ALTER TABLE authorized_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage authorized_persons" ON authorized_persons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );
CREATE POLICY "guardian view own authorized_persons" ON authorized_persons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guardian_profiles gp
      JOIN student_guardians sg ON sg.guardian_id = gp.id
      WHERE gp.user_id = auth.uid() AND sg.student_id = authorized_persons.student_id
    )
  );

ALTER TABLE exit_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view exit_authorizations" ON exit_authorizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN role_permissions rp ON rp.role = p.role
      WHERE p.id = auth.uid()
        AND rp.module_key IN ('exit-authorizations','portaria')
        AND rp.can_view = true
    )
  );
CREATE POLICY "admin update exit_authorizations" ON exit_authorizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN role_permissions rp ON rp.role = p.role
      WHERE p.id = auth.uid()
        AND rp.module_key IN ('exit-authorizations','portaria')
        AND rp.can_edit = true
    )
  );
CREATE POLICY "guardian view own exit_authorizations" ON exit_authorizations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM guardian_profiles WHERE id = guardian_id AND user_id = auth.uid())
  );
CREATE POLICY "guardian insert exit_authorizations" ON exit_authorizations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM guardian_profiles WHERE id = guardian_id AND user_id = auth.uid())
  );
