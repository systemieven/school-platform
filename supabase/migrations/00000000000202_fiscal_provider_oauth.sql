-- Migration 202 — Fiscal provider OAuth2 (Nuvem Fiscal client_credentials)
--
-- A Nuvem Fiscal usa OAuth2 client_credentials: o bearer token é obtido a
-- partir de um par (client_id, client_secret) trocado em
-- https://auth.nuvemfiscal.com.br/oauth/token e vale por 30 dias.
--
-- 1. `fiscal_provider_credentials` (singleton) — credenciais + ambiente.
-- 2. `fiscal_provider_token_cache` — último access_token emitido + expira em.
-- 3. As colunas `api_token_enc` em `company_nfe_config`, `company_nfce_config`
--    e `company_nfse_config` ficam como DEPRECATED (nullable; podemos dropar
--    em uma migration futura quando o novo fluxo estiver estável).
--
-- As credenciais são plaintext na coluna `*_enc` seguindo o mesmo padrão que
-- o projeto já usa para token/certificado. Melhoria futura: Supabase Vault.

-- ── 1. Tabela de credenciais ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fiscal_provider_credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL DEFAULT 'nuvem_fiscal',
  client_id     text NOT NULL,
  client_secret_enc text NOT NULL,
  environment   text NOT NULL DEFAULT 'sandbox'
                CHECK (environment IN ('sandbox', 'production')),
  scopes        text NOT NULL DEFAULT 'empresa nfe nfce nfse cnpj cep',
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_provider_credentials_provider_unique UNIQUE (provider)
);

COMMENT ON TABLE  fiscal_provider_credentials IS
  'Credenciais OAuth2 do provedor fiscal (client_credentials). Singleton por provider.';
COMMENT ON COLUMN fiscal_provider_credentials.client_secret_enc IS
  'Plaintext (por ora). Melhoria futura: Vault.';
COMMENT ON COLUMN fiscal_provider_credentials.environment IS
  'sandbox = https://api.sandbox.nuvemfiscal.com.br · production = https://api.nuvemfiscal.com.br';

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiscal_provider_credentials_updated_at ON fiscal_provider_credentials;
CREATE TRIGGER trg_fiscal_provider_credentials_updated_at
  BEFORE UPDATE ON fiscal_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS — só admin/super_admin veem/mexem
ALTER TABLE fiscal_provider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_provider_credentials_read ON fiscal_provider_credentials;
CREATE POLICY fiscal_provider_credentials_read
  ON fiscal_provider_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS fiscal_provider_credentials_write ON fiscal_provider_credentials;
CREATE POLICY fiscal_provider_credentials_write
  ON fiscal_provider_credentials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ── 2. Cache de token ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fiscal_provider_token_cache (
  provider      text PRIMARY KEY DEFAULT 'nuvem_fiscal',
  environment   text NOT NULL,
  access_token  text NOT NULL,
  token_type    text NOT NULL DEFAULT 'bearer',
  expires_at    timestamptz NOT NULL,
  refreshed_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE fiscal_provider_token_cache IS
  'Cache do bearer token OAuth2 do provedor. Atualizado pelo helper em cada token exchange.';

ALTER TABLE fiscal_provider_token_cache ENABLE ROW LEVEL SECURITY;

-- Sem policy SELECT/INSERT/UPDATE para usuários — só service_role acessa.
-- (Edge functions com service_role bypassam RLS.)

-- ── 3. Marcar colunas api_token_enc como DEPRECATED ─────────────────────────

COMMENT ON COLUMN company_nfe_config.api_token_enc IS
  'DEPRECATED (migration 202). Autenticação agora via fiscal_provider_credentials (OAuth2 client_credentials).';
COMMENT ON COLUMN company_nfce_config.api_token_enc IS
  'DEPRECATED (migration 202). Autenticação agora via fiscal_provider_credentials (OAuth2 client_credentials).';
COMMENT ON COLUMN company_nfse_config.api_token_enc IS
  'DEPRECATED (migration 202). Autenticação agora via fiscal_provider_credentials (OAuth2 client_credentials).';

-- Torna nullable (se ainda for NOT NULL em algum caso — defensivo)
ALTER TABLE company_nfe_config  ALTER COLUMN api_token_enc DROP NOT NULL;
ALTER TABLE company_nfce_config ALTER COLUMN api_token_enc DROP NOT NULL;
ALTER TABLE company_nfse_config ALTER COLUMN api_token_enc DROP NOT NULL;

-- ── 4. Módulo granular settings-fiscal-provider ─────────────────────────────
-- (usa as chaves já existentes — nada a fazer, panel entra em settings-fiscal)
