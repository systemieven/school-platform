-- ============================================================
-- F6.1 — Granular Permissions System
-- ============================================================

-- Modules registry: each module that can be permission-controlled
CREATE TABLE IF NOT EXISTS modules (
  key        TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  description TEXT,
  icon       TEXT,                    -- Lucide icon name
  "group"    TEXT NOT NULL DEFAULT 'other',
  position   INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  depends_on TEXT[] NOT NULL DEFAULT '{}',  -- module keys this depends on
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role-level permissions: which actions each role can perform per module
CREATE TABLE IF NOT EXISTS role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role       TEXT NOT NULL,           -- admin, coordinator, teacher, user
  module_key TEXT NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
  can_view   BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, module_key)
);

-- Per-user overrides: grant or deny specific permissions for individual users
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(key) ON DELETE CASCADE,
  can_view   BOOLEAN,  -- NULL = inherit from role
  can_create BOOLEAN,
  can_edit   BOOLEAN,
  can_delete BOOLEAN,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key)
);

-- Indexes
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_user_permission_overrides_user ON user_permission_overrides(user_id);

-- updated_at triggers
CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_permission_overrides_updated_at
  BEFORE UPDATE ON user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- modules: anyone authenticated can read (needed for menu rendering)
CREATE POLICY "modules_select_authenticated"
  ON modules FOR SELECT TO authenticated USING (true);

-- modules: only super_admin/admin can modify
CREATE POLICY "modules_admin_all"
  ON modules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- role_permissions: authenticated can read; super_admin/admin can modify
CREATE POLICY "role_permissions_select_authenticated"
  ON role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_permissions_admin_all"
  ON role_permissions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- user_permission_overrides: user can read own; admin can read/modify all
CREATE POLICY "user_overrides_select_own"
  ON user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_overrides_admin_all"
  ON user_permission_overrides FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- ============================================================
-- Seed: Modules (matching current admin-navigation.ts)
-- ============================================================

INSERT INTO modules (key, label, description, icon, "group", position) VALUES
  ('dashboard',     'Dashboard',          'Painel principal com métricas',             'LayoutDashboard', 'principal',     1),
  ('appointments',  'Agendamentos',       'Gestão de agendamentos de visitas',         'CalendarCheck',   'gestao',        2),
  ('enrollments',   'Pré-Matrículas',     'Gestão de pré-matrículas',                  'GraduationCap',   'gestao',        3),
  ('contacts',      'Contatos',           'Gestão de contatos e leads',                'MessageSquare',   'gestao',        4),
  ('attendance',    'Atendimentos',       'Fila de atendimento presencial',            'Ticket',          'gestao',        5),
  ('kanban',        'Kanban de Leads',    'Board de qualificação de leads',            'Kanban',          'qualificacao',  6),
  ('reports',       'Relatórios',         'Relatórios e exportação de dados',          'BarChart2',       'qualificacao',  7),
  ('segments',      'Segmentos e Turmas', 'Gestão de segmentos e turmas',              'School',          'escola',        8),
  ('students',      'Alunos',             'Gestão de alunos matriculados',             'UserCheck',       'escola',        9),
  ('teacher-area',  'Área do Professor',  'Materiais, atividades, notas, frequência',  'BookOpen',        'escola',       10),
  ('library',       'Biblioteca Virtual', 'Recursos digitais da biblioteca',           'Library',         'escola',       11),
  ('announcements', 'Comunicados',        'Comunicados para alunos e responsáveis',    'Megaphone',       'escola',       12),
  ('events',        'Eventos',            'Eventos escolares com RSVP',                'CalendarDays',    'escola',       13),
  ('users',         'Usuários',           'Gestão de contas e roles',                  'Users',           'sistema',      14),
  ('settings',      'Configurações',      'Configurações gerais do sistema',           'Settings',        'sistema',      15)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: Default Role Permissions (mirrors current hardcoded roles)
-- ============================================================

-- admin: full access to everything
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('admin', 'dashboard',     true, true, true, true),
  ('admin', 'appointments',  true, true, true, true),
  ('admin', 'enrollments',   true, true, true, true),
  ('admin', 'contacts',      true, true, true, true),
  ('admin', 'attendance',    true, true, true, true),
  ('admin', 'kanban',        true, true, true, true),
  ('admin', 'reports',       true, true, true, true),
  ('admin', 'segments',      true, true, true, true),
  ('admin', 'students',      true, true, true, true),
  ('admin', 'teacher-area',  true, true, true, true),
  ('admin', 'library',       true, true, true, true),
  ('admin', 'announcements', true, true, true, true),
  ('admin', 'events',        true, true, true, true),
  ('admin', 'users',         true, true, true, true),
  ('admin', 'settings',      true, true, true, true)
