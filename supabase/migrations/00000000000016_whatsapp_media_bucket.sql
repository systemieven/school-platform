-- ============================================================================
-- Migration 00000000000016: Storage bucket for WhatsApp media
--
-- Creates a public bucket "whatsapp-media" for images, videos, documents and
-- audio files attached to WhatsApp message templates and manual sends.
-- Read: public (anon). Write: authenticated only.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  20971520,  -- 20 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4',
    'audio/mpeg', 'audio/ogg',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "wa_media_public_read" ON storage.objects;
CREATE POLICY "wa_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media');

-- Authenticated insert
DROP POLICY IF EXISTS "wa_media_auth_insert" ON storage.objects;
CREATE POLICY "wa_media_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

-- Authenticated update
DROP POLICY IF EXISTS "wa_media_auth_update" ON storage.objects;
CREATE POLICY "wa_media_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

-- Authenticated delete
DROP POLICY IF EXISTS "wa_media_auth_delete" ON storage.objects;
CREATE POLICY "wa_media_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');
