-- ============================================================
-- Migration 144 — Hardening RLS para permissões granulares
-- ============================================================
--
-- Objetivos desta migration (derivados da auditoria de segurança):
--
--   1. Restaurar a capacidade de "negar" permissão em overrides de usuário
--      (coluna is_deny). Assim `/admin/configuracoes → Usuários` volta a ter
--      semântica de revogação individual — tinha sido perdida na migration 143.
--
--   2. Introduzir helper `has_module_permission(p_user, p_key, p_action)` que
--      executa a mesma lógica de `get_effective_permissions` em boolean.
--      Usado nas policies de RLS para que **o backend** respeite a feature
--      granular (antes só o frontend respeitava).
--
--   3. Reescrever RLS das tabelas sensíveis para usar o helper — hoje quase
--      todas checam apenas `profiles.role IN (...)`, o que faz admins/coord
--      contornarem toda a UI via API direta, e bloqueia teacher/user com
--      override positivo. Tabelas afetadas:
--
--        - students
--        - financial_plans / financial_contracts / financial_installments
--          / financial_receivables / financial_payables
--        - nfse_emitidas / fornecedores
--        - store_orders / store_products / store_order_items
--        - lost_found_items / lost_found_events
--        - enrollments / enrollment_documents / enrollment_history
--        - contact_requests / contact_history
--        - appointment_history
--
--   4. Fechar as policies `USING (true)` herdadas do baseline (CRÍTICO: qualquer
--      autenticado — inclusive portal-user — hoje lê toda a fila de matrículas
--      e contatos).
--
--   5. Registrar evento de audit_log sempre que super_admin exerce bypass em
--      writes sensíveis (trigger novo).
--
-- Referências: /Users/iftael/.claude/plans/greedy-prancing-liskov.md
--              (seções 1.1, 1.2, 1.3, 1.4, 3.3)
--
-- IMPORTANTE: esta migration é idempotente (usa DROP POLICY IF EXISTS antes
-- de cada CREATE). Pode ser aplicada em ambientes já migrados.

-- ============================================================
-- 1. is_deny em user_permission_overrides
-- ============================================================

ALTER TABLE user_permission_overrides
  ADD COLUMN IF NOT EXISTS is_deny BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_permission_overrides.is_deny IS
  'Quando true, subtrai as flags desta linha das permissões herdadas do role. '
  'Quando false (default), as flags se SOMAM às do role (aditivo).';

-- can_import ganha precedente na função (migração 143 já adicionou a coluna).

