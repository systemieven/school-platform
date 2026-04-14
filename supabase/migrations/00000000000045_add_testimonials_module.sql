-- Migration 45: Adicionar testimonials ao seed de modules
-- Motivo: O modulo testimonials existe no sidebar e na navegacao,
-- mas nao foi incluido na tabela modules (migration 26).
-- Isso impede que ele seja controlado via PermissionsPage e ModuleGuard.

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES (
  'testimonials',
  'Depoimentos',
  'Gerenciamento de depoimentos do site (aprovacao, edicao, exclusao)',
  'MessageSquareQuote',
  'escola',
  14,
  TRUE,
  '{}'
)
ON CONFLICT (key) DO NOTHING;

-- Adicionar permissoes default para roles existentes
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('admin',       'testimonials', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'testimonials', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('teacher',     'testimonials', TRUE, FALSE, FALSE, FALSE, FALSE),
  ('user',        'testimonials', FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;
