-- Add can_import permission column
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS can_import BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_permission_overrides ADD COLUMN IF NOT EXISTS can_import BOOLEAN;

-- Admin and coordinator can import students
UPDATE role_permissions SET can_import = true
  WHERE module_key = 'students' AND role IN ('admin','coordinator');

-- Drop and recreate get_effective_permissions with can_import
DROP FUNCTION IF EXISTS get_effective_permissions(UUID);

CREATE OR REPLACE FUNCTION get_effective_permissions(p_user_id UUID)
RETURNS TABLE (
  module_key TEXT, can_view BOOLEAN, can_create BOOLEAN,
  can_edit BOOLEAN, can_delete BOOLEAN, can_import BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  IF v_role = 'super_admin' THEN
    RETURN QUERY SELECT m.key, true, true, true, true, true FROM modules m WHERE m.is_active;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT rp.module_key,
      COALESCE(upo.can_view,   rp.can_view),
      COALESCE(upo.can_create, rp.can_create),
      COALESCE(upo.can_edit,   rp.can_edit),
      COALESCE(upo.can_delete, rp.can_delete),
      COALESCE(upo.can_import, rp.can_import)
    FROM role_permissions rp
    INNER JOIN modules m ON m.key = rp.module_key AND m.is_active
    LEFT JOIN user_permission_overrides upo
      ON upo.user_id = p_user_id AND upo.module_key = rp.module_key
    WHERE rp.role = v_role;
END; $$;

-- Import templates table
CREATE TABLE IF NOT EXISTS import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_table TEXT NOT NULL DEFAULT 'students',
  mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read shared or own templates" ON import_templates FOR SELECT
  TO authenticated USING (is_shared OR created_by = auth.uid());
CREATE POLICY "Auth insert own templates" ON import_templates FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator or admin can update" ON import_templates FOR UPDATE
  TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );
CREATE POLICY "Creator or admin can delete" ON import_templates FOR DELETE
  TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );
