-- Migration 103: lost_found_tables — Fase 15: Achados e Perdidos Digital

CREATE TABLE IF NOT EXISTS lost_found_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                TEXT NOT NULL,
  description         TEXT NOT NULL,
  photo_url           TEXT,
  found_location      TEXT NOT NULL,
  storage_location    TEXT NOT NULL,
  found_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available','claimed','delivered','discarded')),
  claimed_by_type     TEXT CHECK (claimed_by_type IN ('student','guardian')),
  claimed_by_id       UUID,
  claimed_at          TIMESTAMPTZ,
  claimed_portal      TEXT CHECK (claimed_portal IN ('student','guardian')),
  delivered_at        TIMESTAMPTZ,
  delivered_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  delivery_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  delivery_manual     BOOLEAN NOT NULL DEFAULT false,
  discarded_at        TIMESTAMPTZ,
  discard_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lost_found_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES lost_found_items(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('admin','student','guardian','system')),
  actor_id     UUID,
  actor_name   TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lfi_status    ON lost_found_items(status);
CREATE INDEX IF NOT EXISTS idx_lfi_type      ON lost_found_items(type);
CREATE INDEX IF NOT EXISTS idx_lfi_found_at  ON lost_found_items(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_lfe_item_id   ON lost_found_events(item_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_lost_found_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_lost_found_items_updated_at
  BEFORE UPDATE ON lost_found_items
  FOR EACH ROW EXECUTE FUNCTION update_lost_found_items_updated_at();

-- RLS
ALTER TABLE lost_found_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_found_events ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "lost_found_items_admin_all" ON lost_found_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role IN ('super_admin','admin','coordinator','user')
        AND ap.is_active = true
    )
  );

-- Portals: read available items only
CREATE POLICY "lost_found_items_portal_read" ON lost_found_items
  FOR SELECT USING (status = 'available');

-- Portals: update own claimed item (for claim action)
CREATE POLICY "lost_found_items_portal_claim" ON lost_found_items
  FOR UPDATE USING (status = 'available') WITH CHECK (status = 'claimed');

CREATE POLICY "lost_found_events_admin_all" ON lost_found_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role IN ('super_admin','admin','coordinator','user')
        AND ap.is_active = true
    )
  );

CREATE POLICY "lost_found_events_portal_read" ON lost_found_events
  FOR SELECT USING (true);
