-- Migration 108 — WebAuthn: credenciais biométricas para o portal do responsável

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id   UUID        NOT NULL REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,  -- base64url rawId
  public_key    TEXT,                          -- base64url COSE key (uso futuro)
  device_name   TEXT        NOT NULL DEFAULT 'Dispositivo',
  counter       BIGINT      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wac_guardian ON webauthn_credentials(guardian_id);

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardian owns credentials"
  ON webauthn_credentials FOR ALL
  TO authenticated
  USING  (guardian_id = auth.uid())
  WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "Admin read credentials"
  ON webauthn_credentials FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin')));

-- Challenges de curta duração para prevenir replay attacks
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID        NOT NULL,
  challenge   TEXT        NOT NULL,
  purpose     TEXT        NOT NULL DEFAULT 'auth' CHECK (purpose IN ('register','auth')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '5 minutes',
  used        BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_wac_challenge_guardian ON webauthn_challenges(guardian_id, used, expires_at);

ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manages challenges"
  ON webauthn_challenges FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read own challenges"
  ON webauthn_challenges FOR SELECT
  TO authenticated
  USING (guardian_id = auth.uid());
