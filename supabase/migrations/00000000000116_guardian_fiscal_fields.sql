-- Migration 116: guardian_fiscal_fields — Fase 14.S
-- Dados fiscais do tomador no perfil do responsável + flag de completude

ALTER TABLE guardian_profiles
  ADD COLUMN IF NOT EXISTS cpf_cnpj             TEXT,
  ADD COLUMN IF NOT EXISTS tipo_pessoa          TEXT CHECK (tipo_pessoa IN ('fisica', 'juridica')),
  ADD COLUMN IF NOT EXISTS logradouro_fiscal    TEXT,
  ADD COLUMN IF NOT EXISTS numero_fiscal        TEXT,
  ADD COLUMN IF NOT EXISTS complemento_fiscal   TEXT,
  ADD COLUMN IF NOT EXISTS bairro_fiscal        TEXT,
  ADD COLUMN IF NOT EXISTS cep_fiscal           TEXT,
  ADD COLUMN IF NOT EXISTS municipio_fiscal     TEXT,
  ADD COLUMN IF NOT EXISTS uf_fiscal            TEXT,
  ADD COLUMN IF NOT EXISTS email_fiscal         TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_data_complete BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION calc_guardian_fiscal_data_complete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.fiscal_data_complete := (
    NEW.cpf_cnpj IS NOT NULL AND trim(NEW.cpf_cnpj) <> '' AND
    NEW.logradouro_fiscal IS NOT NULL AND trim(NEW.logradouro_fiscal) <> '' AND
    NEW.municipio_fiscal IS NOT NULL AND trim(NEW.municipio_fiscal) <> '' AND
    NEW.uf_fiscal IS NOT NULL AND trim(NEW.uf_fiscal) <> ''
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guardian_fiscal_complete
  BEFORE INSERT OR UPDATE ON guardian_profiles
  FOR EACH ROW EXECUTE FUNCTION calc_guardian_fiscal_data_complete();
