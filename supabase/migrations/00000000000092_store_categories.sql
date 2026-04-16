-- ── Phase 14: Store Categories ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  image_path  TEXT,
  parent_id   UUID REFERENCES store_categories(id) ON DELETE SET NULL,
  slug        TEXT UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_categories_parent_id  ON store_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_store_categories_slug        ON store_categories(slug);
CREATE INDEX IF NOT EXISTS idx_store_categories_is_active   ON store_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_store_categories_position    ON store_categories(position);

-- RLS
ALTER TABLE store_categories ENABLE ROW LEVEL SECURITY;

-- Public can view active categories
CREATE POLICY "store_categories_public_read" ON store_categories
  FOR SELECT USING (is_active = TRUE);

-- Admin / coordinator full access
CREATE POLICY "store_categories_admin_all" ON store_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator')
    )
  );
