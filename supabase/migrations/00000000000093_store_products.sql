-- ── Phase 14: Store Products, Variants and Images ────────────────────────────

CREATE TABLE IF NOT EXISTS store_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  short_description TEXT,
  description       TEXT,
  category_id       UUID REFERENCES store_categories(id) ON DELETE SET NULL,
  sku_base          TEXT,
  cost_price        NUMERIC(10,2),
  sale_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','out_of_stock','discontinued')),
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  is_digital        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_product_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  sku               TEXT NOT NULL UNIQUE,
  color             TEXT,
  size              TEXT,
  price_override    NUMERIC(10,2),
  stock_quantity    INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock         INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_product_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  variant_id   UUID REFERENCES store_product_variants(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  storage_path TEXT,
  alt_text     TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  is_cover     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_products_category_id  ON store_products(category_id);
CREATE INDEX IF NOT EXISTS idx_store_products_status        ON store_products(status);
CREATE INDEX IF NOT EXISTS idx_store_products_is_featured   ON store_products(is_featured);
CREATE INDEX IF NOT EXISTS idx_store_variants_product_id    ON store_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_store_variants_sku           ON store_product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_store_images_product_id      ON store_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_store_images_variant_id      ON store_product_images(variant_id);

-- RLS
ALTER TABLE store_products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_product_variants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_product_images    ENABLE ROW LEVEL SECURITY;

-- Public can view active products and their variants/images
CREATE POLICY "store_products_public_read" ON store_products
  FOR SELECT USING (status IN ('active','out_of_stock'));

CREATE POLICY "store_variants_public_read" ON store_product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM store_products sp
      WHERE sp.id = product_id AND sp.status IN ('active','out_of_stock')
    )
  );

CREATE POLICY "store_images_public_read" ON store_product_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM store_products sp
      WHERE sp.id = product_id AND sp.status IN ('active','out_of_stock')
    )
  );

-- Admin / coordinator full access
CREATE POLICY "store_products_admin_all" ON store_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator')
    )
  );

CREATE POLICY "store_variants_admin_all" ON store_product_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator')
    )
  );

CREATE POLICY "store_images_admin_all" ON store_product_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator')
    )
  );
