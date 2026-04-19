-- 215: Fase 16 PR5 — Grants para importação em massa de colaboradores RH.
--
-- Garante que admin e super_admin possam CRIAR em `rh-colaboradores` (can_create=true)
-- em `role_permissions`. Migrations anteriores podem ter ficado com can_create=false
-- por default de seed; esta migration é idempotente e apenas normaliza o grant.
--
-- A tabela `staff` já existe (migration 186). O módulo `rh-colaboradores` está
-- registrado em `modules` (migration 185). Esta migration não cria colunas novas.

UPDATE role_permissions
   SET can_create = true
 WHERE role IN ('admin', 'super_admin')
   AND module_key = 'rh-colaboradores';

-- Log de auditoria da migration, se a tabela existir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'migration_log') THEN
    INSERT INTO migration_log (name, description)
    VALUES (
      '00000000000215_bulk_import_staff_grants',
      'Fase 16 PR5: garante can_create=true em rh-colaboradores para admin/super_admin (pré-requisito da importação em massa da tabela staff).'
    )
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;
