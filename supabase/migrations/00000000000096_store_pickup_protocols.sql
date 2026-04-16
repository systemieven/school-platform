-- ── Phase 14: Store Pickup Protocols ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_pickup_protocols (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL UNIQUE REFERENCES store_orders(id) ON DELETE CASCADE,
  signed_by_name      TEXT NOT NULL,
  signed_by_document  TEXT,
  signed_by_relation  TEXT,
  signed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  protocol_url        TEXT,
  protocol_path       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pickup_protocols_order_id ON store_pickup_protocols(order_id);

-- RLS
ALTER TABLE store_pickup_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pickup_protocols_admin_all" ON store_pickup_protocols
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator', 'user')
    )
  );

CREATE POLICY "pickup_protocols_guardian_read" ON store_pickup_protocols
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM store_orders o
      JOIN guardian_profiles gp ON gp.id = o.guardian_id
      WHERE gp.user_id = auth.uid()
    )
  );
