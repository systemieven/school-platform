-- 185: Fase 16 PR1 — Seed dos módulos de RH (colaboradores + processo seletivo)
--
-- Cria dois módulos granulares para isolar dados sensíveis de RH:
--   • rh-colaboradores — cadastro de colaboradores (staff)
--   • rh-seletivo      — vagas e candidatos (processo seletivo)
--
-- Defaults:
--   super_admin — não é gerenciado aqui (hard-coded em get_effective_permissions)
--   admin       — all true em ambos
--   coordinator — colaboradores view/edit, seletivo só view
--   teacher/user — tudo false
--
-- Segue o padrão da migration 26 (granular permissions).

INSERT INTO modules (key, label, description, icon, "group", position) VALUES
  ('rh-colaboradores', 'Colaboradores',     'Cadastro de colaboradores e documentos',  'Users',    'rh', 300),
  ('rh-seletivo',      'Processo Seletivo', 'Vagas, candidatos e pipeline de contratação', 'Briefcase', 'rh', 301)
ON CONFLICT (key) DO NOTHING;

-- admin: all true
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('admin', 'rh-colaboradores', true, true, true, true),
  ('admin', 'rh-seletivo',      true, true, true, true)
ON CONFLICT (role, module_key) DO NOTHING;

-- coordinator: colaboradores view/edit (sem create/delete), seletivo só view
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('coordinator', 'rh-colaboradores', true, false, true, false),
  ('coordinator', 'rh-seletivo',      true, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;

-- teacher: nada
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('teacher', 'rh-colaboradores', false, false, false, false),
  ('teacher', 'rh-seletivo',      false, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;

-- user: nada (liberado via overrides se precisar)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('user', 'rh-colaboradores', false, false, false, false),
  ('user', 'rh-seletivo',      false, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;