ON CONFLICT (role, module_key) DO NOTHING;

-- coordinator: same as admin except users and settings
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('coordinator', 'dashboard',     true, true, true, true),
  ('coordinator', 'appointments',  true, true, true, true),
  ('coordinator', 'enrollments',   true, true, true, true),
  ('coordinator', 'contacts',      true, true, true, true),
  ('coordinator', 'attendance',    true, true, true, true),
  ('coordinator', 'kanban',        true, true, true, true),
  ('coordinator', 'reports',       true, true, true, true),
  ('coordinator', 'segments',      true, true, true, false),
  ('coordinator', 'students',      true, true, true, false),
  ('coordinator', 'teacher-area',  true, true, true, true),
  ('coordinator', 'library',       true, true, true, true),
  ('coordinator', 'announcements', true, true, true, true),
  ('coordinator', 'events',        true, true, true, true),
  ('coordinator', 'users',         false, false, false, false),
  ('coordinator', 'settings',      false, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;

-- teacher: only escola modules
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('teacher', 'dashboard',     false, false, false, false),
  ('teacher', 'appointments',  false, false, false, false),
  ('teacher', 'enrollments',   false, false, false, false),
  ('teacher', 'contacts',      false, false, false, false),
  ('teacher', 'attendance',    false, false, false, false),
  ('teacher', 'kanban',        false, false, false, false),
  ('teacher', 'reports',       false, false, false, false),
  ('teacher', 'segments',      false, false, false, false),
  ('teacher', 'students',      false, false, false, false),
  ('teacher', 'teacher-area',  true, true, true, true),
  ('teacher', 'library',       true, true, true, false),
  ('teacher', 'announcements', true, true, true, false),
  ('teacher', 'events',        true, true, true, false),
  ('teacher', 'users',         false, false, false, false),
  ('teacher', 'settings',      false, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;

-- user: no access by default (everything via overrides)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('user', 'dashboard',     false, false, false, false),
  ('user', 'appointments',  false, false, false, false),
  ('user', 'enrollments',   false, false, false, false),
  ('user', 'contacts',      false, false, false, false),
  ('user', 'attendance',    false, false, false, false),
  ('user', 'kanban',        false, false, false, false),
  ('user', 'reports',       false, false, false, false),
  ('user', 'segments',      false, false, false, false),
  ('user', 'students',      false, false, false, false),
  ('user', 'teacher-area',  false, false, false, false),
  ('user', 'library',       false, false, false, false),
  ('user', 'announcements', false, false, false, false),
  ('user', 'events',        false, false, false, false),
  ('user', 'users',         false, false, false, false),
  ('user', 'settings',      false, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;

-- ============================================================
-- Helper function: get effective permissions for a user
-- ============================================================

CREATE OR REPLACE FUNCTION get_effective_permissions(p_user_id UUID)
RETURNS TABLE (
  module_key TEXT,
  can_view   BOOLEAN,
  can_create BOOLEAN,
  can_edit   BOOLEAN,
  can_delete BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

  -- super_admin always gets full access
  IF v_role = 'super_admin' THEN
    RETURN QUERY
      SELECT m.key, true, true, true, true
      FROM modules m
      WHERE m.is_active = true;
    RETURN;
  END IF;

  -- For other roles: merge role_permissions with user_permission_overrides
  RETURN QUERY
    SELECT
      rp.module_key,
      COALESCE(upo.can_view,   rp.can_view)   AS can_view,
      COALESCE(upo.can_create, rp.can_create) AS can_create,
      COALESCE(upo.can_edit,   rp.can_edit)   AS can_edit,
      COALESCE(upo.can_delete, rp.can_delete) AS can_delete
    FROM role_permissions rp
    INNER JOIN modules m ON m.key = rp.module_key AND m.is_active = true
    LEFT JOIN user_permission_overrides upo
      ON upo.user_id = p_user_id AND upo.module_key = rp.module_key
    WHERE rp.role = v_role;
END;
$$;
