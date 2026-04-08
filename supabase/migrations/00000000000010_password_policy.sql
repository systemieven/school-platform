-- ── Password policy & first-access enforcement ──────────────────────────────

-- 1. Extend profiles with password-management columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at  TIMESTAMPTZ;

-- 2. Password history (stores hashed passwords for reuse prevention)
CREATE TABLE IF NOT EXISTS password_history (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT       NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own history (needed for client-side display if ever)
CREATE POLICY "users view own password history"
  ON password_history FOR SELECT
  USING (auth.uid() = user_id);

-- Service role manages all rows (edge functions use service role)
CREATE POLICY "service role manages password history"
  ON password_history FOR ALL
  USING (true) WITH CHECK (true);

-- 3. Seed default password policy into system_settings (key-value store)
INSERT INTO system_settings (key, value)
VALUES (
  'password_policy',
  '{
    "min_length": 8,
    "require_uppercase": false,
    "require_lowercase": false,
    "require_numbers": false,
    "require_special": false,
    "password_lifetime_days": 0,
    "password_history_count": 0
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
