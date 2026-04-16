-- Modules for phase 11.B
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('absence-communications', 'Comunicação de Faltas', 'Fila de comunicações de falta do responsável — análise e vínculo ao diário', 'MessageSquareDot', 'secretaria', 64, TRUE, ARRAY[]::TEXT[]),
  ('exit-authorizations',    'Autorizações de Saída', 'Fila de autorizações excepcionais de saída com confirmação de senha',         'DoorOpen',         'secretaria', 65, TRUE, ARRAY[]::TEXT[]),
  ('portaria',               'Portaria',              'Módulo de portaria — frequência e confirmação de retiradas autorizadas',       'ShieldCheck',      'secretaria', 66, TRUE, ARRAY[]::TEXT[])
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'absence-communications', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'absence-communications', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'absence-communications', TRUE, FALSE, TRUE, FALSE, FALSE),
  ('super_admin', 'exit-authorizations',    TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'exit-authorizations',    TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'exit-authorizations',    TRUE, FALSE, TRUE, FALSE, FALSE),
  ('super_admin', 'portaria',               TRUE, FALSE, TRUE, FALSE, FALSE),
  ('admin',       'portaria',               TRUE, FALSE, TRUE, FALSE, FALSE),
  ('coordinator', 'portaria',               TRUE, FALSE, TRUE, FALSE, FALSE),
  ('user',        'portaria',               FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- WhatsApp category
INSERT INTO whatsapp_categories (key, label, color, is_active)
VALUES ('portaria', 'Portaria', '#1e40af', true)
ON CONFLICT (key) DO NOTHING;
