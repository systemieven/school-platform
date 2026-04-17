-- Migration 163: módulo granular `settings-ia` — Sprint 13 PR1
--
-- Adiciona módulo granular de permissão para a aba "IA" em Configurações,
-- seguindo o padrão da migration 148 (settings-*). Somente super_admin
-- recebe grant explícito; admins são liberados via UI de Permissões.

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('settings-ia', 'Configurações › IA',
     'Agentes de IA, prompts, providers e monitoramento de uso',
     'Brain', 'settings', 213, TRUE, ARRAY[]::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      "group"     = EXCLUDED."group",
      position    = EXCLUDED.position;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES ('super_admin', 'settings-ia', TRUE, TRUE, TRUE, TRUE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'permissions', 'Aplicada migration 163 (settings-ia module + super_admin grant)');
