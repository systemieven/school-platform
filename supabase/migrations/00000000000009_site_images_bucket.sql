-- ============================================================================
-- Migration 00000000000009: Storage bucket for site images
--
-- Creates a public bucket "site-images" for hero backgrounds and segment card
-- images managed via the Aparência admin panel.
-- Read: public (anon). Write: authenticated only.
-- ============================================================================

-- Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-images',
  'site-images',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "site_images_public_read" ON storage.objects;
CREATE POLICY "site_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-images');

-- Authenticated insert
DROP POLICY IF EXISTS "site_images_auth_insert" ON storage.objects;
CREATE POLICY "site_images_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-images' AND auth.role() = 'authenticated');

-- Authenticated update
DROP POLICY IF EXISTS "site_images_auth_update" ON storage.objects;
CREATE POLICY "site_images_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-images' AND auth.role() = 'authenticated');

-- Authenticated delete
DROP POLICY IF EXISTS "site_images_auth_delete" ON storage.objects;
CREATE POLICY "site_images_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'site-images' AND auth.role() = 'authenticated');