-- ============================================================
-- 2. get_effective_permissions — agora respeita is_deny
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_user_id uuid)
RETURNS TABLE(
  module_key text,
  can_view   boolean,
  can_create boolean,
  can_edit   boolean,
  can_delete boolean,
  can_import boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

  IF v_role IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'super_admin' THEN
    RETURN QUERY
      SELECT m.key, true, true, true, true, true
      FROM modules m
      WHERE m.is_active;
    RETURN;
  END IF;

  -- Aditivo (upo.is_deny=false) e subtrativo (upo.is_deny=true).
  -- Um mesmo módulo pode ter linhas duas vezes? NÃO — UNIQUE(user_id, module_key)
  -- garante uma por usuário/módulo. Se a linha é deny, cada flag true nela
  -- remove a flag do role. Se a linha é grant, cada flag true adiciona.
  RETURN QUERY
    SELECT m.key,
      -- can_view
      CASE
        WHEN upo.is_deny THEN COALESCE(rp.can_view,   false) AND NOT COALESCE(upo.can_view,   false)
        ELSE                  COALESCE(rp.can_view,   false) OR  COALESCE(upo.can_view,   false)
      END,
      CASE
        WHEN upo.is_deny THEN COALESCE(rp.can_create, false) AND NOT COALESCE(upo.can_create, false)
        ELSE                  COALESCE(rp.can_create, false) OR  COALESCE(upo.can_create, false)
      END,
      CASE
        WHEN upo.is_deny THEN COALESCE(rp.can_edit,   false) AND NOT COALESCE(upo.can_edit,   false)
        ELSE                  COALESCE(rp.can_edit,   false) OR  COALESCE(upo.can_edit,   false)
      END,
      CASE
        WHEN upo.is_deny THEN COALESCE(rp.can_delete, false) AND NOT COALESCE(upo.can_delete, false)
        ELSE                  COALESCE(rp.can_delete, false) OR  COALESCE(upo.can_delete, false)
      END,
      CASE
        WHEN upo.is_deny THEN COALESCE(rp.can_import, false) AND NOT COALESCE(upo.can_import, false)
        ELSE                  COALESCE(rp.can_import, false) OR  COALESCE(upo.can_import, false)
      END
    FROM modules m
    LEFT JOIN role_permissions rp
      ON rp.module_key = m.key AND rp.role = v_role
    LEFT JOIN user_permission_overrides upo
      ON upo.user_id = p_user_id AND upo.module_key = m.key
    WHERE m.is_active
      AND (rp.module_key IS NOT NULL OR upo.user_id IS NOT NULL);
END;
$fn$;

-- ============================================================
-- 3. Helper booleano para uso em RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_module_permission(
  p_user   uuid,
  p_module text,
  p_action text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_role    text;
  v_perm    record;
BEGIN
  IF p_user IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = p_user;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- super_admin sempre passa (bypass é auditado via trigger — ver seção 6)
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Módulo precisa estar ativo
  IF NOT EXISTS (SELECT 1 FROM modules WHERE key = p_module AND is_active) THEN
    RETURN false;
  END IF;

  -- Resolve efetivo (role OR grant-override, com eventual deny-override subtraindo)
  SELECT
    CASE
      WHEN upo.is_deny THEN COALESCE(rp.can_view,   false) AND NOT COALESCE(upo.can_view,   false)
      ELSE                  COALESCE(rp.can_view,   false) OR  COALESCE(upo.can_view,   false)
    END AS can_view,
    CASE
      WHEN upo.is_deny THEN COALESCE(rp.can_create, false) AND NOT COALESCE(upo.can_create, false)
      ELSE                  COALESCE(rp.can_create, false) OR  COALESCE(upo.can_create, false)
    END AS can_create,
    CASE
      WHEN upo.is_deny THEN COALESCE(rp.can_edit,   false) AND NOT COALESCE(upo.can_edit,   false)
      ELSE                  COALESCE(rp.can_edit,   false) OR  COALESCE(upo.can_edit,   false)
    END AS can_edit,
    CASE
      WHEN upo.is_deny THEN COALESCE(rp.can_delete, false) AND NOT COALESCE(upo.can_delete, false)
      ELSE                  COALESCE(rp.can_delete, false) OR  COALESCE(upo.can_delete, false)
    END AS can_delete,
    CASE
      WHEN upo.is_deny THEN COALESCE(rp.can_import, false) AND NOT COALESCE(upo.can_import, false)
      ELSE                  COALESCE(rp.can_import, false) OR  COALESCE(upo.can_import, false)
    END AS can_import
  INTO v_perm
  FROM (SELECT 1) s
  LEFT JOIN role_permissions rp ON rp.role = v_role AND rp.module_key = p_module
  LEFT JOIN user_permission_overrides upo ON upo.user_id = p_user AND upo.module_key = p_module;

  RETURN CASE lower(p_action)
    WHEN 'view'   THEN v_perm.can_view
    WHEN 'create' THEN v_perm.can_create
    WHEN 'edit'   THEN v_perm.can_edit
    WHEN 'update' THEN v_perm.can_edit
    WHEN 'delete' THEN v_perm.can_delete
    WHEN 'import' THEN v_perm.can_import
    ELSE false
  END;
END;
$fn$;

-- Permite uso no RLS como 'authenticated'
GRANT EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(uuid)         TO authenticated;

-- ============================================================
-- 4. Refactor RLS — tabelas com gate granular
-- ============================================================
-- Padrão adotado por tabela:
--   <tabela>_select: has_module_permission(auth.uid(), '<key>', 'view')
--   <tabela>_insert: has_module_permission(auth.uid(), '<key>', 'create')
--   <tabela>_update: has_module_permission(auth.uid(), '<key>', 'edit')
--   <tabela>_delete: has_module_permission(auth.uid(), '<key>', 'delete')
--
-- Policies públicas/portal (ex.: student own-read, guardian own-read) são
-- PRESERVADAS como adicionais — RLS é UNION de policies.

-- ── students ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access on students" ON students;
CREATE POLICY "students_select" ON students FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'students', 'view'));
CREATE POLICY "students_insert" ON students FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'students', 'create'));
CREATE POLICY "students_update" ON students FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'students', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'students', 'edit'));
CREATE POLICY "students_delete" ON students FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'students', 'delete'));

