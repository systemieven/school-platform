-- Migration 113: fiscal_permissions — Fase 16: Estrutura Fiscal
-- Módulos e permissões de acesso para as telas fiscais (store-fiscal e store-fiscal-config).
-- Segue o mesmo padrão de migration 97 (store_permissions).

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('store-fiscal',        'Dados Fiscais',  'Dados fiscais por produto (NCM, CST, alíquotas)', 'Receipt',  'loja', 78, TRUE, ARRAY['store-products']),
  ('store-fiscal-config', 'Config Fiscal',  'Configurações fiscais da empresa e emitente NF-e', 'FileText', 'loja', 79, TRUE, ARRAY[]::text[])
ON CONFLICT (key) DO NOTHING;

-- super_admin: acesso total
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'store-fiscal',        TRUE, TRUE, TRUE, TRUE, FALSE),
  ('super_admin', 'store-fiscal-config', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'store-fiscal',        TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'store-fiscal-config', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'store-fiscal',        TRUE, FALSE, TRUE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;
