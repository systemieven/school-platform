-- Migration 039: Notification trigger for new testimonials
-- Reuses the existing notify_admins_on_new_record() function by adding
-- a ELSIF branch for testimonials and creating the trigger.

CREATE OR REPLACE FUNCTION notify_admins_on_new_record() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec RECORD;
  notif_title TEXT;
  notif_body  TEXT;
  notif_type  TEXT;
  notif_module TEXT;
  notif_link  TEXT;
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
  ELSIF TG_TABLE_NAME = 'testimonials' THEN
    notif_type   := 'new_testimonial';
    notif_module := 'testimonials';
    notif_title  := 'Novo depoimento pendente';
    notif_body   := 'De ' || NEW.parent_name ||
                    CASE WHEN NEW.rating IS NOT NULL
                         THEN ' — ' || NEW.rating || '★' ELSE '' END;
    notif_link   := '/admin/depoimentos';
  END IF;

  FOR rec IN
    SELECT id FROM profiles
    WHERE role IN ('super_admin', 'admin', 'coordinator') AND is_active = true
  LOOP
    INSERT INTO notifications
      (recipient_id, type, title, body, link, related_module, related_record_id)
    VALUES
      (rec.id, notif_type, notif_title, notif_body, notif_link, notif_module, NEW.id);
  END LOOP;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_new_testimonial
  AFTER INSERT ON testimonials
  FOR EACH ROW EXECUTE FUNCTION notify_admins_on_new_record();
