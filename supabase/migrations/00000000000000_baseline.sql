-- ============================================================================
-- BASELINE MIGRATION — Colégio Batista Admin Panel
-- Snapshot of remote schema as of 2026-04-07
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ── Profiles ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'user'
              CHECK (role IN ('super_admin','admin','coordinator','teacher','student','user')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role  ON profiles(role);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')));
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin') AND role NOT IN ('super_admin','admin'))
  );
CREATE POLICY "Super admin can delete profiles" ON profiles FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- ── System Settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON system_settings(category);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Anon can read public settings" ON system_settings FOR SELECT
  USING (category IN ('contact','visit','enrollment','general'));
CREATE POLICY "Admins can manage settings" ON system_settings FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin')));

-- ── Visit Settings & Blocked Dates ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS visit_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_key       TEXT NOT NULL UNIQUE,
  reason_label     TEXT NOT NULL,
  start_hour       INT NOT NULL DEFAULT 9,
  end_hour         INT NOT NULL DEFAULT 17,
  duration_minutes INT NOT NULL DEFAULT 60,
  lunch_start      INT NOT NULL DEFAULT 12,
  lunch_end        INT NOT NULL DEFAULT 14,
  max_companions   INT NOT NULL DEFAULT 3,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE visit_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_visit_settings" ON visit_settings FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS visit_blocked_dates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date DATE NOT NULL UNIQUE,
  reason       TEXT
);

ALTER TABLE visit_blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_blocked_dates" ON visit_blocked_dates FOR SELECT USING (true);

-- ── Enrollments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enrollments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('new','under_review','docs_pending','docs_received','interview_scheduled','approved','confirmed','archived','pending','rejected')),
  origin                 TEXT NOT NULL DEFAULT 'website'
                         CHECK (origin IN ('website','in_person','phone','referral')),
  enrollment_number      TEXT UNIQUE,
  segment                TEXT,
  tags                   TEXT[] NOT NULL DEFAULT '{}',
  internal_notes         TEXT,
  -- Guardian
  guardian_name           TEXT NOT NULL,
  guardian_cpf            TEXT NOT NULL,
  guardian_phone          TEXT NOT NULL,
  guardian_email          TEXT,
  guardian_zip_code       TEXT NOT NULL,
  guardian_street         TEXT NOT NULL,
  guardian_number         TEXT NOT NULL,
  guardian_complement     TEXT,
  guardian_neighborhood   TEXT NOT NULL,
  guardian_city           TEXT NOT NULL,
  guardian_state          TEXT NOT NULL,
  -- Student
  student_name            TEXT NOT NULL,
  student_birth_date      DATE NOT NULL,
  student_cpf             TEXT,
  student_zip_code        TEXT NOT NULL,
  student_street          TEXT NOT NULL,
  student_number          TEXT NOT NULL,
  student_complement      TEXT,
  student_neighborhood    TEXT NOT NULL,
  student_city            TEXT NOT NULL,
  student_state           TEXT NOT NULL,
  -- Parents
  father_name             TEXT NOT NULL,
  father_cpf              TEXT NOT NULL,
  father_phone            TEXT NOT NULL DEFAULT '',
  father_email            TEXT,
  mother_name             TEXT NOT NULL,
  mother_cpf              TEXT NOT NULL,
  mother_phone            TEXT NOT NULL DEFAULT '',
  mother_email            TEXT,
  -- School history
  first_school            BOOLEAN NOT NULL DEFAULT FALSE,
  last_grade              TEXT,
  previous_school_name    TEXT,
  -- Admin
  reviewed_by             UUID REFERENCES profiles(id),
  reviewed_at             TIMESTAMPTZ,
  confirmed_at            TIMESTAMPTZ,
  archived_at             TIMESTAMPTZ,
  archive_reason          TEXT,
  docs_checklist          JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_enrollment" ON enrollments FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_read_enrollments"  ON enrollments FOR SELECT USING (true);
CREATE POLICY "auth_update_enrollment" ON enrollments FOR UPDATE USING (true) WITH CHECK (true);

-- ── Enrollment Documents ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enrollment_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  file_name     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enrollment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_enrollment_document" ON enrollment_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_read_enrollment_documents"  ON enrollment_documents FOR SELECT USING (true);

