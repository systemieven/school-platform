-- Migration 119: nfse_permissions — Fase 14.S

INSERT INTO modules (key, label, description, icon, "group") VALUES
  ('nfse-emitidas', 'NFS-e Emitidas',  'Visualizacao e gestao de notas fiscais de servico emitidas', 'FileCheck2', 'fiscal'),
  ('nfse-config',   'Config NFS-e',    'Configuracao do emitente e integracao com provider NFS-e',   'Settings',   'configuracoes'),
  ('nfse-apuracao', 'Apuracao NFS-e',  'Resumo mensal de ISS e retencoes federais por periodo',      'BarChart3',  'fiscal')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete)
VALUES
  ('super_admin', 'nfse-emitidas', true, true,  true,  true),
  ('admin',       'nfse-emitidas', true, true,  true,  false),
  ('coordinator', 'nfse-emitidas', true, false, false, false),
  ('super_admin', 'nfse-config',   true, true,  true,  true),
  ('admin',       'nfse-config',   true, true,  true,  false),
  ('super_admin', 'nfse-apuracao', true, false, false, false),
  ('admin',       'nfse-apuracao', true, false, false, false),
  ('coordinator', 'nfse-apuracao', true, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;