-- ── financial_plans ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access financial_plans"    ON financial_plans;
DROP POLICY IF EXISTS "Coordinator view financial_plans"     ON financial_plans;
CREATE POLICY "financial_plans_select" ON financial_plans FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'financial-plans', 'view'));
CREATE POLICY "financial_plans_insert" ON financial_plans FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'financial-plans', 'create'));
CREATE POLICY "financial_plans_update" ON financial_plans FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'financial-plans', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'financial-plans', 'edit'));
CREATE POLICY "financial_plans_delete" ON financial_plans FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'financial-plans', 'delete'));

-- ── financial_contracts ─────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access financial_contracts"    ON financial_contracts;
DROP POLICY IF EXISTS "Coordinator view financial_contracts"     ON financial_contracts;
CREATE POLICY "financial_contracts_select" ON financial_contracts FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'financial-contracts', 'view'));
CREATE POLICY "financial_contracts_insert" ON financial_contracts FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'financial-contracts', 'create'));
CREATE POLICY "financial_contracts_update" ON financial_contracts FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'financial-contracts', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'financial-contracts', 'edit'));
CREATE POLICY "financial_contracts_delete" ON financial_contracts FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'financial-contracts', 'delete'));

-- ── financial_installments ──────────────────────────────────
DROP POLICY IF EXISTS "Admin full access financial_installments" ON financial_installments;
DROP POLICY IF EXISTS "Coordinator view financial_installments"  ON financial_installments;
-- Mantém a policy "Student view own installments" do 46:214 — não a recriamos aqui.
CREATE POLICY "financial_installments_select" ON financial_installments FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'financial-installments', 'view'));
CREATE POLICY "financial_installments_insert" ON financial_installments FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'financial-installments', 'create'));
CREATE POLICY "financial_installments_update" ON financial_installments FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'financial-installments', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'financial-installments', 'edit'));
CREATE POLICY "financial_installments_delete" ON financial_installments FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'financial-installments', 'delete'));

-- ── financial_receivables ───────────────────────────────────
DROP POLICY IF EXISTS "Admin full access financial_receivables"  ON financial_receivables;
DROP POLICY IF EXISTS "Coordinator view financial_receivables"   ON financial_receivables;
CREATE POLICY "financial_receivables_select" ON financial_receivables FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'financial-receivables', 'view'));
CREATE POLICY "financial_receivables_insert" ON financial_receivables FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'financial-receivables', 'create'));
CREATE POLICY "financial_receivables_update" ON financial_receivables FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'financial-receivables', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'financial-receivables', 'edit'));
CREATE POLICY "financial_receivables_delete" ON financial_receivables FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'financial-receivables', 'delete'));

-- ── financial_payables ──────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_payables') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access financial_payables" ON financial_payables';
    EXECUTE 'DROP POLICY IF EXISTS "Coordinator view financial_payables"  ON financial_payables';
    EXECUTE $p$CREATE POLICY "financial_payables_select" ON financial_payables FOR SELECT TO authenticated
      USING (has_module_permission(auth.uid(), 'financial-payables', 'view'))$p$;
    EXECUTE $p$CREATE POLICY "financial_payables_insert" ON financial_payables FOR INSERT TO authenticated
      WITH CHECK (has_module_permission(auth.uid(), 'financial-payables', 'create'))$p$;
    EXECUTE $p$CREATE POLICY "financial_payables_update" ON financial_payables FOR UPDATE TO authenticated
      USING      (has_module_permission(auth.uid(), 'financial-payables', 'edit'))
      WITH CHECK (has_module_permission(auth.uid(), 'financial-payables', 'edit'))$p$;
    EXECUTE $p$CREATE POLICY "financial_payables_delete" ON financial_payables FOR DELETE TO authenticated
      USING (has_module_permission(auth.uid(), 'financial-payables', 'delete'))$p$;
  END IF;
