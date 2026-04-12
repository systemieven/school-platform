-- Migration 038: Testimonials Admin Management
-- Adds admin RLS policies, rejection_reason column, and registers the module.

-- 1. Add rejection_reason column
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. RLS: admin can SELECT all testimonials (regardless of status)
CREATE POLICY "testimonials_admin_select"
  ON testimonials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin', 'coordinator')
        AND profiles.is_active = true
    )
  );

-- 3. RLS: admin can UPDATE testimonials (approve / reject)
CREATE POLICY "testimonials_admin_update"
  ON testimonials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin', 'coordinator')
        AND profiles.is_active = true
    )
  );

-- 4. RLS: admin can DELETE testimonials
CREATE POLICY "testimonials_admin_delete"
  ON testimonials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin', 'coordinator')
        AND profiles.is_active = true
    )
  );

-- 5. Register module in permissions system
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES (
  'testimonials',
  'Depoimentos',
  'Gestão de depoimentos de pais e alunos',
  'MessageSquare',
  'escola',
  16,
  true,
  '{}'
)
ON CONFLICT (key) DO NOTHING;

-- 6. Default role permissions
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('admin',       'testimonials', true,  false, true,  true),
  ('coordinator', 'testimonials', true,  false, true,  true),
  ('teacher',     'testimonials', false, false, false, false),
  ('user',        'testimonials', false, false, false, false)
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view   = EXCLUDED.can_view,
      can_create = EXCLUDED.can_create,
      can_edit   = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete;
