-- ============================================================================
-- 00000000000149_audit_logs_rls_granular.sql
--
-- Migration 27 criou `audit_logs_select_admin` com checagem hardcoded
-- `profiles.role IN ('super_admin','admin')`, ignorando role_permissions e
-- user_permission_overrides. Consequência: conceder `audit:view` a um
-- coordenador/teacher/user pela UI não libera a leitura — a página abre mas
-- a consulta volta vazia.
--
-- Fix: trocar pela função `has_module_permission` (migration 144) que
-- consolida role_permissions + overrides + bypass de super_admin.
-- ============================================================================

DROP POLICY IF EXISTS "audit_logs_select_admin" ON audit_logs;

CREATE POLICY "audit_logs_select_granular"
  ON audit_logs FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'audit', 'view'));

-- Audit
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'permissions',
    'Aplicada migration 149 (audit_logs SELECT via has_module_permission)',
    jsonb_build_object('migration', '00000000000149_audit_logs_rls_granular')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