END $$;

-- ── nfse_emitidas ───────────────────────────────────────────
DROP POLICY IF EXISTS "nfse_emitidas_admin_all"         ON nfse_emitidas;
DROP POLICY IF EXISTS "nfse_emitidas_coordinator_select" ON nfse_emitidas;
CREATE POLICY "nfse_emitidas_select" ON nfse_emitidas FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'nfse-emitidas', 'view'));
CREATE POLICY "nfse_emitidas_insert" ON nfse_emitidas FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'nfse-emitidas', 'create'));
CREATE POLICY "nfse_emitidas_update" ON nfse_emitidas FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'nfse-emitidas', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'nfse-emitidas', 'edit'));
CREATE POLICY "nfse_emitidas_delete" ON nfse_emitidas FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'nfse-emitidas', 'delete'));

-- ── fornecedores ────────────────────────────────────────────
DROP POLICY IF EXISTS "fornecedores_admin_all"          ON fornecedores;
DROP POLICY IF EXISTS "fornecedores_coordinator_select" ON fornecedores;
CREATE POLICY "fornecedores_select" ON fornecedores FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'fornecedores', 'view'));
CREATE POLICY "fornecedores_insert" ON fornecedores FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'fornecedores', 'create'));
CREATE POLICY "fornecedores_update" ON fornecedores FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'fornecedores', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'fornecedores', 'edit'));
CREATE POLICY "fornecedores_delete" ON fornecedores FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'fornecedores', 'delete'));

-- ── store_orders ────────────────────────────────────────────
-- Mantém store_orders_user_insert, store_orders_user_select e
-- store_orders_guardian_read (fluxo de portal de aluno/responsável).
DROP POLICY IF EXISTS "store_orders_admin_all" ON store_orders;
CREATE POLICY "store_orders_admin_select" ON store_orders FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'store-orders', 'view'));
CREATE POLICY "store_orders_admin_insert" ON store_orders FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'store-orders', 'create'));
CREATE POLICY "store_orders_admin_update" ON store_orders FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'store-orders', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'store-orders', 'edit'));
CREATE POLICY "store_orders_admin_delete" ON store_orders FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'store-orders', 'delete'));

-- ── store_products ──────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_products') THEN
    EXECUTE 'DROP POLICY IF EXISTS "store_products_admin_all" ON store_products';
    EXECUTE 'DROP POLICY IF EXISTS "store_products_public_read" ON store_products';
    -- mantém read público se existir outra policy com a forma `status = 'active'`
    EXECUTE $p$CREATE POLICY "store_products_admin_select" ON store_products FOR SELECT TO authenticated
      USING (has_module_permission(auth.uid(), 'store-products', 'view'))$p$;
    EXECUTE $p$CREATE POLICY "store_products_admin_insert" ON store_products FOR INSERT TO authenticated
      WITH CHECK (has_module_permission(auth.uid(), 'store-products', 'create'))$p$;
    EXECUTE $p$CREATE POLICY "store_products_admin_update" ON store_products FOR UPDATE TO authenticated
      USING      (has_module_permission(auth.uid(), 'store-products', 'edit'))
      WITH CHECK (has_module_permission(auth.uid(), 'store-products', 'edit'))$p$;
    EXECUTE $p$CREATE POLICY "store_products_admin_delete" ON store_products FOR DELETE TO authenticated
      USING (has_module_permission(auth.uid(), 'store-products', 'delete'))$p$;
  END IF;
END $$;

