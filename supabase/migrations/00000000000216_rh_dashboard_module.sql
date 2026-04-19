-- 216: Modulo granular `rh-dashboard` para a aba Dashboard do RH.
--
-- A pagina-mae `RhPage` agrupa Dashboard / Colaboradores / Processo seletivo
-- como sub-tabs. A umbrella RH no sidebar fica visivel se o usuario tem view
-- em pelo menos uma das tres chaves (rh-dashboard, rh-colaboradores,
-- rh-seletivo) — coerente com o padrao usado em Gestao/Financeiro/Academico.
--
-- Idempotente em modules e role_permissions.

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES (
  'rh-dashboard',
  'RH — Dashboard',
  'Visao geral do modulo de RH (KPIs de colaboradores, vagas e pipeline)',
  'LayoutDashboard',
  'rh',
  299,
  true,
  ARRAY[]::text[]
)
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      "group" = EXCLUDED."group",
      is_active = true;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete)
VALUES
  ('super_admin', 'rh-dashboard', true, true,  true,  true),
  ('admin',       'rh-dashboard', true, false, false, false),
  ('coordinator', 'rh-dashboard', true, false, false, false)
ON CONFLICT (role, module_key) DO UPDATE
  SET can_view = EXCLUDED.can_view;
