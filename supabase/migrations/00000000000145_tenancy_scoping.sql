-- ============================================================================
-- 00000000000145_tenancy_scoping.sql
--
-- Tenancy row-level scoping para o role `teacher`.
--
-- A migration 144 já endureceu o gating por módulo (`has_module_permission`),
-- mas um teacher com `students:view` via override enxergava **todos** os
-- alunos — não apenas os de suas turmas. Esta migration introduz:
--
--   • `is_admin_like(user)` — super_admin / admin / coordinator bypass
--   • `teacher_sees_student(user, student_id)` — true se o teacher leciona
--     em alguma `class_disciplines` do `students.class_id` do aluno.
--   • Ajuste das policies de `students` (SELECT/UPDATE/DELETE) para, quando
--     o caller for teacher, exigir também vínculo via class_disciplines.
--   • Mesmo padrão aplicado a `absence_communications` e `exit_authorizations`
--     (tabelas em que teacher atua rotineiramente).
--
-- INSERT continua controlado por `has_module_permission(...,'create')`
-- sem tenancy — criar aluno é atribuição administrativa. Se um teacher
-- tiver `students:create` via override, ele segue criando mas não vê o
-- recém-criado via SELECT a menos que seja atribuído à turma.
--
-- Admins/coordenadores com `has_module_permission` enxergam todos; teachers
-- ficam escopados. Role `user` (portal do responsável) não é afetado pelas
-- policies de admin — continua acessando seus próprios dados via outras
-- policies (guardian_portal).
-- ============================================================================

-- ============================================================================
-- 1. HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_like(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user
      AND role IN ('super_admin', 'admin', 'coordinator')
      AND COALESCE(is_active, true) = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_like(uuid) IS
  'True quando o usuário é super_admin/admin/coordinator ativo. Usado em policies para bypass de tenancy.';

CREATE OR REPLACE FUNCTION public.teacher_sees_student(p_user uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM students s
    JOIN class_disciplines cd ON cd.class_id = s.class_id
    WHERE s.id = p_student_id
      AND cd.teacher_id = p_user
  );
$$;

COMMENT ON FUNCTION public.teacher_sees_student(uuid, uuid) IS
  'True quando existe vínculo teacher↔class_disciplines↔student. Alunos sem class_id ficam invisíveis ao teacher.';

-- Grants — authenticated precisa executar os helpers dentro das policies.
GRANT EXECUTE ON FUNCTION public.is_admin_like(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_sees_student(uuid, uuid) TO authenticated;

-- ============================================================================
-- 2. STUDENTS — tenancy para teacher
-- ============================================================================

DROP POLICY IF EXISTS "students_select" ON students;
CREATE POLICY "students_select" ON students FOR SELECT TO authenticated
  USING (
    has_module_permission(auth.uid(), 'students', 'view')
    AND (
      is_admin_like(auth.uid())
      OR teacher_sees_student(auth.uid(), students.id)
    )
  );

DROP POLICY IF EXISTS "students_update" ON students;
CREATE POLICY "students_update" ON students FOR UPDATE TO authenticated
  USING (
    has_module_permission(auth.uid(), 'students', 'edit')
    AND (
      is_admin_like(auth.uid())
      OR teacher_sees_student(auth.uid(), students.id)
    )
  )
  WITH CHECK (
    has_module_permission(auth.uid(), 'students', 'edit')
    AND (
      is_admin_like(auth.uid())
      OR teacher_sees_student(auth.uid(), students.id)
    )
  );

DROP POLICY IF EXISTS "students_delete" ON students;
CREATE POLICY "students_delete" ON students FOR DELETE TO authenticated
  USING (
    has_module_permission(auth.uid(), 'students', 'delete')
    AND is_admin_like(auth.uid())
  );

-- ============================================================================
-- 3. ABSENCE_COMMUNICATIONS — tenancy por aluno
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'absence_communications'
  ) THEN
    EXECUTE $pol$
      DROP POLICY IF EXISTS "absence_communications_select" ON absence_communications;
      CREATE POLICY "absence_communications_select" ON absence_communications
        FOR SELECT TO authenticated
        USING (
          has_module_permission(auth.uid(), 'absence-communications', 'view')
          AND (
            is_admin_like(auth.uid())
            OR teacher_sees_student(auth.uid(), absence_communications.student_id)
          )
        );

      DROP POLICY IF EXISTS "absence_communications_insert" ON absence_communications;
      CREATE POLICY "absence_communications_insert" ON absence_communications
        FOR INSERT TO authenticated
        WITH CHECK (
          has_module_permission(auth.uid(), 'absence-communications', 'create')
          AND (
            is_admin_like(auth.uid())
            OR teacher_sees_student(auth.uid(), absence_communications.student_id)
          )
        );

      DROP POLICY IF EXISTS "absence_communications_update" ON absence_communications;
      CREATE POLICY "absence_communications_update" ON absence_communications
        FOR UPDATE TO authenticated
        USING (
          has_module_permission(auth.uid(), 'absence-communications', 'edit')
          AND (
            is_admin_like(auth.uid())
            OR teacher_sees_student(auth.uid(), absence_communications.student_id)
          )
        )
        WITH CHECK (
          has_module_permission(auth.uid(), 'absence-communications', 'edit')
          AND (
            is_admin_like(auth.uid())
            OR teacher_sees_student(auth.uid(), absence_communications.student_id)
          )
        );

      DROP POLICY IF EXISTS "absence_communications_delete" ON absence_communications;
      CREATE POLICY "absence_communications_delete" ON absence_communications
        FOR DELETE TO authenticated
        USING (
          has_module_permission(auth.uid(), 'absence-communications', 'delete')
          AND is_admin_like(auth.uid())
        );
    $pol$;
  END IF;
END$$;

-- ============================================================================
-- 4. EXIT_AUTHORIZATIONS — tenancy por aluno
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exit_authorizations'
  ) THEN
    EXECUTE $pol$
      DROP POLICY IF EXISTS "exit_authorizations_select" ON exit_authorizations;
      CREATE POLICY "exit_authorizations_select" ON exit_authorizations
        FOR SELECT TO authenticated
        USING (
          has_module_permission(auth.uid(), 'exit-authorizations', 'view')
          AND (
            is_admin_like(auth.uid())
            OR teacher_sees_student(auth.uid(), exit_authorizations.student_id)
          )
        );

      DROP POLICY IF EXISTS "exit_authorizations_update" ON exit_authorizations;
      CREATE POLICY "exit_authorizations_update" ON exit_authorizations
        FOR UPDATE TO authenticated
        USING (
          has_module_permission(auth.uid(), 'exit-authorizations', 'edit')
          AND (
            is_admin_like(auth.uid())
            OR teacher_sees_student(auth.uid(), exit_authorizations.student_id)
          )
        )
        WITH CHECK (
          has_module_permission(auth.uid(), 'exit-authorizations', 'edit')
          AND (
            is_admin_like(auth.uid())
            OR teacher_sees_student(auth.uid(), exit_authorizations.student_id)
          )
        );
    $pol$;
  END IF;
END$$;

-- ============================================================================
-- 5. AUDIT LOG
-- ============================================================================
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL,
    'system',
    'super_admin',
    'migration',
    'permissions',
    'Aplicada migration 145 (tenancy scoping teacher↔classes em students/absence_communications/exit_authorizations)',
    jsonb_build_object('migration', '00000000000145_tenancy_scoping')
  );
EXCEPTION WHEN OTHERS THEN
  -- audit_logs pode não existir em algumas réplicas — silenciar.
  NULL;
END$$;
