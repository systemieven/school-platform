-- ── Phase 14: Store Orders and Order Items ────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        TEXT NOT NULL UNIQUE,
  guardian_id         UUID REFERENCES guardian_profiles(id) ON DELETE SET NULL,
  student_id          UUID REFERENCES students(id) ON DELETE SET NULL,
  channel             TEXT NOT NULL DEFAULT 'store'
                      CHECK (channel IN ('store','pdv')),
  status              TEXT NOT NULL DEFAULT 'pending_payment'
                      CHECK (status IN (
                        'pending_payment','payment_confirmed','picking',
                        'ready_for_pickup','picked_up','completed','cancelled'
                      )),
  subtotal            NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method      TEXT,
  installments        INTEGER NOT NULL DEFAULT 1,
  gateway_charge_id   TEXT,
  notes               TEXT,
  cancellation_reason TEXT,
  cancelled_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cancelled_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_order_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  variant_id           UUID REFERENCES store_product_variants(id) ON DELETE SET NULL,
  product_name         TEXT NOT NULL,
  variant_description  TEXT,
  quantity             INTEGER NOT NULL DEFAULT 1,
  unit_price           NUMERIC(10,2) NOT NULL,
  total_price          NUMERIC(10,2) NOT NULL,
  returned_quantity    INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_orders_guardian_id   ON store_orders(guardian_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_student_id    ON store_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_status         ON store_orders(status);
CREATE INDEX IF NOT EXISTS idx_store_orders_channel        ON store_orders(channel);
CREATE INDEX IF NOT EXISTS idx_store_orders_created_at     ON store_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_store_order_items_order_id  ON store_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_variant   ON store_order_items(variant_id);

-- RLS
ALTER TABLE store_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_order_items  ENABLE ROW LEVEL SECURITY;

-- Admin / coordinator full access
CREATE POLICY "store_orders_admin_all" ON store_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator')
    )
  );

-- PDV user (role='user') can create and view
CREATE POLICY "store_orders_user_insert" ON store_orders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'user'
    )
  );

CREATE POLICY "store_orders_user_select" ON store_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'user'
    )
  );

-- Guardians can view their own orders
CREATE POLICY "store_orders_guardian_read" ON store_orders
  FOR SELECT USING (
    guardian_id IN (
      SELECT id FROM guardian_profiles WHERE user_id = auth.uid()
    )
  );

-- Order items follow orders
CREATE POLICY "store_order_items_admin_all" ON store_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator', 'user')
    )
  );

CREATE POLICY "store_order_items_guardian_read" ON store_order_items
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM store_orders o
      JOIN guardian_profiles gp ON gp.id = o.guardian_id
      WHERE gp.user_id = auth.uid()
    )
  );
