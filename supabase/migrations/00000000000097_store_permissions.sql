-- ── Phase 14: Store Modules and Role Permissions ─────────────────────────────

-- Modules
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('store-products',  'Produtos',               'Cadastro de produtos e variantes',          'ShoppingBag',   'loja', 70, TRUE, NULL),
  ('store-inventory', 'Estoque',                'Movimentações e ajustes de estoque',         'Package',       'loja', 71, TRUE, NULL),
  ('store-orders',    'Pedidos',                'Pipeline de pedidos da loja',               'ClipboardList', 'loja', 72, TRUE, NULL),
  ('store-pdv',       'PDV',                    'Ponto de venda (caixa)',                    'Monitor',       'loja', 73, TRUE, NULL),
  ('store-reports',   'Relatórios de Loja',     'Relatórios e análises da loja',             'BarChart3',     'loja', 74, TRUE, NULL),
  ('store-settings',  'Config Loja',            'Configurações gerais da loja',              'Settings',      'loja', 75, TRUE, NULL),
  ('store-pdv-discount', 'Desconto no PDV',     'Permissão para aplicar desconto no PDV',    'Tag',           'loja', 76, TRUE, NULL)
ON CONFLICT (key) DO NOTHING;

-- super_admin: full TRUE on all 7 modules (import FALSE)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'store-products',     TRUE, TRUE, TRUE, TRUE, FALSE),
  ('super_admin', 'store-inventory',    TRUE, TRUE, TRUE, TRUE, FALSE),
  ('super_admin', 'store-orders',       TRUE, TRUE, TRUE, TRUE, FALSE),
  ('super_admin', 'store-pdv',          TRUE, TRUE, TRUE, TRUE, FALSE),
  ('super_admin', 'store-reports',      TRUE, TRUE, TRUE, TRUE, FALSE),
  ('super_admin', 'store-settings',     TRUE, TRUE, TRUE, TRUE, FALSE),
  ('super_admin', 'store-pdv-discount', TRUE, TRUE, TRUE, TRUE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- admin: full TRUE on all 7 modules (import FALSE)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('admin', 'store-products',     TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'store-inventory',    TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'store-orders',       TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'store-pdv',          TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'store-reports',      TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'store-settings',     TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'store-pdv-discount', TRUE, TRUE, TRUE, TRUE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- coordinator: products/inventory/orders/reports (view+create+edit, no delete/import), NO pdv/settings/pdv-discount
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('coordinator', 'store-products',  TRUE, TRUE, TRUE, FALSE, FALSE),
  ('coordinator', 'store-inventory', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('coordinator', 'store-orders',    TRUE, TRUE, TRUE, FALSE, FALSE),
  ('coordinator', 'store-reports',   TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- user (caixa): pdv (view+create+edit), orders (view only)
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('user', 'store-pdv',    TRUE, TRUE, TRUE, FALSE, FALSE),
  ('user', 'store-orders', TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;
