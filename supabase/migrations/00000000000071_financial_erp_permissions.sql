-- Migration 71: Permissões para os novos módulos da Fase 8.5
-- Módulos: plano de contas, caixas, A/R geral, A/P, relatórios avançados

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Novos módulos no registro de módulos
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on) VALUES
  ('financial-account-categories',
    'Plano de Contas',
    'Categorias hierárquicas de receitas e despesas para classificação de lançamentos',
    'Layers',         'financeiro', 29, TRUE, ARRAY['financial']),
  ('financial-cash',
    'Caixas',
    'Controle de múltiplos caixas: abertura, fechamento, sangria, suprimento e lançamentos',
    'Vault',          'financeiro', 30, TRUE, ARRAY['financial']),
  ('financial-receivables',
    'Contas a Receber',
    'Contas a receber gerais (taxas, eventos, matrículas e avulsos)',
    'TrendingUp',     'financeiro', 31, TRUE, ARRAY['financial']),
  ('financial-payables',
    'Contas a Pagar',
    'Contas a pagar com classificação de despesas fixas e variáveis',
    'TrendingDown',   'financeiro', 32, TRUE, ARRAY['financial']),
  ('financial-reports-advanced',
    'Relatórios Financeiros Avançados',
    'Fluxo de caixa, DRE simplificado, inadimplência, previsão e extrato por categoria',
    'BarChart3',      'financeiro', 33, TRUE, ARRAY['financial'])
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Permissões default por role
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import) VALUES
  -- Admin: acesso total
  ('admin', 'financial-account-categories', TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin', 'financial-cash',               TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin', 'financial-receivables',        TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin', 'financial-payables',           TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin', 'financial-reports-advanced',   TRUE, FALSE, FALSE, FALSE, FALSE),

  -- Coordinator: somente leitura (exceto caixas — operação sensível)
  ('coordinator', 'financial-account-categories', TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-cash',               FALSE, FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-receivables',        TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-payables',           TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-reports-advanced',   TRUE,  FALSE, FALSE, FALSE, FALSE),

  -- Teacher: sem acesso
  ('teacher', 'financial-account-categories', FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'financial-cash',               FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'financial-receivables',        FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'financial-payables',           FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'financial-reports-advanced',   FALSE, FALSE, FALSE, FALSE, FALSE),

  -- User: sem acesso
  ('user', 'financial-account-categories', FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial-cash',               FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial-receivables',        FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial-payables',           FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial-reports-advanced',   FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;
