-- ============================================================================
-- 00000000000146_cleanup_mirror_and_phantom_overrides.sql
--
-- Limpa lixo acumulado em `user_permission_overrides` pelo bug de save do
-- EditUserDrawer (UsersPage.tsx), que fazia delete+insert de todos os módulos
-- a cada edição usando como "estado inicial" os defaults do role. Resultado:
--
--   1) Overrides "mirror": idênticos a role_permissions daquele role → ruído.
--   2) Overrides "fantasma": usuários teacher/user/student com grants em
--      módulos admin-only, herdados de quando foram editados com role
--      admin/coordinator antes do downgrade para teacher/user.
--
-- Fix: remove ambos. Admins que realmente queriam um grant cross-role devem
-- recriar via UI corrigida (que só persiste o diff vs o role default).
--
-- A UI nova (UsersPage.tsx pós-migration) NUNCA mais grava mirror, então
-- esta limpeza é one-shot.
-- ============================================================================

-- 1) Mirror overrides
WITH mirror AS (
  SELECT upo.user_id, upo.module_key
  FROM user_permission_overrides upo
  JOIN profiles p ON p.id = upo.user_id
  JOIN role_permissions rp
    ON rp.role = p.role AND rp.module_key = upo.module_key
  WHERE upo.is_deny = false
    AND upo.can_view   = rp.can_view
    AND upo.can_create = rp.can_create
    AND upo.can_edit   = rp.can_edit
    AND upo.can_delete = rp.can_delete
    AND COALESCE(upo.can_import, false) = COALESCE(rp.can_import, false)
)
DELETE FROM user_permission_overrides upo
USING mirror m
WHERE upo.user_id = m.user_id AND upo.module_key = m.module_key;

-- 2) Phantom grants em módulos admin-only para roles não-admin
DELETE FROM user_permission_overrides upo
USING profiles p
WHERE upo.user_id = p.id
  AND p.role IN ('teacher','user','student')
  AND upo.is_deny = false
  AND upo.module_key IN (
    'financial','audit','users','permissions','settings',
    'fornecedores','nfse-emitidas','store-orders','store-products',
    'financial-plans','financial-contracts','financial-installments',
    'financial-receivables','financial-payables','financial-cashflow',
    'financial-reports','financial-settings','financial-dashboard',
    'contacts','enrollments','appointments','attendance','segments',
    'kanban','reports','testimonials','secretaria-declaracoes'
  );

-- 3) Audit
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'permissions',
    'Aplicada migration 146 (limpeza de mirror/phantom overrides causados pelo bug de save do UsersPage pré-fix)',
    jsonb_build_object('migration', '00000000000146_cleanup_mirror_and_phantom_overrides')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