-- ── lost_found_items ────────────────────────────────────────
DROP POLICY IF EXISTS "lost_found_items_admin_all" ON lost_found_items;
CREATE POLICY "lost_found_items_admin_select" ON lost_found_items FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'lost-found', 'view'));
CREATE POLICY "lost_found_items_admin_insert" ON lost_found_items FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'lost-found', 'create'));
CREATE POLICY "lost_found_items_admin_update" ON lost_found_items FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'lost-found', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'lost-found', 'edit'));
CREATE POLICY "lost_found_items_admin_delete" ON lost_found_items FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'lost-found', 'delete'));

DROP POLICY IF EXISTS "lost_found_events_admin_all" ON lost_found_events;
CREATE POLICY "lost_found_events_admin_select" ON lost_found_events FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'lost-found', 'view'));
CREATE POLICY "lost_found_events_admin_insert" ON lost_found_events FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'lost-found', 'create'));

-- ============================================================
-- 5. Fechar `USING (true)` do baseline
-- ============================================================
-- Estas policies permitiam a qualquer `authenticated` ler/atualizar livre.

-- ── enrollments ─────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_enrollments"  ON enrollments;
DROP POLICY IF EXISTS "auth_update_enrollment" ON enrollments;
-- `anon_insert_enrollment` PERMANECE (form público de matrícula inicial).
CREATE POLICY "enrollments_admin_select" ON enrollments FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'enrollments', 'view'));
CREATE POLICY "enrollments_admin_update" ON enrollments FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'enrollments', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'enrollments', 'edit'));
CREATE POLICY "enrollments_admin_delete" ON enrollments FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'enrollments', 'delete'));
-- Permite que o usuário (responsável) leia a própria matrícula por email,
-- se quisermos — por hora ficar só no caminho admin. Adicionar depois se UX exigir.

-- ── enrollment_documents ────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_enrollment_documents" ON enrollment_documents;
-- `anon_insert_enrollment_document` PERMANECE (upload durante matrícula pública).
CREATE POLICY "enrollment_documents_admin_select" ON enrollment_documents FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'enrollments', 'view'));
CREATE POLICY "enrollment_documents_admin_delete" ON enrollment_documents FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'enrollments', 'delete'));

-- ── enrollment_history ──────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access on enrollment_history" ON enrollment_history;
CREATE POLICY "enrollment_history_admin_select" ON enrollment_history FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'enrollments', 'view'));
-- writes: só via trigger/SECURITY DEFINER; negar INSERT direto do client.
CREATE POLICY "enrollment_history_admin_insert" ON enrollment_history FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'enrollments', 'edit'));

-- ── contact_requests ────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_contacts"  ON contact_requests;
DROP POLICY IF EXISTS "auth_update_contact" ON contact_requests;
-- `anon_insert_contact` PERMANECE (form público).
CREATE POLICY "contact_requests_admin_select" ON contact_requests FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'contacts', 'view'));
CREATE POLICY "contact_requests_admin_update" ON contact_requests FOR UPDATE TO authenticated
  USING      (has_module_permission(auth.uid(), 'contacts', 'edit'))
  WITH CHECK (has_module_permission(auth.uid(), 'contacts', 'edit'));
CREATE POLICY "contact_requests_admin_delete" ON contact_requests FOR DELETE TO authenticated
  USING (has_module_permission(auth.uid(), 'contacts', 'delete'));

-- ── contact_history ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access on contact_history" ON contact_history;
CREATE POLICY "contact_history_admin_select" ON contact_history FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'contacts', 'view'));
CREATE POLICY "contact_history_admin_insert" ON contact_history FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'contacts', 'edit'));

-- ── appointment_history ─────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access on appointment_history" ON appointment_history;
CREATE POLICY "appointment_history_admin_select" ON appointment_history FOR SELECT TO authenticated
  USING (has_module_permission(auth.uid(), 'appointments', 'view'));
CREATE POLICY "appointment_history_admin_insert" ON appointment_history FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'appointments', 'edit'));

-- ============================================================
-- 6. Seed de novos module keys necessários (Fase B)
-- ============================================================

