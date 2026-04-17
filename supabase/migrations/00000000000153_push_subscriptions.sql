-- Migration 153: PWA Push Notifications — Sprint 13.N.1
--
-- Tabela `push_subscriptions`: um registro por device/navegador que o usuario
-- autorizou a receber notificacoes push. Mesmo usuario pode ter varias
-- subscriptions (celular + desktop, por exemplo).
--
-- `endpoint` e UNIQUE porque o navegador garante que so existe uma subscription
-- ativa por (origem + device). Reinscricao sobrescreve a anterior.
--
-- Semeia `system_settings.push.vapid_public_key` (chave publica gerada via
-- `npx web-push generate-vapid-keys`). A chave privada fica em Supabase
-- secret `VAPID_PRIVATE_KEY` (nunca no DB). `VAPID_SUBJECT` tambem em secret.

-- ── 1. Tabela push_subscriptions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type    TEXT NOT NULL CHECK (user_type IN ('admin', 'guardian', 'student')),
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_type
  ON push_subscriptions(user_type) WHERE revoked_at IS NULL;

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- O proprio usuario pode gerenciar suas subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin vê todas (para debug/suporte) — sem INSERT/UPDATE porque so o dono
-- deve criar/atualizar via navegador.
CREATE POLICY "Admin view all push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- Admin pode revogar (UPDATE em revoked_at)
CREATE POLICY "Admin revoke push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- ── 3. Seed da chave publica VAPID ───────────────────────────────────────────

INSERT INTO system_settings (category, key, value)
VALUES
  ('push', 'vapid_public_key',
   '"BBEZvh3BrhHp6uZcH-bD83kJEQp7r3jsoPHGk8OzibADPXcQkYDYXmOhbCJcRWAAYK7WpRW2DdMeRu9-1vkrG9o"'::JSONB)
ON CONFLICT (category, key) DO NOTHING;

-- ── 4. Audit log ─────────────────────────────────────────────────────────────

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'push',
  'Aplicada migration 153 (push_subscriptions + VAPID public key)'
);
