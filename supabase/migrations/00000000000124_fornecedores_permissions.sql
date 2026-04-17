-- Migration 124: fornecedores_permissions — Fase 14.E: Módulo de Fornecedores
-- Módulo 'fornecedores' no grupo financeiro + role_permissions.

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('fornecedores', 'Fornecedores', 'Cadastro e gestão de fornecedores integrado a NF-e e contas a pagar', 'Building2', 'financeiro', 55, TRUE, ARRAY[]::text[])
ON CONFLICT (key) DO NOTHING;

-- super_admin: acesso total
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'fornecedores', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'fornecedores', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'fornecedores', TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;
