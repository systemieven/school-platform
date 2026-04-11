-- ============================================================
-- Módulo de permissão: Histórico de Atendimentos
-- ============================================================

-- 1. Módulo na tabela de permissões
INSERT INTO modules (key, label, description, icon, "group", position) VALUES
  ('attendance_history', 'Histórico de Atendimentos',
   'Consulta de atendimentos realizados pelo próprio usuário',
   'History', 'gestao', 6)
ON CONFLICT (key) DO NOTHING;

-- 2. Reordenar módulos posteriores para abrir espaço
UPDATE modules SET position = position + 1
WHERE "group" IN ('qualificacao','escola','sistema')
  AND position >= 6
  AND key != 'attendance_history';

-- 3. Permissões padrão por cargo (apenas can_view relevante)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('admin',       'attendance_history', true,  false, false, false),
  ('coordinator', 'attendance_history', true,  false, false, false),
  ('teacher',     'attendance_history', false, false, false, false),
  ('user',        'attendance_history', false, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;
