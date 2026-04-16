-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 106 — whatsapp_send_log
-- Cross-module deduplication log for WhatsApp sends.
-- Used by message-orchestrator to prevent sending 2+ messages to the same
-- number within a configurable time window, regardless of originating module.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_send_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Recipient (normalized: "55XXXXXXXXXXX")
  phone        TEXT         NOT NULL,
  -- Originating module (e.g. 'financial', 'auto-notify/agendamento', 'attendance')
  module       TEXT         NOT NULL,
  -- Template name or stage label for debugging
  template     TEXT,
  -- Priority: 1 = financial, 2 = academic, 3 = general
  priority     INT          NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 3),
  -- Outcome
  status       TEXT         NOT NULL DEFAULT 'sent'
                              CHECK (status IN ('sent', 'skipped', 'failed')),
  skip_reason  TEXT,
  error_msg    TEXT,
  -- When the message was actually dispatched (or the attempt was made)
  sent_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast dedup query: phone + recency
CREATE INDEX IF NOT EXISTS idx_wslog_phone_sent
  ON whatsapp_send_log (phone, sent_at DESC);

-- Module analytics
CREATE INDEX IF NOT EXISTS idx_wslog_module_sent
  ON whatsapp_send_log (module, sent_at DESC);

-- ── RLS: accessible only via service_role (Edge Functions) ───────────────────
ALTER TABLE whatsapp_send_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; explicit policy for admin queries
CREATE POLICY "admin_read_wslog" ON whatsapp_send_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Only service role may insert/update (Edge Functions)
CREATE POLICY "service_insert_wslog" ON whatsapp_send_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_update_wslog" ON whatsapp_send_log
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
