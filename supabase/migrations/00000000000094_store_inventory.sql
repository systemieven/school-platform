-- ── Phase 14: Store Inventory Movements ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_inventory_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id     UUID NOT NULL REFERENCES store_product_variants(id) ON DELETE CASCADE,
  type           TEXT NOT NULL
                 CHECK (type IN ('purchase','sale','return','adjustment','reservation_released')),
  quantity       INTEGER NOT NULL,   -- positive=entry, negative=exit
  balance_after  INTEGER NOT NULL,   -- snapshot of stock after movement
  reference_type TEXT CHECK (reference_type IN ('order','manual','pdv')),
  reference_id   UUID,
  justification  TEXT,
  recorded_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inv_movements_variant_id ON store_inventory_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type        ON store_inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inv_movements_ref         ON store_inventory_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created_at  ON store_inventory_movements(created_at);

-- RLS
ALTER TABLE store_inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_inventory_admin_all" ON store_inventory_movements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator', 'user')
    )
  );
