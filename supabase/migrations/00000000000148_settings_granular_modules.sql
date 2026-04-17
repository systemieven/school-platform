-- ============================================================================
-- 00000000000148_settings_granular_modules.sql
--
-- Decompõe o gate monolítico "settings" em 13 módulos granulares, um por aba
-- da página /admin/configuracoes. Antes desta migration, abas de configuração
-- eram gateadas pela chave do módulo subjacente (ex.: 'academico' liberava a
-- aba "Acadêmico" de Configurações). Consequência: qualquer usuário com
-- acesso ao módulo também configurava o módulo — exatamente o gap que quebra
-- a separação entre "usar" e "administrar".
--
-- Regra aplicada no seed: NENHUM role recebe grant por default além de
-- super_admin (que já passa via bypass em has_module_permission, mas é
-- semeado aqui por consistência/documentação). Admin/coordinator/teacher/user
-- não recebem nada — se a operação quer liberar um admin, faz via UI de
-- Permissões.
--
-- Idempotente: ON CONFLICT DO NOTHING nos modules; ON CONFLICT DO UPDATE
-- atualiza labels/descriptions caso rodem de novo.
-- ============================================================================

-- ── 1) Módulos ──────────────────────────────────────────────────────────────
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('settings-institutional', 'Configurações › Institucional',
     'Dados institucionais exibidos no site e documentos',
     'Building2', 'settings', 200, TRUE, ARRAY[]::TEXT[]),
  ('settings-academico', 'Configurações › Acadêmico',
     'Períodos letivos, fórmulas de média, alertas de frequência',
     'GraduationCap', 'settings', 201, TRUE, ARRAY[]::TEXT[]),
  ('settings-visits', 'Configurações › Agendamentos',
     'Motivos, horários e regras de agendamento de visitas',
     'CalendarCheck', 'settings', 202, TRUE, ARRAY[]::TEXT[]),
  ('settings-attendance', 'Configurações › Atendimentos',
     'Elegibilidade, senha, sons e tela do cliente de atendimento',
     'Ticket', 'settings', 203, TRUE, ARRAY[]::TEXT[]),
  ('settings-ferramentas', 'Configurações › Ferramentas',
     'Configurações de ferramentas (Achados e Perdidos, etc.)',
     'FileSearch', 'settings', 204, TRUE, ARRAY[]::TEXT[]),
  ('settings-fiscal', 'Configurações › Fiscal',
     'Dados do emitente, NF-e/NFS-e, perfis fiscais',
     'Receipt', 'settings', 205, TRUE, ARRAY[]::TEXT[]),
  ('settings-contact', 'Configurações › Formulário de Contato',
     'Motivos, campos e qualificação do formulário de contato',
     'MessageSquare', 'settings', 206, TRUE, ARRAY[]::TEXT[]),
  ('settings-financial', 'Configurações › Financeiro',
     'Gateways de pagamento, régua de cobrança, chave PIX',
     'DollarSign', 'settings', 207, TRUE, ARRAY[]::TEXT[]),
  ('settings-enrollment', 'Configurações › Pré-Matrícula',
     'Campos, documentos e regras do formulário de pré-matrícula',
     'GraduationCap', 'settings', 208, TRUE, ARRAY[]::TEXT[]),
  ('settings-notifications', 'Configurações › Notificações',
     'Alertas automáticos e templates de comunicação',
     'Bell', 'settings', 209, TRUE, ARRAY[]::TEXT[]),
  ('settings-security', 'Configurações › Segurança',
     'Critérios de senha, tempo de vida e reutilização',
     'Shield', 'settings', 210, TRUE, ARRAY[]::TEXT[]),
  ('settings-site', 'Configurações › Site',
     'Aparência, marca, navegação, conteúdo e SEO do site público',
     'Palette', 'settings', 211, TRUE, ARRAY[]::TEXT[]),
  ('settings-whatsapp', 'Configurações › WhatsApp',
     'Conexão com a API WhatsApp para envio de mensagens',
     'MessageCircle', 'settings', 212, TRUE, ARRAY[]::TEXT[])
ON CONFLICT (key) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      "group"     = EXCLUDED."group",
      position    = EXCLUDED.position;

-- ── 2) role_permissions ─────────────────────────────────────────────────────
-- Somente super_admin recebe grant explícito (redundante ao bypass, mas
-- documentativo). Qualquer outro role começa sem acesso e precisa ser
-- concedido pela UI de Permissões.
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
SELECT 'super_admin', k, TRUE, TRUE, TRUE, TRUE, FALSE
FROM (VALUES
  ('settings-institutional'),
  ('settings-academico'),
  ('settings-visits'),
  ('settings-attendance'),
  ('settings-ferramentas'),
  ('settings-fiscal'),
  ('settings-contact'),
  ('settings-financial'),
  ('settings-enrollment'),
  ('settings-notifications'),
  ('settings-security'),
  ('settings-site'),
  ('settings-whatsapp')
) AS t(k)
ON CONFLICT (role, module_key) DO NOTHING;

-- ── 3) Audit ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'permissions',
    'Aplicada migration 148 (13 módulos settings-* granulares; somente super_admin tem grant default)',
    jsonb_build_object('migration', '00000000000148_settings_granular_modules')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
