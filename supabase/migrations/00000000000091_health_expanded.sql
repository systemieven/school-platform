-- Migration 91: Ficha de Saúde Expandida (Fase 11.C)

-- 1. Expand student_health_records with new columns (additive — no breaking changes)
ALTER TABLE student_health_records
  ADD COLUMN IF NOT EXISTS food_restrictions    TEXT,
  ADD COLUMN IF NOT EXISTS allergy_categories   JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS can_receive_medication BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS medication_guidance  TEXT;

-- 2. student_medical_certificates — physical fitness certificates per student
CREATE TABLE student_medical_certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  issue_date          DATE NOT NULL,
  valid_until         DATE NOT NULL,
  doctor_name         TEXT NOT NULL,
  doctor_crm          TEXT NOT NULL,
  file_path           TEXT,
  file_url            TEXT,
  file_url_expires_at TIMESTAMPTZ,
  observations        TEXT,
  uploaded_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_via        TEXT NOT NULL DEFAULT 'admin'
                        CHECK (uploaded_via IN ('admin','guardian_portal')),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  superseded_by       UUID REFERENCES student_medical_certificates(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certs_student ON student_medical_certificates(student_id);
CREATE INDEX idx_certs_valid ON student_medical_certificates(valid_until) WHERE is_active = true;

-- Trigger: when a new certificate is inserted, mark the previous one as superseded
CREATE OR REPLACE FUNCTION supersede_previous_certificate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE student_medical_certificates
    SET is_active = false, superseded_by = NEW.id
  WHERE student_id = NEW.student_id
    AND id <> NEW.id
    AND is_active = true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_certificate_insert
  AFTER INSERT ON student_medical_certificates
  FOR EACH ROW EXECUTE FUNCTION supersede_previous_certificate();

-- 3. health_record_update_requests — guardian-submitted updates awaiting secretaria review
CREATE TABLE health_record_update_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id      UUID NOT NULL REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  proposed_data    JSONB NOT NULL,
  current_snapshot JSONB NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','rejected')),
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_req_student ON health_record_update_requests(student_id);
CREATE INDEX idx_health_req_status ON health_record_update_requests(status);

-- Trigger: on confirmation, apply proposed_data to student_health_records
CREATE OR REPLACE FUNCTION apply_health_update_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
    -- Update each field from proposed_data into student_health_records
    UPDATE student_health_records
    SET
      food_restrictions     = COALESCE((NEW.proposed_data->>'food_restrictions'), food_restrictions),
      allergy_categories    = COALESCE(NEW.proposed_data->'allergy_categories', allergy_categories),
      can_receive_medication = COALESCE((NEW.proposed_data->>'can_receive_medication')::BOOLEAN, can_receive_medication),
      medication_guidance   = COALESCE((NEW.proposed_data->>'medication_guidance'), medication_guidance),
      has_allergies         = COALESCE((NEW.proposed_data->>'has_allergies')::BOOLEAN, has_allergies),
      allergies             = COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.proposed_data->'allergies')), allergies),
      allergy_notes         = COALESCE((NEW.proposed_data->>'allergy_notes'), allergy_notes),
      uses_medication       = COALESCE((NEW.proposed_data->>'uses_medication')::BOOLEAN, uses_medication),
      medications           = COALESCE(NEW.proposed_data->'medications', medications),
      chronic_conditions    = COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.proposed_data->'chronic_conditions')), chronic_conditions),
      has_special_needs     = COALESCE((NEW.proposed_data->>'has_special_needs')::BOOLEAN, has_special_needs),
      special_needs         = COALESCE((NEW.proposed_data->>'special_needs'), special_needs),
      updated_at            = now()
    WHERE student_id = NEW.student_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_update_request_confirmed
  BEFORE UPDATE ON health_record_update_requests
  FOR EACH ROW EXECUTE FUNCTION apply_health_update_request();

-- 4. Restricted view for teachers
CREATE OR REPLACE VIEW student_health_records_teacher_view AS
SELECT
  id, student_id,
  has_allergies, allergies, allergy_categories, allergy_notes,
  has_special_needs, special_needs, learning_difficulties,
  chronic_conditions,
  food_restrictions,
  uses_medication, medications,
  can_receive_medication, medication_guidance,
  updated_at
FROM student_health_records;

-- 5. RLS for new tables
ALTER TABLE student_medical_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_coord_manage_certs" ON student_medical_certificates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator')));
CREATE POLICY "guardian_view_own_certs" ON student_medical_certificates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM student_guardians sg WHERE sg.student_id = student_medical_certificates.student_id AND sg.guardian_user_id = auth.uid()
  ));
CREATE POLICY "guardian_insert_certs" ON student_medical_certificates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM student_guardians sg WHERE sg.student_id = student_medical_certificates.student_id AND sg.guardian_user_id = auth.uid()
  ));

ALTER TABLE health_record_update_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_coord_manage_health_requests" ON health_record_update_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator')));
CREATE POLICY "guardian_view_own_health_requests" ON health_record_update_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM guardian_profiles WHERE id = guardian_id AND user_id = auth.uid()));
CREATE POLICY "guardian_insert_health_requests" ON health_record_update_requests FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM guardian_profiles WHERE id = guardian_id AND user_id = auth.uid()));

-- 6. Storage bucket for certificates
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('atestados', 'atestados', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for atestados bucket
CREATE POLICY "admin_coord_atestados" ON storage.objects FOR ALL
  USING (bucket_id = 'atestados' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator')
  ));
CREATE POLICY "guardian_upload_atestados" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'atestados' AND auth.role() = 'authenticated');
CREATE POLICY "guardian_view_atestados" ON storage.objects FOR SELECT
  USING (bucket_id = 'atestados' AND auth.role() = 'authenticated');

-- 7. Modules
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES ('health-records-management', 'Gestão de Saúde', 'Fichas de saúde expandidas, atestados e atualizações do responsável', 'HeartPulse', 'secretaria', 67, TRUE, ARRAY['secretaria-saude'])
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'health-records-management', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'health-records-management', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'health-records-management', TRUE, TRUE, TRUE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- 8. system_settings keys (upsert defaults)
INSERT INTO system_settings (category, key, value)
VALUES
  ('academico', 'health.require_certificate_segments', '[]'::JSONB),
  ('academico', 'health.certificate_alert_days',       '30'::JSONB),
  ('academico', 'health.required_fields',              '["blood_type"]'::JSONB),
  ('academico', 'health.allow_guardian_updates',       'true'::JSONB)
ON CONFLICT (category, key) DO NOTHING;
