-- Migration: site_presets
-- Allows saving and restoring full site configuration snapshots

CREATE TABLE IF NOT EXISTS site_presets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  preset_data JSONB NOT NULL DEFAULT '{}',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES profiles(id)
);

ALTER TABLE site_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can read presets" ON site_presets
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage presets" ON site_presets
  FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin')));

-- Seed default preset from current system_settings
INSERT INTO site_presets (name, description, is_default, preset_data)
SELECT
  'Padrão Colégio Batista',
  'Configurações originais do site',
  true,
  jsonb_object_agg(
    category || '.' || key,
    value
  )
FROM system_settings
WHERE category IN ('appearance', 'branding', 'navigation', 'content');
