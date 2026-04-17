-- Migration 131: múltiplos contatos de emergência em student_health_records
-- Adiciona coluna JSONB que armazena uma lista de contatos.
-- Os campos legados (emergency_contact_name/phone/rel) são mantidos para
-- compatibilidade reversa e alimentados sempre com o primeiro da lista.

ALTER TABLE student_health_records
  ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]'::jsonb;

-- Migra registros existentes: empacota os campos legados no novo array
UPDATE student_health_records
SET emergency_contacts = jsonb_build_array(
  jsonb_build_object(
    'name',  COALESCE(emergency_contact_name, ''),
    'phone', COALESCE(emergency_contact_phone, ''),
    'rel',   COALESCE(emergency_contact_rel, '')
  )
)
WHERE (emergency_contact_name IS NOT NULL OR emergency_contact_phone IS NOT NULL)
  AND (emergency_contacts IS NULL OR emergency_contacts = '[]'::jsonb);
