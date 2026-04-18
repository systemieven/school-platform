-- ============================================================================
-- 00000000000189_must_change_password_students.sql
--
-- Adiciona suporte a `must_change_password` na tabela `students` — alinha o
-- portal do aluno com o já existente em `profiles` (admin/professor) e
-- `guardian_profiles` (responsável).
--
-- Antes: o flag só vivia em `profiles` (cobre admin + teacher) e em
-- `guardian_profiles` (cobre responsável). O `StudentAuthContext` carregava
-- o aluno de `students` mas não tinha onde ler o flag — efeito: aluno que
-- recebia senha provisória (futuramente) não seria forçado a trocá-la.
--
-- Default = false: alunos atuais (criados via self-signup pelo
-- StudentAuthContext.firstAccess) já escolheram a própria senha; não
-- vamos forçá-los a trocar. O flag será true só quando admin gerar senha
-- provisória pelo fluxo novo.
-- ============================================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at  TIMESTAMPTZ NULL;

COMMENT ON COLUMN students.must_change_password IS
  'Quando TRUE, StudentAuthContext força redirect para /portal/trocar-senha após login.';
COMMENT ON COLUMN students.password_changed_at IS
  'Última troca de senha do aluno (preenchido pela edge function change-password).';

DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'security',
    'Aplicada migration 189 (students.must_change_password + password_changed_at)',
    jsonb_build_object('migration', '00000000000189_must_change_password_students')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
