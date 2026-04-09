-- =============================================================================
-- Modulo de Atendimentos Presenciais (F2.4)
-- =============================================================================
-- Integra-se ao F2.1 reaproveitando visit_appointments. Toda senha
-- (attendance_ticket) esta obrigatoriamente vinculada a um agendamento.
-- Walk-ins geram automaticamente um visit_appointments antes do ticket.
--
-- Escopos futuros (sem refactor estrutural):
--   * Controle granular por setor/atendente: colunas sector_key + served_by
--     permitem habilitar RLS fine-grained em F6.1.
--   * Notificacoes WhatsApp ao cliente na fila: reutiliza whatsapp-api + F3.1.
--   * BI / dashboards avancados: attendance_history guarda trilha completa.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ampliar enum de status e origin em visit_appointments
-- ---------------------------------------------------------------------------
ALTER TABLE visit_appointments DROP CONSTRAINT IF EXISTS visit_appointments_status_check;
ALTER TABLE visit_appointments
  ADD CONSTRAINT visit_appointments_status_check
  CHECK (status IN ('pending','confirmed','cancelled','completed','no_show','comparecimento'));

ALTER TABLE visit_appointments DROP CONSTRAINT IF EXISTS visit_appointments_origin_check;
ALTER TABLE visit_appointments
  ADD CONSTRAINT visit_appointments_origin_check
  CHECK (origin IN ('website','internal','in_person'));

-- RLS: permitir INSERT interno com status 'comparecimento' (walk-ins via service_role)
-- e permitir UPDATE para status 'comparecimento' (check-in de visitantes ja agendados).
DROP POLICY IF EXISTS "visitors_update_own_pending_appointments" ON visit_appointments;
CREATE POLICY "visitors_update_own_pending_appointments" ON visit_appointments FOR UPDATE
  USING (status IN ('pending','confirmed','comparecimento'))
  WITH CHECK (status IN ('pending','confirmed','comparecimento'));

-- ---------------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance_tickets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number       TEXT NOT NULL,
  sector_key          TEXT NOT NULL,
  sector_label        TEXT NOT NULL,
  appointment_id      UUID NOT NULL REFERENCES visit_appointments(id) ON DELETE CASCADE,
  visitor_name        TEXT NOT NULL,
  visitor_phone       TEXT NOT NULL,
  visitor_email       TEXT,
  status              TEXT NOT NULL DEFAULT 'waiting'
                      CHECK (status IN ('waiting','called','in_service','finished','abandoned','no_show')),
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at           TIMESTAMPTZ,
  service_started_at  TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  called_by           UUID REFERENCES profiles(id),
  served_by           UUID REFERENCES profiles(id),
  wait_seconds        INT,
  service_seconds     INT,
  checkin_lat         NUMERIC(9,6),
  checkin_lng         NUMERIC(9,6),
  checkin_distance_m  INT,
  feedback_id         UUID,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_tickets_status
  ON attendance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_attendance_tickets_issued_at
  ON attendance_tickets(issued_at);
