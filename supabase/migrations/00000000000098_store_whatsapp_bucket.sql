-- ── Phase 14: WhatsApp category + product-images storage bucket ──────────────

-- WhatsApp category for store orders
INSERT INTO whatsapp_categories (key, label, color)
VALUES ('pedidos', 'Pedidos da Loja', '#166534')
ON CONFLICT DO NOTHING;

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for product-images bucket
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "product_images_admin_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator')
    )
  );

CREATE POLICY "product_images_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator')
    )
  );

CREATE POLICY "product_images_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'coordinator')
    )
  );
