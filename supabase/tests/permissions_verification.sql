-- ============================================================================
-- permissions_verification.sql
--
-- Script end-to-end de verificação das permissões granulares (migrations 144+145).
--
-- Executa em transação, cria fixtures, roda asserts via `RAISE EXCEPTION` e
-- dá ROLLBACK no final — nada é persistido. Não precisa de infra de teste:
-- rodar direto no SQL Editor do Supabase (projeto staging) ou via
--   psql "$DATABASE_URL" -f supabase/tests/permissions_verification.sql
--
-- Fixtures:
--   A = admin com override `is_deny=true` em students:view
--   B = teacher com override concedendo students:view
--   C = user (responsável) sem nada
--
-- Asserts:
--   1. A NÃO enxerga students (deny vence role)
--   2. B enxerga APENAS alunos de suas turmas (tenancy)
--   3. C NÃO enxerga students pelo RLS admin (só por guardian_portal)
--   4. super_admin bypass continua funcionando
--   5. has_module_permission retorna o esperado
-- ============================================================================

BEGIN;

-- Silenciar notices verbosos
SET client_min_messages TO WARNING;

-- Helpers de teste
CREATE OR REPLACE FUNCTION pg_temp.assert(p_cond boolean, p_msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_cond THEN
    RAISE EXCEPTION 'FAIL: %', p_msg;
  ELSE
    RAISE NOTICE 'OK: %', p_msg;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_user uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Emula auth.uid() na sessão via request.jwt.claims
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- ============================================================================
-- FIXTURES
-- ============================================================================

-- IDs determinísticos
DO $$
DECLARE
  v_admin_id  uuid := '00000000-0000-0000-0000-00000000A001';
  v_teacher_id uuid := '00000000-0000-0000-0000-00000000A002';
  v_user_id   uuid := '00000000-0000-0000-0000-00000000A003';
  v_super_id  uuid := '00000000-0000-0000-0000-00000000A004';
  v_class_mine uuid := '00000000-0000-0000-0000-00000000C001';
  v_class_other uuid := '00000000-0000-0000-0000-00000000C002';
  v_student_mine uuid := '00000000-0000-0000-0000-00000000D001';
  v_student_other uuid := '00000000-0000-0000-0000-00000000D002';
  v_discipline_id uuid;
  v_segment_id uuid;
  v_grade_id uuid;
BEGIN
  -- auth.users fake (direct insert, só em staging)
  INSERT INTO auth.users (id, email, instance_id)
  VALUES
    (v_admin_id,  'a@test.local', '00000000-0000-0000-0000-000000000000'),
    (v_teacher_id,'b@test.local', '00000000-0000-0000-0000-000000000000'),
    (v_user_id,   'c@test.local', '00000000-0000-0000-0000-000000000000'),
    (v_super_id,  's@test.local', '00000000-0000-0000-0000-000000000000')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, email, full_name, role, is_active)
  VALUES
    (v_admin_id,  'a@test.local', 'Admin Fixture',   'admin',       true),
    (v_teacher_id,'b@test.local', 'Teacher Fixture', 'teacher',     true),
    (v_user_id,   'c@test.local', 'User Fixture',    'user',        true),
    (v_super_id,  's@test.local', 'Super Fixture',   'super_admin', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- Segmento/série/turma mínimos
  INSERT INTO academic_segments (id, name, display_order)
  VALUES ('00000000-0000-0000-0000-00000000E001', 'Fixture Segment', 1)
  ON CONFLICT (id) DO NOTHING RETURNING id INTO v_segment_id;

  INSERT INTO academic_grades (id, segment_id, name, display_order)
  VALUES ('00000000-0000-0000-0000-00000000F001',
          '00000000-0000-0000-0000-00000000E001', 'Fixture Grade', 1)
  ON CONFLICT (id) DO NOTHING RETURNING id INTO v_grade_id;

  INSERT INTO school_classes (id, grade_id, name, year)
  VALUES
    (v_class_mine,  '00000000-0000-0000-0000-00000000F001', 'TurmaMine',  2026),
    (v_class_other, '00000000-0000-0000-0000-00000000F001', 'TurmaOther', 2026)
  ON CONFLICT (id) DO NOTHING;

  -- Disciplina + class_disciplines vinculando só a TurmaMine ao teacher
  INSERT INTO disciplines (id, name)
  VALUES ('00000000-0000-0000-0000-000000009001', 'Fixture Disc')
  ON CONFLICT (id) DO NOTHING RETURNING id INTO v_discipline_id;

  INSERT INTO class_disciplines (class_id, discipline_id, teacher_id)
  VALUES (v_class_mine, '00000000-0000-0000-0000-000000009001', v_teacher_id)
  ON CONFLICT (class_id, discipline_id) DO NOTHING;

  -- Alunos
  INSERT INTO students (id, enrollment_number, class_id, full_name,
                        guardian_name, guardian_phone, status)
  VALUES
    (v_student_mine,  'TEST-001', v_class_mine,  'Aluno Mine',
     'Resp Mine',  '+550000000001', 'active'),
    (v_student_other, 'TEST-002', v_class_other, 'Aluno Other',
     'Resp Other', '+550000000002', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Overrides:
  --   A (admin) com deny em students:view
  --   B (teacher) com grant em students:view
  INSERT INTO user_permission_overrides
    (user_id, module_key, can_view, can_create, can_edit, can_delete, is_deny)
  VALUES
    (v_admin_id,   'students', true, false, false, false, true),
    (v_teacher_id, 'students', true, false, false, false, false)
  ON CONFLICT (user_id, module_key) DO UPDATE
    SET can_view = EXCLUDED.can_view,
        is_deny  = EXCLUDED.is_deny;
END$$;

-- ============================================================================
-- ASSERTS
-- ============================================================================

-- 1. has_module_permission direto
DO $$
DECLARE
  v_admin uuid   := '00000000-0000-0000-0000-00000000A001';
  v_teacher uuid := '00000000-0000-0000-0000-00000000A002';
  v_user uuid    := '00000000-0000-0000-0000-00000000A003';
  v_super uuid   := '00000000-0000-0000-0000-00000000A004';
BEGIN
  PERFORM pg_temp.assert(
    NOT has_module_permission(v_admin, 'students', 'view'),
    'A (admin+deny) não deve ter students:view'
  );
  PERFORM pg_temp.assert(
    has_module_permission(v_teacher, 'students', 'view'),
    'B (teacher+grant) deve ter students:view'
  );
  PERFORM pg_temp.assert(
    NOT has_module_permission(v_user, 'students', 'view'),
    'C (user) não deve ter students:view'
  );
  PERFORM pg_temp.assert(
    has_module_permission(v_super, 'students', 'view'),
    'super_admin bypass deve ter students:view'
  );
END$$;

-- 2. RLS contagem — simula cada usuário
DO $$
DECLARE
  v_count int;
  v_admin uuid   := '00000000-0000-0000-0000-00000000A001';
  v_teacher uuid := '00000000-0000-0000-0000-00000000A002';
  v_user uuid    := '00000000-0000-0000-0000-00000000A003';
  v_super uuid   := '00000000-0000-0000-0000-00000000A004';
BEGIN
  -- A (deny)
  PERFORM pg_temp.as_user(v_admin);
  SELECT count(*) INTO v_count FROM students WHERE enrollment_number LIKE 'TEST-%';
  PERFORM pg_temp.assert(v_count = 0, format('A enxerga 0 students (viu %s)', v_count));
  RESET role;

  -- B (teacher) — vê só o da sua turma
  PERFORM pg_temp.as_user(v_teacher);
  SELECT count(*) INTO v_count FROM students WHERE enrollment_number LIKE 'TEST-%';
  PERFORM pg_temp.assert(v_count = 1, format('B enxerga exatamente 1 student (viu %s)', v_count));
  RESET role;

  -- C (user) — zero via RLS admin
  PERFORM pg_temp.as_user(v_user);
  SELECT count(*) INTO v_count FROM students WHERE enrollment_number LIKE 'TEST-%';
  PERFORM pg_temp.assert(v_count = 0, format('C enxerga 0 students (viu %s)', v_count));
  RESET role;

  -- super_admin — vê todos (2)
  PERFORM pg_temp.as_user(v_super);
  SELECT count(*) INTO v_count FROM students WHERE enrollment_number LIKE 'TEST-%';
  PERFORM pg_temp.assert(v_count = 2, format('super_admin enxerga 2 students (viu %s)', v_count));
  RESET role;
END$$;

-- 3. Tentativa de UPDATE direto por A (deve afetar 0 linhas)
DO $$
DECLARE
  v_rows int;
  v_admin uuid := '00000000-0000-0000-0000-00000000A001';
BEGIN
  PERFORM pg_temp.as_user(v_admin);
  UPDATE students SET full_name = 'hacked'
    WHERE enrollment_number = 'TEST-001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp.assert(v_rows = 0, format('A update bloqueado (tocou %s linhas)', v_rows));
  RESET role;
END$$;

-- 4. Regressão do bug "mirror overrides" (UsersPage pré-fix):
--    overrides que espelham exatamente o role default do usuário são
--    funcionalmente no-op e devem ser removidos pela migration 146 E
--    nunca mais criados pela UI corrigida. Este assert garante que a
--    tabela não contém linhas mirror para os fixtures carregados acima.
DO $$
DECLARE
  v_mirror int;
BEGIN
  SELECT count(*) INTO v_mirror
  FROM user_permission_overrides upo
  JOIN profiles p ON p.id = upo.user_id
  JOIN role_permissions rp
    ON rp.role = p.role AND rp.module_key = upo.module_key
  WHERE upo.is_deny = false
    AND upo.can_view   = rp.can_view
    AND upo.can_create = rp.can_create
    AND upo.can_edit   = rp.can_edit
    AND upo.can_delete = rp.can_delete
    AND COALESCE(upo.can_import, false) = COALESCE(rp.can_import, false);
  PERFORM pg_temp.assert(
    v_mirror = 0,
    format('Nenhum override mirror deve existir (encontrou %s)', v_mirror)
  );
END$$;

-- 5. Regressão do bug "phantom grant": roles teacher/user/student não
--    devem ter overrides concedendo módulos admin-only com is_deny=false.
--    A UI corrigida bloqueia a criação; esta migration de cleanup apaga
--    as linhas legadas.
DO $$
DECLARE
  v_phantom int;
BEGIN
  SELECT count(*) INTO v_phantom
  FROM user_permission_overrides upo
  JOIN profiles p ON p.id = upo.user_id
  WHERE p.role IN ('teacher','user','student')
    AND upo.is_deny = false
    AND upo.module_key IN (
      'financial','audit','users','permissions','settings',
      'fornecedores','nfse-emitidas','store-orders','store-products',
      'financial-plans','financial-contracts','financial-installments',
      'financial-receivables','financial-payables'
    );
  PERFORM pg_temp.assert(
    v_phantom = 0,
    format('Nenhum phantom grant admin-only para role não-admin (encontrou %s)', v_phantom)
  );
END$$;

-- Resumo
DO $$ BEGIN RAISE NOTICE '============================================================';
            RAISE NOTICE 'Verificação de permissões concluída sem falhas.';
            RAISE NOTICE '============================================================'; END$$;

ROLLBACK;
