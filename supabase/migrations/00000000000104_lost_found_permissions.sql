-- Migration 104: lost_found_permissions — Fase 15: Achados e Perdidos Digital

-- Module
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('lost-found', 'Achados e Perdidos', 'Gestão de itens achados e perdidos', 'PackageSearch', 'secretaria', 55, TRUE, 'students')
ON CONFLICT (key) DO NOTHING;

-- super_admin: view+create+edit+delete (no import)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'lost-found', TRUE, TRUE, TRUE, TRUE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- admin: view+create+edit+delete (no import)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('admin', 'lost-found', TRUE, TRUE, TRUE, TRUE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- coordinator: view+create+edit (no delete, no import)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('coordinator', 'lost-found', TRUE, TRUE, TRUE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- user: view+create only
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('user', 'lost-found', TRUE, TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;
