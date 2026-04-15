-- Migration 86: Permissoes Secretaria Digital (Fase 11)

INSERT INTO modules (module_key, label, description, is_active, position)
VALUES
  ('secretaria-declaracoes', 'Declaracoes',     'Templates e solicitacoes de declaracao', true, 60),
  ('secretaria-saude',       'Fichas de Saude', 'Fichas de saude dos alunos',             true, 61),
  ('secretaria-rematricula', 'Rematricula',     'Campanhas e processos de rematricula',   true, 62),
  ('secretaria-transferencias','Transferencias','Transferencias e movimentacoes',          true, 63)
ON CONFLICT (module_key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete)
VALUES
  -- declaracoes
  ('super_admin',  'secretaria-declaracoes', true, true, true, true),
  ('admin',        'secretaria-declaracoes', true, true, true, true),
  ('coordinator',  'secretaria-declaracoes', true, true, false, false),
  -- saude
  ('super_admin',  'secretaria-saude', true, true, true, true),
  ('admin',        'secretaria-saude', true, true, true, true),
  ('coordinator',  'secretaria-saude', true, true, true, false),
  -- rematricula
  ('super_admin',  'secretaria-rematricula', true, true, true, true),
  ('admin',        'secretaria-rematricula', true, true, true, true),
  ('coordinator',  'secretaria-rematricula', true, false, false, false),
  -- transferencias
  ('super_admin',  'secretaria-transferencias', true, true, true, true),
  ('admin',        'secretaria-transferencias', true, true, true, true),
  ('coordinator',  'secretaria-transferencias', true, true, false, false)
ON CONFLICT (role, module_key) DO NOTHING;

-- WhatsApp category: secretaria
INSERT INTO whatsapp_categories (key, label, color, is_active)
VALUES ('secretaria', 'Secretaria', '#374151', true)
ON CONFLICT (key) DO NOTHING;
