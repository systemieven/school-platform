-- Migration 76: Permissoes para Portal do Responsavel (Fase 10)
-- Adiciona modulos na tabela modules e grants em role_permissions.

-- ── Modulos do Portal do Responsavel ────────────────────────────────────────
INSERT INTO modules (module_key, label, description, is_active, position)
VALUES
  ('guardian-portal',      'Portal do Responsavel',    'Acesso e gestao do portal do responsavel', true, 40),
  ('occurrences',          'Ocorrencias',              'Bilhetes e ocorrencias de alunos',          true, 41),
  ('activity-auth',        'Autorizacoes de Atividade','Autorizacoes de atividades e passeios',     true, 42)
ON CONFLICT (module_key) DO NOTHING;

-- ── Permissoes por role ───────────────────────────────────────────────────────
-- super_admin e admin: CRUD completo em tudo
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete)
VALUES
  -- guardian-portal
  ('super_admin',  'guardian-portal', true, true, true, true),
  ('admin',        'guardian-portal', true, true, true, true),
  ('coordinator',  'guardian-portal', true, false, false, false),
  -- occurrences
  ('super_admin',  'occurrences', true, true, true, true),
  ('admin',        'occurrences', true, true, true, true),
  ('coordinator',  'occurrences', true, true, true, false),
  ('teacher',      'occurrences', true, true, true, false),
  -- activity-auth
  ('super_admin',  'activity-auth', true, true, true, true),
  ('admin',        'activity-auth', true, true, true, true),
  ('coordinator',  'activity-auth', true, true, false, false)
ON CONFLICT (role, module_key) DO NOTHING;
