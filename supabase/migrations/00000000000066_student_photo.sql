-- Migration 66: Student photo column + storage bucket
-- Adds a dedicated photo_url to the students table (separate from document_urls
-- which holds multi-doc attachments). The student-photos bucket is public so the
-- admin UI and the future StudentDetailPage can display photos without signed URLs.

ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ── Storage bucket ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── Policies ────────────────────────────────────────────────────────────────

-- Anyone (including anon) can read student photos
CREATE POLICY "student_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos');

-- Authenticated users (admin/coordinator) can upload
CREATE POLICY "student_photos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'student-photos');

-- Authenticated users can replace (upsert)
CREATE POLICY "student_photos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'student-photos');

-- Authenticated users can delete
CREATE POLICY "student_photos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'student-photos');
