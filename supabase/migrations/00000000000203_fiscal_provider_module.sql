-- Migration 203 — Fiscal provider: módulo granular + scope conta
--
-- 1. Cria o módulo granular `settings-fiscal-provider` para permitir que um
--    admin/super_admin controle quais perfis veem a aba "Provedor" em
--    Configurações → Fiscal (separado dos módulos NF-e/NFC-e/NFS-e).
-- 2. Amplia o default de `fiscal_provider_credentials.scopes` para incluir
--    `conta`, necessário para o endpoint GET /conta/cotas (dashboard de uso).

-- ── 1. Módulo + permissões padrão ───────────────────────────────────────────

INSERT INTO modules (key, label, description, "group", position, is_active) VALUES
  ('settings-fiscal-provider',
   'Configurações › Fiscal › Provedor',
   'Credenciais OAuth2 do provedor fiscal (Nuvem Fiscal) e painel de cotas',
   'settings',
   212,
   true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete) VALUES
  ('super_admin','settings-fiscal-provider', true, true,  true,  true),
  ('admin',      'settings-fiscal-provider', true, true,  true,  false)
ON CONFLICT (role, module_key) DO NOTHING;

-- ── 2. Atualiza default scope para incluir "conta" ──────────────────────────

ALTER TABLE fiscal_provider_credentials
  ALTER COLUMN scopes SET DEFAULT 'empresa nfe nfce nfse cnpj cep conta';

-- Retroativo: se já existe uma credencial salva sem o scope "conta", acrescenta.
UPDATE fiscal_provider_credentials
SET scopes = trim(scopes) || ' conta'
WHERE position('conta' IN scopes) = 0;
