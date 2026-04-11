-- ============================================================
-- F6.3 — Centralized Audit Logs
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT,           -- denormalized for fast reads
  user_role   TEXT,           -- denormalized
  action      TEXT NOT NULL,  -- create, update, delete, login, logout, status_change, export, etc.
  module      TEXT,           -- module key (appointments, enrollments, etc.)
  record_id   TEXT,           -- affected record ID
  description TEXT,           -- human-readable description
  old_data    JSONB,          -- previous state (for updates)
  new_data    JSONB,          -- new state (for creates/updates)
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_record ON audit_logs(module, record_id);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin and admin can read audit logs
CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Insert is allowed for all authenticated users (logging their own actions)
CREATE POLICY "audit_logs_insert_authenticated"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Also allow service_role and edge functions to insert
CREATE POLICY "audit_logs_insert_anon"
  ON audit_logs FOR INSERT TO anon
  WITH CHECK (true);

-- Add module entry
INSERT INTO modules (key, label, description, icon, "group", position) VALUES
  ('audit', 'Logs de Auditoria', 'Registro centralizado de ações no sistema', 'FileSearch', 'sistema', 14)
ON CONFLICT (key) DO NOTHING;

-- Adjust positions
UPDATE modules SET position = 15 WHERE key = 'permissions';
UPDATE modules SET position = 16 WHERE key = 'users';
UPDATE modules SET position = 17 WHERE key = 'settings';

-- Add role permissions for audit module
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('admin', 'audit', true, false, false, false),
  ('coordinator', 'audit', false, false, false, false),
  ('teacher', 'audit', false, false, false, false),
  ('user', 'audit', false, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;

-- ============================================================
-- Helper function to log audit events from client
-- ============================================================

CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_module TEXT DEFAULT NULL,
  p_record_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_role TEXT;
  v_log_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT full_name, role INTO v_user_name, v_user_role
    FROM profiles WHERE id = v_user_id;
  END IF;

  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, record_id, description, old_data, new_data)
  VALUES (v_user_id, v_user_name, v_user_role, p_action, p_module, p_record_id, p_description, p_old_data, p_new_data)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
