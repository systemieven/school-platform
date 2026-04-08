-- Tabela de categorias de templates WhatsApp (dinâmicas)
CREATE TABLE whatsapp_template_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  label      text NOT NULL,
  color      text NOT NULL DEFAULT 'gray',
  variables  text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_template_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read categories"
  ON whatsapp_template_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage categories"
  ON whatsapp_template_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- Seed categorias padrão
INSERT INTO whatsapp_template_categories (slug, label, color, variables, sort_order) VALUES
  ('agendamento', 'Agendamento',   'blue',   ARRAY['visitor_name','visitor_phone','appointment_date','appointment_time','visit_reason','companions_count'], 1),
  ('matricula',   'Pré-Matrícula', 'purple', ARRAY['guardian_name','student_name','enrollment_status','enrollment_number','pending_docs'], 2),
  ('contato',     'Contato',       'green',  ARRAY['contact_name','contact_phone','contact_reason','contact_status'], 3),
  ('geral',       'Geral',         'gray',   ARRAY['school_name','school_phone','school_address','current_date'], 4),
  ('boas_vindas', 'Boas-vindas',   'yellow', ARRAY['school_name','user_name','system_url','current_date'], 5),
  ('2fa',         'Senhas',        'red',    ARRAY['user_name','school_name','temp_password','system_url'], 6);

-- Remove o check constraint hardcoded de categoria
ALTER TABLE whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_category_check;
