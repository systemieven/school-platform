-- Migration 60: Upload de contratos assinados
--  1) Bucket privado `financial-contracts` (PDF/DOC/DOCX)
--  2) Colunas signed_document_url + signed_document_path em financial_contracts

-- ============================================================================
-- 1) Bucket privado
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financial-contracts',
  'financial-contracts',
  false,
  20971520,  -- 20 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Autenticados podem ler (signed URL) / inserir / atualizar / deletar
DROP POLICY IF EXISTS "fin_contracts_auth_read" ON storage.objects;
CREATE POLICY "fin_contracts_auth_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'financial-contracts' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fin_contracts_auth_insert" ON storage.objects;
CREATE POLICY "fin_contracts_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'financial-contracts' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fin_contracts_auth_update" ON storage.objects;
CREATE POLICY "fin_contracts_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'financial-contracts' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fin_contracts_auth_delete" ON storage.objects;
CREATE POLICY "fin_contracts_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'financial-contracts' AND auth.role() = 'authenticated');

-- ============================================================================
-- 2) Colunas em financial_contracts
-- ============================================================================
ALTER TABLE financial_contracts
  ADD COLUMN IF NOT EXISTS signed_document_url  TEXT,
  ADD COLUMN IF NOT EXISTS signed_document_path TEXT;

COMMENT ON COLUMN financial_contracts.signed_document_url IS
  'URL publica/externa do contrato assinado. Quando o upload e feito no bucket financial-contracts, preenchido automaticamente. Aceita tambem link externo (DocuSign, Drive, etc.)';

COMMENT ON COLUMN financial_contracts.signed_document_path IS
  'Caminho do arquivo dentro do bucket financial-contracts quando o upload foi feito no Supabase (permite remover/substituir). NULL se for link externo.';
