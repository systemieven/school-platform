-- 186: Fase 16 PR1 — Tabela `staff` (cadastro autônomo de colaboradores)
--
-- Entidade independente de `profiles`. Um colaborador pode existir sem conta
-- no sistema (serviços gerais, zelador, cozinha). Quando admin clicar "Criar
-- acesso ao sistema", um `auth.users` + `profiles` é criado e linkado via
-- `staff.profile_id`.
--
-- RLS via módulo `rh-colaboradores` (migration 185). Admin/super_admin ALL.
-- Coordenador herda do defaults de role_permissions (view/edit).

CREATE TABLE IF NOT EXISTS staff (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id               UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,

  -- Dados pessoais
  full_name                TEXT NOT NULL,
  email                    TEXT,
  phone                    TEXT,
  cpf                      TEXT UNIQUE,
  rg                       TEXT,
  birth_date               DATE,

  -- Endereço
  address_street           TEXT,
  address_number           TEXT,
  address_complement       TEXT,
  address_neighborhood     TEXT,
  address_city             TEXT,
  address_state            TEXT,
  address_zip              TEXT,

  -- Dados profissionais
  position                 TEXT NOT NULL,
  department               TEXT,
  hire_date                DATE NOT NULL,
  termination_date         DATE,
  employment_type          TEXT NOT NULL
                           CHECK (employment_type IN ('clt','pj','estagio','terceirizado')),

  -- Contato de emergência
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,

  -- Outros
  avatar_url               TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  notes                    TEXT,

  created_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- CHECK: email, se preenchido, tem formato válido (validação simples).
  CONSTRAINT staff_email_format CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX IF NOT EXISTS idx_staff_profile_id ON staff(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_is_active  ON staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department);

-- updated_at trigger
CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Trigger: sincronizar staff → profiles enquanto profile_id estiver linkado
-- ============================================================
CREATE OR REPLACE FUNCTION sync_staff_to_profile_on_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.profile_id IS NOT NULL THEN
    UPDATE profiles
       SET full_name = NEW.full_name,
           email     = COALESCE(NEW.email, profiles.email),
           phone     = NEW.phone,
           avatar_url = COALESCE(NEW.avatar_url, profiles.avatar_url)
     WHERE id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_staff_sync_to_profile
  AFTER UPDATE OF full_name, email, phone, avatar_url, profile_id ON staff
  FOR EACH ROW
  WHEN (NEW.profile_id IS NOT NULL)
  EXECUTE FUNCTION sync_staff_to_profile_on_update();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Helper inline: checa permissão do módulo rh-colaboradores
-- (reutiliza padrão de outras tabelas do sistema: checa role + get_effective_permissions)

-- admin/super_admin ALL
CREATE POLICY "staff_admin_all" ON staff FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
    )
  );

-- Outros roles: baseado em get_effective_permissions('rh-colaboradores')
CREATE POLICY "staff_select_by_perm" ON staff FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-colaboradores' AND ep.can_view = true
    )
    OR profile_id = auth.uid()  -- self-service: sempre enxerga próprio row
  );

CREATE POLICY "staff_insert_by_perm" ON staff FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-colaboradores' AND ep.can_create = true
    )
  );

CREATE POLICY "staff_update_by_perm" ON staff FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-colaboradores' AND ep.can_edit = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-colaboradores' AND ep.can_edit = true
    )
  );

CREATE POLICY "staff_delete_by_perm" ON staff FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-colaboradores' AND ep.can_delete = true
    )
  );
