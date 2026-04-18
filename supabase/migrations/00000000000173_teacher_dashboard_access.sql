-- ============================================================================
-- 00000000000173_teacher_dashboard_access.sql
--
-- Libera o módulo `dashboard` para o role `teacher` no seed. Antes desta
-- migration, teacher tinha `dashboard.can_view=false` (default herdado da
-- migration 26), então caía no redirect do `<ModuleGuard>` assim que
-- tentava abrir `/admin` — mesmo que tivesse permissão em submódulos
-- (teacher-diary, teacher-exams, occurrences).
--
-- A nova página `/admin/dashboard` é dirigida por registry e só exibe
-- widgets dos módulos que o usuário pode ver; tenancy de students /
-- class_diary_entries (migration 145) continua aplicada — teacher não
-- passa a enxergar dados cross-turma.
-- ============================================================================

INSERT INTO role_permissions
  (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('teacher', 'dashboard', TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = TRUE;

-- Audit
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'permissions',
    'Aplicada migration 173 (teacher.dashboard.can_view=true; dashboard registry-driven filtra por widget)',
    jsonb_build_object('migration', '00000000000173_teacher_dashboard_access')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