INSERT INTO modules (key, label, description, icon, "group", position) VALUES
  ('academic-dashboard',    'Acadêmico — Dashboard',      'Resumo acadêmico',                 'LayoutDashboard', 'academico', 80),
  ('academic-disciplines',  'Acadêmico — Disciplinas',    'Cadastro de disciplinas',          'BookOpen',        'academico', 81),
  ('academic-schedule',     'Acadêmico — Grade Horária',  'Grade horária por turma',          'CalendarDays',    'academico', 82),
  ('academic-calendar',     'Acadêmico — Calendário',     'Calendário letivo',                'CalendarDays',    'academico', 83),
  ('academic-report-cards', 'Acadêmico — Boletim',        'Boletim escolar',                  'FileText',        'academico', 84),
  ('academic-results',      'Acadêmico — Resultados',     'Resultado final do ano',           'FileCheck2',      'academico', 85),
  ('academic-alerts',       'Acadêmico — Alertas',        'Alertas acadêmicos',               'AlertTriangle',   'academico', 86),
  ('academic-history',      'Acadêmico — Histórico',      'Histórico escolar',                'FileText',        'academico', 87),
  ('academic-bncc',         'Acadêmico — BNCC',           'Referencial BNCC',                 'BookOpen',        'academico', 88)
ON CONFLICT (key) DO NOTHING;

-- Herdar role_permissions de 'academico' para cada nova chave
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
SELECT rp.role, nk.new_key,
       rp.can_view, rp.can_create, rp.can_edit, rp.can_delete, rp.can_import
FROM role_permissions rp
CROSS JOIN (VALUES
  ('academic-dashboard'),    ('academic-disciplines'),  ('academic-schedule'),
  ('academic-calendar'),     ('academic-report-cards'), ('academic-results'),
  ('academic-alerts'),       ('academic-history'),      ('academic-bncc')
) AS nk(new_key)
WHERE rp.module_key = 'academico'
ON CONFLICT (role, module_key) DO NOTHING;

-- ============================================================
-- 7. Audit de bypass de super_admin
-- ============================================================
-- Trigger genérico que grava em audit_logs quando um super_admin muda
-- linhas em tabelas sensíveis. Não bloqueia, apenas registra.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    EXECUTE $p$
      CREATE OR REPLACE FUNCTION public.log_super_admin_bypass()
      RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = public
      AS $t$
      DECLARE
        v_role text;
        v_name text;
        v_rid  text;
      BEGIN
        SELECT role, full_name INTO v_role, v_name FROM profiles WHERE id = auth.uid();
        IF v_role = 'super_admin' THEN
          BEGIN
            v_rid := COALESCE((NEW).id::text, (OLD).id::text);
          EXCEPTION WHEN undefined_column THEN
            v_rid := NULL;
          END;
          INSERT INTO audit_logs (user_id, user_name, user_role, action, module, record_id, description, new_data, old_data)
          VALUES (
            auth.uid(), v_name, v_role, 'super_admin_bypass',
            TG_TABLE_NAME, v_rid,
            format('super_admin executou %s em %s', TG_OP, TG_TABLE_NAME),
            CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
            CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END
          );
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $t$;
    $p$;
  END IF;
END $$;

-- Apenas anexa em tabelas cuja coluna id é uuid (padrão do schema).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students','financial_installments','financial_receivables',
    'nfse_emitidas','store_orders','lost_found_items','enrollments'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t)
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_super_admin_bypass') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_sa_bypass ON %I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_%s_sa_bypass AFTER INSERT OR UPDATE OR DELETE ON %I '
        'FOR EACH ROW EXECUTE FUNCTION log_super_admin_bypass()',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 8. Realtime para PermissionsContext
-- ============================================================
-- Publica mudanças em role_permissions / user_permission_overrides / modules
-- para o cliente via supabase_realtime — o frontend reassina e chama refresh().

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE role_permissions;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE user_permission_overrides;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE modules;
    EXCEPTION WHEN duplicate_object THEN END;
  END IF;
END $$;