-- ── Enrollment History ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enrollment_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  event_type    TEXT NOT NULL,
  description   TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_history_enrollment ON enrollment_history(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_created    ON enrollment_history(created_at);

ALTER TABLE enrollment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on enrollment_history" ON enrollment_history FOR ALL USING (true) WITH CHECK (true);

-- ── Visit Appointments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS visit_appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name      TEXT NOT NULL,
  visitor_phone     TEXT NOT NULL,
  visitor_email     TEXT,
  visit_reason      TEXT NOT NULL,
  companions        JSONB NOT NULL DEFAULT '[]',
  appointment_date  DATE NOT NULL,
  appointment_time  TIME NOT NULL,
  duration_minutes  INT NOT NULL DEFAULT 60,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  notes             TEXT,
  internal_notes    TEXT,
  origin            TEXT NOT NULL DEFAULT 'website'
                    CHECK (origin IN ('website','internal')),
  contact_request_id UUID,
  enrollment_id      UUID REFERENCES enrollments(id),
  confirmed_by       UUID REFERENCES profiles(id),
  confirmed_at       TIMESTAMPTZ,
  cancelled_by       UUID REFERENCES profiles(id),
  cancelled_at       TIMESTAMPTZ,
  cancel_reason      TEXT,
  reminder_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  confirmation_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visit_appointments_date_idx   ON visit_appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS visit_appointments_status_idx ON visit_appointments(status);
CREATE INDEX IF NOT EXISTS idx_visit_appointments_enrollment ON visit_appointments(enrollment_id) WHERE enrollment_id IS NOT NULL;

ALTER TABLE visit_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_appointment_slots" ON visit_appointments FOR SELECT USING (true);
CREATE POLICY "visitors_insert_appointments"  ON visit_appointments FOR INSERT WITH CHECK (status = 'pending');
CREATE POLICY "visitors_update_own_pending_appointments" ON visit_appointments FOR UPDATE
  USING (status IN ('pending','confirmed')) WITH CHECK (status IN ('pending','confirmed'));

-- ── Appointment History ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES visit_appointments(id),
  event_type     TEXT NOT NULL,
  description    TEXT NOT NULL,
  old_value      TEXT,
  new_value      TEXT,
  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_history_apt ON appointment_history(appointment_id);

ALTER TABLE appointment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on appointment_history" ON appointment_history FOR ALL USING (true) WITH CHECK (true);

-- ── Contact Requests ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contact_requests (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status                      TEXT NOT NULL DEFAULT 'new'
                              CHECK (status IN ('new','first_contact','follow_up','resolved','archived','contacted','converted','closed')),
  name                        TEXT NOT NULL,
  phone                       TEXT NOT NULL,
  email                       TEXT,
  contact_reason              TEXT,
  contact_via                 TEXT,
  message                     TEXT,
  best_time                   TEXT CHECK (best_time IN ('morning','afternoon')),
  segment_interest            TEXT,
  student_count               TEXT,
  how_found_us                TEXT,
  wants_visit                 BOOLEAN DEFAULT FALSE,
  is_lead                     BOOLEAN NOT NULL DEFAULT FALSE,
  tags                        TEXT[] NOT NULL DEFAULT '{}',
  internal_notes              TEXT,
  next_contact_date           DATE,
  assigned_to                 UUID REFERENCES profiles(id),
  converted_to_enrollment_id  UUID REFERENCES enrollments(id),
  converted_to_appointment_id UUID REFERENCES visit_appointments(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_contact"   ON contact_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_read_contacts"    ON contact_requests FOR SELECT USING (true);
CREATE POLICY "auth_update_contact"   ON contact_requests FOR UPDATE USING (true) WITH CHECK (true);

-- ── Contact History ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contact_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES contact_requests(id),
  event_type  TEXT NOT NULL,
  description TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_history_contact ON contact_history(contact_id);

ALTER TABLE contact_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on contact_history" ON contact_history FOR ALL USING (true) WITH CHECK (true);

-- ── Consent Records ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consent_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type         TEXT NOT NULL CHECK (form_type IN ('contact','enrollment','visit','testimonial')),
  ip_address        TEXT,
  user_agent        TEXT,
  consented_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  holder_name       TEXT,
  holder_email      TEXT,
  related_record_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_form_type ON consent_records(form_type);
CREATE INDEX IF NOT EXISTS idx_consent_date      ON consent_records(consented_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_holder    ON consent_records(holder_email);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert on consent_records" ON consent_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated read on consent_records" ON consent_records FOR SELECT USING (true);

-- ── Testimonials ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS testimonials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_name   TEXT NOT NULL,
  avatar_url    TEXT,
  content       TEXT NOT NULL CHECK (char_length(content) >= 20 AND char_length(content) <= 500),
  rating        SMALLINT NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  provider      TEXT,
  social_id     TEXT,
  email         TEXT,
  student_grade TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS testimonials_status_created_at_idx ON testimonials(status, created_at DESC);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_insert_pending" ON testimonials FOR INSERT WITH CHECK (status = 'pending');
CREATE POLICY "testimonials_read_approved"  ON testimonials FOR SELECT USING (status = 'approved');

-- ── Notifications ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id      UUID NOT NULL REFERENCES profiles(id),
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT,
  link              TEXT,
  related_module    TEXT,
  related_record_id UUID,
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_insert_notifications"    ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "users_select_own_notifications"  ON notifications FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "users_update_own_notifications"  ON notifications FOR UPDATE USING (recipient_id = auth.uid());

-- ── Notification Preferences ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id),
  enabled_types  TEXT[] NOT NULL DEFAULT ARRAY['new_appointment','new_enrollment','new_contact'],
  sound_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_preferences" ON notification_preferences FOR ALL USING (user_id = auth.uid());

-- ── WhatsApp Templates ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN ('agendamento','matricula','contato','geral','boas_vindas')),
  message_type          TEXT NOT NULL CHECK (message_type IN ('text','media','buttons','list')),
  content               JSONB NOT NULL DEFAULT '{}',
  variables             TEXT[] DEFAULT '{}',
  trigger_event         TEXT CHECK (trigger_event IN ('on_create','on_status_change','on_reminder')),
  trigger_conditions    JSONB,
  trigger_delay_minutes INT DEFAULT 0,
  is_active             BOOLEAN DEFAULT TRUE,
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category  ON whatsapp_templates(category);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_is_active ON whatsapp_templates(is_active);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_manage_templates" ON whatsapp_templates FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin','admin','coordinator')));

-- ── WhatsApp Message Log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID REFERENCES whatsapp_templates(id),
  recipient_phone   TEXT NOT NULL,
  recipient_name    TEXT,
  rendered_content  JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','sent','delivered','read','failed')),
  error_message     TEXT,
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  sent_by           UUID REFERENCES profiles(id),
  related_module    TEXT,
  related_record_id UUID,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wamessage_log_status     ON whatsapp_message_log(status);
CREATE INDEX IF NOT EXISTS idx_wamessage_log_related    ON whatsapp_message_log(related_module, related_record_id);
CREATE INDEX IF NOT EXISTS idx_wamessage_log_created_at ON whatsapp_message_log(created_at DESC);

ALTER TABLE whatsapp_message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_manage_message_log" ON whatsapp_message_log FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin','admin','coordinator')));

-- ── WhatsApp Providers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  instance_url TEXT NOT NULL DEFAULT '',
  api_token    TEXT NOT NULL DEFAULT '',
  profile_id   TEXT NOT NULL DEFAULT 'uazapi',
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_whatsapp_providers" ON whatsapp_providers FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- ── Leads & Stages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_stages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  color        TEXT NOT NULL,
  position     INT NOT NULL,
  auto_actions JSONB,
  is_active    BOOLEAN DEFAULT TRUE
);

ALTER TABLE lead_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_stages" ON lead_stages FOR SELECT
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin','admin','coordinator')));

CREATE TABLE IF NOT EXISTS leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module     TEXT NOT NULL DEFAULT 'manual',
  source_record_id  UUID,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,
  stage             TEXT NOT NULL DEFAULT 'new_lead',
  priority          TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to       UUID REFERENCES profiles(id),
  segment_interest  TEXT,
  tags              TEXT[] DEFAULT '{}',
  score             INT DEFAULT 0,
  next_contact_date TIMESTAMPTZ,
  converted_at      TIMESTAMPTZ,
  lost_at           TIMESTAMPTZ,
  lost_reason       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage       ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at  ON leads(created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_manage_leads" ON leads FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin','admin','coordinator')));

CREATE TABLE IF NOT EXISTS lead_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL REFERENCES leads(id),
  type         TEXT NOT NULL,
  description  TEXT,
  from_stage   TEXT,
  to_stage     TEXT,
  performed_by UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_act_lead_id ON lead_activities(lead_id);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_manage_lead_activities" ON lead_activities FOR ALL
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin','admin','coordinator')));

-- ── School: Segments, Classes, Students ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_segments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  coordinator_ids UUID[] DEFAULT '{}',
  position        INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE school_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on school_segments" ON school_segments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator')));

CREATE TABLE IF NOT EXISTS school_classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  UUID NOT NULL REFERENCES school_segments(id),
  name        TEXT NOT NULL,
  year        INT NOT NULL DEFAULT 2026,
  shift       TEXT DEFAULT 'morning' CHECK (shift IN ('morning','afternoon','full')),
  max_students INT,
  teacher_ids UUID[] DEFAULT '{}',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_classes_segment ON school_classes(segment_id);

ALTER TABLE school_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on school_classes" ON school_classes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator')));

CREATE TABLE IF NOT EXISTS students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id),
  enrollment_number TEXT NOT NULL UNIQUE,
  enrollment_id     UUID REFERENCES enrollments(id),
  class_id          UUID REFERENCES school_classes(id),
  full_name         TEXT NOT NULL,
  birth_date        DATE,
  cpf               TEXT,
  guardian_name     TEXT NOT NULL,
  guardian_phone    TEXT NOT NULL,
  guardian_email    TEXT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','transferred','graduated','inactive')),
  enrolled_at       TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_enrollment        ON students(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_students_class             ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_enrollment_number ON students(enrollment_number);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on students" ON students FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator')));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Updated_at helpers
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END; $$;

-- Status change logging
CREATE OR REPLACE FUNCTION log_enrollment_status_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO enrollment_history (enrollment_id, event_type, description, old_value, new_value, created_by)
    VALUES (NEW.id, 'status_change',
      'Status alterado de "' || COALESCE(OLD.status, '?') || '" para "' || NEW.status || '"',
      OLD.status, NEW.status, NEW.reviewed_by);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION log_appointment_status_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO appointment_history (appointment_id, event_type, description, old_value, new_value, created_by)
    VALUES (NEW.id, 'status_change',
      'Status alterado de "' || COALESCE(OLD.status, '?') || '" para "' || NEW.status || '"',
      OLD.status, NEW.status, NEW.confirmed_by);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION log_contact_status_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO contact_history (contact_id, event_type, description, old_value, new_value)
    VALUES (NEW.id, 'status_change',
      'Status alterado de "' || COALESCE(OLD.status, '?') || '" para "' || NEW.status || '"',
      OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END; $$;

-- Internal notifications on new records
CREATE OR REPLACE FUNCTION notify_admins_on_new_record() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec RECORD;
  notif_title TEXT;
  notif_body TEXT;
  notif_type TEXT;
  notif_module TEXT;
  notif_link TEXT;
BEGIN
  IF TG_TABLE_NAME = 'visit_appointments' THEN
    notif_type   := 'new_appointment';
    notif_module := 'appointments';
    notif_title  := 'Novo agendamento de visita';
    notif_body   := 'De ' || NEW.visitor_name || ' para ' ||
                    to_char(NEW.appointment_date, 'DD/MM/YYYY') ||
                    ' às ' || to_char(NEW.appointment_time, 'HH24:MI');
    notif_link   := '/admin/agendamentos';
  ELSIF TG_TABLE_NAME = 'enrollments' THEN
    notif_type   := 'new_enrollment';
    notif_module := 'enrollments';
    notif_title  := 'Nova pré-matrícula';
    notif_body   := 'Aluno: ' || NEW.student_name || ' — Resp: ' || NEW.guardian_name;
    notif_link   := '/admin/matriculas';
  ELSIF TG_TABLE_NAME = 'contact_requests' THEN
    notif_type   := 'new_contact';
    notif_module := 'contacts';
    notif_title  := 'Novo contato recebido';
    notif_body   := 'De ' || NEW.name ||
                    CASE WHEN NEW.contact_reason IS NOT NULL
                         THEN ' — ' || NEW.contact_reason ELSE '' END;
    notif_link   := '/admin/contatos';
  END IF;

  FOR rec IN
    SELECT id FROM profiles
    WHERE role IN ('super_admin','admin','coordinator') AND is_active = true
  LOOP
    INSERT INTO notifications
      (recipient_id, type, title, body, link, related_module, related_record_id)
    VALUES
      (rec.id, notif_type, notif_title, notif_body, notif_link, notif_module, NEW.id);
  END LOOP;

  RETURN NEW;
END; $$;

-- Auto-notify trigger helper (calls Edge Function via pg_net)
CREATE OR REPLACE FUNCTION notify_auto_trigger(
  p_event TEXT, p_module TEXT, p_record_id UUID,
  p_old_status TEXT, p_new_status TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_secret TEXT;
  v_url TEXT;
  v_payload JSONB;
BEGIN
  SELECT value #>> '{}' INTO v_secret
  FROM system_settings
  WHERE category = 'internal' AND key = 'trigger_secret';

  IF v_secret IS NULL THEN
    RAISE NOTICE '[auto-notify] No trigger secret configured';
    RETURN;
  END IF;

  v_url := current_setting('app.settings.supabase_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://dinbwugbwnkrzljuocbs.supabase.co';
  END IF;

  v_payload := jsonb_build_object(
    'event', p_event,
    'module', p_module,
    'record_id', p_record_id::TEXT,
    'old_status', p_old_status,
    'new_status', p_new_status
  );

  PERFORM net.http_post(
    url := v_url || '/functions/v1/auto-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-trigger-secret', v_secret
    ),
    body := v_payload
  );
END; $$;

-- Trigger functions for auto-notify
CREATE OR REPLACE FUNCTION trg_visit_appointment_notify() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_auto_trigger('on_create', 'agendamento', NEW.id, NULL, NEW.status);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM notify_auto_trigger('on_status_change', 'agendamento', NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION trg_enrollment_notify() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_auto_trigger('on_create', 'matricula', NEW.id, NULL, NEW.status);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM notify_auto_trigger('on_status_change', 'matricula', NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION trg_contact_request_notify() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_auto_trigger('on_create', 'contato', NEW.id, NULL, NEW.status);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM notify_auto_trigger('on_status_change', 'contato', NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END; $$;

-- Visit reminders (called by pg_cron every 15 min)
CREATE OR REPLACE FUNCTION process_visit_reminders() RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reminder_hours INT;
  v_appt RECORD;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 24) INTO v_reminder_hours
  FROM system_settings
  WHERE category = 'notifications' AND key = 'reminder_hours_before';

  IF v_reminder_hours IS NULL THEN v_reminder_hours := 24; END IF;

  FOR v_appt IN
    SELECT id FROM visit_appointments
    WHERE status IN ('pending', 'confirmed')
      AND reminder_sent = false
      AND (appointment_date + appointment_time)
          BETWEEN now() AND (now() + make_interval(hours => v_reminder_hours))
  LOOP
    PERFORM notify_auto_trigger('on_reminder', 'agendamento', v_appt.id, NULL, NULL);
  END LOOP;
END; $$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_contact_requests_updated_at BEFORE UPDATE ON contact_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_whatsapp_templates_updated_at BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Status logging triggers
CREATE TRIGGER trg_enrollment_status_log AFTER UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION log_enrollment_status_change();

CREATE TRIGGER trg_appointment_status_log AFTER UPDATE ON visit_appointments
  FOR EACH ROW EXECUTE FUNCTION log_appointment_status_change();

CREATE TRIGGER trg_contact_status_log AFTER UPDATE ON contact_requests
  FOR EACH ROW EXECUTE FUNCTION log_contact_status_change();

-- Internal notification triggers (on new records)
CREATE TRIGGER trg_notify_new_appointment AFTER INSERT ON visit_appointments
  FOR EACH ROW EXECUTE FUNCTION notify_admins_on_new_record();

CREATE TRIGGER trg_notify_new_enrollment AFTER INSERT ON enrollments
  FOR EACH ROW EXECUTE FUNCTION notify_admins_on_new_record();

CREATE TRIGGER trg_notify_new_contact AFTER INSERT ON contact_requests
  FOR EACH ROW EXECUTE FUNCTION notify_admins_on_new_record();

-- Auto-notify WhatsApp triggers (via pg_net → Edge Function)
CREATE TRIGGER auto_notify_visit_appointment AFTER INSERT OR UPDATE ON visit_appointments
  FOR EACH ROW EXECUTE FUNCTION trg_visit_appointment_notify();

CREATE TRIGGER auto_notify_enrollment AFTER INSERT OR UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION trg_enrollment_notify();

CREATE TRIGGER auto_notify_contact_request AFTER INSERT OR UPDATE ON contact_requests
  FOR EACH ROW EXECUTE FUNCTION trg_contact_request_notify();

-- ============================================================================
-- pg_cron: Visit reminders every 15 minutes
-- ============================================================================
-- NOTE: Run manually via Supabase dashboard SQL editor (pg_cron requires superuser):
-- SELECT cron.schedule('visit-reminders', '*/15 * * * *', 'SELECT process_visit_reminders()');