CREATE INDEX IF NOT EXISTS idx_attendance_tickets_appointment
  ON attendance_tickets(appointment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tickets_sector
  ON attendance_tickets(sector_key);
CREATE INDEX IF NOT EXISTS idx_attendance_tickets_phone
  ON attendance_tickets(visitor_phone);

CREATE TABLE IF NOT EXISTS attendance_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES attendance_tickets(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  description  TEXT NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_history_ticket
  ON attendance_history(ticket_id);

CREATE TABLE IF NOT EXISTS attendance_feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL UNIQUE REFERENCES attendance_tickets(id) ON DELETE CASCADE,
  rating       INT,
  answers      JSONB NOT NULL DEFAULT '{}',
  comments     TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE attendance_tickets
  ADD CONSTRAINT attendance_tickets_feedback_fk
  FOREIGN KEY (feedback_id) REFERENCES attendance_feedback(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Funcao para gerar o proximo numero de senha
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_attendance_ticket_number(
  p_sector_key TEXT,
  p_format JSONB
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_prefix_mode       TEXT;
  v_custom_prefix     TEXT;
  v_digits            INT;
  v_per_sector        BOOLEAN;
  v_count             INT;
  v_prefix            TEXT;
BEGIN
  v_prefix_mode   := COALESCE(p_format ->> 'prefix_mode', 'none');
  v_custom_prefix := COALESCE(p_format ->> 'custom_prefix', '');
  v_digits        := COALESCE((p_format ->> 'digits')::INT, 3);
  v_per_sector    := COALESCE((p_format ->> 'per_sector_counter')::BOOLEAN, false);

  IF v_per_sector THEN
    SELECT COUNT(*) INTO v_count
    FROM attendance_tickets
    WHERE issued_at::date = CURRENT_DATE
      AND sector_key = p_sector_key;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM attendance_tickets
    WHERE issued_at::date = CURRENT_DATE;
  END IF;

  v_count := v_count + 1;

  IF v_prefix_mode = 'sector' THEN
    v_prefix := UPPER(LEFT(p_sector_key, 1));
  ELSIF v_prefix_mode = 'custom' THEN
    v_prefix := v_custom_prefix;
  ELSE
    v_prefix := '';
  END IF;

  RETURN v_prefix || LPAD(v_count::TEXT, v_digits, '0');
END; $$;

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

-- Log de transicoes de status em attendance_history
CREATE OR REPLACE FUNCTION log_attendance_status_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO attendance_history (ticket_id, event_type, description, old_value, new_value, created_by)
    VALUES (
      NEW.id,
      'status_change',
      'Status alterado de "' || COALESCE(OLD.status, '?') || '" para "' || NEW.status || '"',
      OLD.status,
      NEW.status,
      COALESCE(NEW.called_by, NEW.served_by)
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_attendance_status_log AFTER UPDATE ON attendance_tickets
  FOR EACH ROW EXECUTE FUNCTION log_attendance_status_change();

-- Registro inicial: evento 'issued' quando o ticket e criado
CREATE OR REPLACE FUNCTION log_attendance_issued() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO attendance_history (ticket_id, event_type, description, new_value)
  VALUES (NEW.id, 'issued', 'Senha ' || NEW.ticket_number || ' emitida para ' || NEW.sector_label, NEW.status);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_attendance_issued_log AFTER INSERT ON attendance_tickets
  FOR EACH ROW EXECUTE FUNCTION log_attendance_issued();

-- Metricas de tempo: wait_seconds + service_seconds + timestamps
CREATE OR REPLACE FUNCTION attendance_timing() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- waiting -> called
  IF OLD.status = 'waiting' AND NEW.status = 'called' AND NEW.called_at IS NULL THEN
    NEW.called_at := now();
  END IF;

  -- called -> in_service: grava service_started_at e wait_seconds
  IF OLD.status = 'called' AND NEW.status = 'in_service' THEN
    IF NEW.service_started_at IS NULL THEN
      NEW.service_started_at := now();
    END IF;
    IF NEW.wait_seconds IS NULL THEN
      NEW.wait_seconds := EXTRACT(EPOCH FROM (NEW.service_started_at - NEW.issued_at))::INT;
    END IF;
  END IF;

  -- in_service -> finished: grava finished_at e service_seconds
  IF OLD.status = 'in_service' AND NEW.status = 'finished' THEN
    IF NEW.finished_at IS NULL THEN
      NEW.finished_at := now();
    END IF;
    IF NEW.service_seconds IS NULL AND NEW.service_started_at IS NOT NULL THEN
      NEW.service_seconds := EXTRACT(EPOCH FROM (NEW.finished_at - NEW.service_started_at))::INT;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_attendance_timing BEFORE UPDATE ON attendance_tickets
  FOR EACH ROW EXECUTE FUNCTION attendance_timing();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE attendance_tickets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_feedback  ENABLE ROW LEVEL SECURITY;

-- Admin/staff acesso completo (fase inicial, conforme PRD F6.1 depois afina por setor)
CREATE POLICY "Staff full access on attendance_tickets" ON attendance_tickets
  FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin','coordinator')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin','coordinator')));

CREATE POLICY "Staff read attendance_history" ON attendance_history
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin','coordinator')));

CREATE POLICY "Staff full access on attendance_feedback" ON attendance_feedback
  FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin','coordinator')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin','coordinator')));

-- Leitura publica limitada dos tickets (apenas status/numero/setor para tela do cliente).
-- A pagina publica lera o proprio ticket pelo id + valores minimos para o painel
-- "ultima senha chamada". Nao expoe dados pessoais.
CREATE POLICY "public_read_attendance_tickets" ON attendance_tickets
  FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- 6. Realtime publication
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'attendance_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_tickets;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Seeds de system_settings (categoria 'attendance' + geolocation)
-- ---------------------------------------------------------------------------
INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'eligibility_rules',
   '{"mode":"same_day","past_days_limit":7}'::jsonb,
   'Regras de elegibilidade para check-in no modulo de atendimentos')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'allow_walkins',
   '{"enabled":false}'::jsonb,
   'Permite que visitantes sem agendamento previo gerem senha')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'ticket_format',
   '{"prefix_mode":"custom","custom_prefix":"A","digits":3,"per_sector_counter":false}'::jsonb,
   'Formato da numeracao das senhas')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'estimated_service_time',
   '{}'::jsonb,
   'Tempo estimado de atendimento por setor (chave = sector_key, valor em minutos)')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'sound',
   '{"enabled":true,"preset":"bell"}'::jsonb,
   'Som de notificacao na tela do cliente quando a senha for chamada')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'client_screen_fields',
   '{"show_last_called":true,"show_sector":true,"show_wait_estimate":true,"show_instructions":true,"instructions_text":"Aguarde ser chamado. Fique atento a tela e ao som de notificacao."}'::jsonb,
   'Campos exibidos na tela do cliente apos a emissao da senha')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'feedback',
   '{"enabled":true,"scale":"stars","max":5,"allow_comments":true,"questions":[]}'::jsonb,
   'Configuracao do formulario de feedback pos-atendimento')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO system_settings (category, key, value, description) VALUES
  ('general', 'geolocation',
   '{"latitude":null,"longitude":null,"radius_m":150}'::jsonb,
   'Coordenadas da instituicao e raio permitido para check-in presencial')
ON CONFLICT (category, key) DO NOTHING;

-- Permitir leitura anonima das settings de atendimento necessarias a pagina publica
-- (Opcional: a categoria 'attendance' sera lida via edge function attendance-public-config.
-- Mantemos a RLS restrita para evitar vazar configuracoes internas.)

-- ---------------------------------------------------------------------------
-- 8. Atualizar policy 'Anon can read public settings' para incluir 'attendance'
--    apenas das chaves publicas + geolocation em 'general'
-- ---------------------------------------------------------------------------
-- Categoria 'general' ja esta na policy existente. 'attendance' ficara
-- acessivel apenas via edge function para nao expor perguntas de feedback.
