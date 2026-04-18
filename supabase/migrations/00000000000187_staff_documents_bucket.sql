-- 187: Fase 16 PR1 — Bucket `hr-documents` + tabela `staff_documents`
--
-- Documentos pessoais e trabalhistas dos colaboradores (RG, CPF,
-- contrato, diploma, etc). Bucket privado; acesso controlado por RLS
-- do módulo `rh-colaboradores`.
--
-- Path convention: hr-documents/{staff_id}/{uuid}.{ext}
-- CVs de candidatos (processo seletivo) ficam em um prefixo separado:
--   hr-documents/_recruitment/{application_id}/resume.pdf (PR2)

-- ============================================================
-- 1) Bucket privado
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-documents',
  'hr-documents',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Autenticados com perm no módulo podem ler/escrever via signed URL.
-- (Policies finas ficam na tabela staff_documents; aqui basta authenticated.)
DROP POLICY IF EXISTS "hr_docs_auth_read" ON storage.objects;
CREATE POLICY "hr_docs_auth_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hr-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "hr_docs_auth_insert" ON storage.objects;
CREATE POLICY "hr_docs_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hr-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "hr_docs_auth_update" ON storage.objects;
CREATE POLICY "hr_docs_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'hr-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "hr_docs_auth_delete" ON storage.objects;
CREATE POLICY "hr_docs_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'hr-documents' AND auth.role() = 'authenticated');

-- ============================================================
-- 2) Tabela staff_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL
                 CHECK (document_type IN (
                   'contrato','rg','cpf','comprovante_residencia',
                   'carteira_trabalho','diploma','outro'
                 )),
  file_path      TEXT NOT NULL,
  filename       TEXT NOT NULL,
  mime_type      TEXT,
  size_bytes     BIGINT,
  uploaded_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at     DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff ON staff_documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_type  ON staff_documents(document_type);

ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;

-- admin/super_admin ALL
CREATE POLICY "staff_documents_admin_all" ON staff_documents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
    )
  );

-- Outros: permissão por módulo rh-colaboradores
CREATE POLICY "staff_documents_select_by_perm" ON staff_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-colaboradores' AND ep.can_view = true
    )
    -- Self-service: próprio colaborador vê seus docs
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = staff_documents.staff_id AND s.profile_id = auth.uid()
    )
  );

CREATE POLICY "staff_documents_insert_by_perm" ON staff_documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-colaboradores' AND ep.can_edit = true
    )
  );

CREATE POLICY "staff_documents_delete_by_perm" ON staff_documents FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-colaboradores' AND ep.can_delete = true
    )
  );
