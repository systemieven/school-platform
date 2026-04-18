-- ============================================================================
-- 00000000000188_fiscal_granular_modules.sql
--
-- Quebra a aba Fiscal em 4 sub-abas com permissões independentes — refatora
-- também a UI: NF-e (Produtos) e NF-e (Emissão) viram uma única "NF-e", e
-- "Perfis Fiscais" sai do painel principal e ganha sub-aba própria.
--
-- Antes: a chave `settings-fiscal` libera o painel inteiro (todos os 4 cards
-- + drawer de perfis + integração com Nuvem Fiscal). Quem podia editar perfil
-- fiscal podia também rotacionar o token da API e mudar o ambiente p/ produção.
--
-- Agora: `settings-fiscal` continua gateando a aba (visibilidade), mas cada
-- sub-aba (`nfe`, `nfse`, `nfce`, `perfis`) tem chave própria. O time fiscal
-- ganha `settings-fiscal-perfis` para CRUD de modelos tributários sem tocar
-- nas integrações; a TI guarda `settings-fiscal-nfe/nfse/nfce` p/ provider.
--
-- Migração de grants: qualquer role que tinha `settings-fiscal` ganha as 4
-- chaves granulares (preserva acesso de quem já era admin do painel inteiro).
-- super_admin é semeado por consistência (já passa via bypass).
--
-- Idempotente.
-- ============================================================================

-- ── 1) Módulos granulares ──────────────────────────────────────────────────
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('settings-fiscal-nfe', 'Configurações › Fiscal › NF-e',
     'Dados do emitente + emissão NF-e + integração com provider',
     'FileText', 'settings', 213, TRUE, ARRAY['settings-fiscal']::TEXT[]),
  ('settings-fiscal-nfse', 'Configurações › Fiscal › NFS-e',
     'Configuração de emissão NFS-e (serviços) + certificado A1',
     'FileText', 'settings', 214, TRUE, ARRAY['settings-fiscal']::TEXT[]),
  ('settings-fiscal-nfce', 'Configurações › Fiscal › NFC-e',
     'Configuração de emissão NFC-e (consumidor final)',
     'FileText', 'settings', 215, TRUE, ARRAY['settings-fiscal']::TEXT[]),
  ('settings-fiscal-perfis', 'Configurações › Fiscal › Perfis Fiscais',
     'CRUD de perfis fiscais reutilizáveis (NCM, CST, CSOSN, alíquotas)',
     'Layers', 'settings', 216, TRUE, ARRAY['settings-fiscal']::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      "group"     = EXCLUDED."group",
      position    = EXCLUDED.position,
      depends_on  = EXCLUDED.depends_on;

-- ── 2) Grant default para super_admin (documentativo, redundante ao bypass)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
SELECT 'super_admin', k, TRUE, TRUE, TRUE, TRUE, FALSE
FROM (VALUES
  ('settings-fiscal-nfe'),
  ('settings-fiscal-nfse'),
  ('settings-fiscal-nfce'),
  ('settings-fiscal-perfis')
) AS t(k)
ON CONFLICT (role, module_key) DO NOTHING;

-- ── 3) Migra grants existentes de `settings-fiscal` p/ as 4 chaves granulares
-- Quem já tinha acesso ao painel inteiro continua com tudo aberto após o
-- refactor — admin opera a UI nova sem precisar reabrir permissões.
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
SELECT rp.role, child.k,
       rp.can_view, rp.can_create, rp.can_edit, rp.can_delete, rp.can_import
FROM role_permissions rp
CROSS JOIN (VALUES
  ('settings-fiscal-nfe'),
  ('settings-fiscal-nfse'),
  ('settings-fiscal-nfce'),
  ('settings-fiscal-perfis')
) AS child(k)
WHERE rp.module_key = 'settings-fiscal'
ON CONFLICT (role, module_key) DO NOTHING;

-- ── 4) Audit ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'permissions',
    'Aplicada migration 188 (4 módulos settings-fiscal-* granulares; grants existentes preservados)',
    jsonb_build_object('migration', '00000000000188_fiscal_granular_modules')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
