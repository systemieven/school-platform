-- Migration 100: Seed WhatsApp templates for store order pipeline (Phase 14)

-- 1a. Category
INSERT INTO whatsapp_template_categories (slug, label, color, variables, sort_order)
VALUES (
  'pedidos',
  'Pedidos da Loja',
  '#166534',
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total',
        'forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao'],
  80
) ON CONFLICT (slug) DO UPDATE SET
    label      = EXCLUDED.label,
    color      = EXCLUDED.color,
    variables  = EXCLUDED.variables;

-- 1b. Extend trigger_event constraint
ALTER TABLE whatsapp_templates DROP CONSTRAINT IF EXISTS whatsapp_templates_trigger_event_check;

ALTER TABLE whatsapp_templates ADD CONSTRAINT whatsapp_templates_trigger_event_check
  CHECK (trigger_event IS NULL OR trigger_event = ANY (ARRAY[
    'on_create',
    'on_status_change',
    'on_reminder',
    'billing_d_minus_5',
    'billing_d_minus_1',
    'billing_d_zero',
    'billing_d_plus_3',
    'billing_d_plus_10',
    'billing_d_plus_30',
    'payment_confirmed',
    'contract_activated',
    'scholarship_approved',
    'low_attendance',
    'low_grade',
    'order_pending_payment',
    'order_payment_confirmed',
    'order_picking',
    'order_ready_for_pickup',
    'order_picked_up',
    'order_completed',
    'order_cancelled',
    'order_payment_failed',
    'order_pickup_reminder'
  ]));

-- 1c. Insert 9 order templates
INSERT INTO whatsapp_templates (name, category, message_type, content, variables, trigger_event, is_active) VALUES
(
  'Pedido Recebido',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}! 🛍️\n\nSeu pedido *{{numero_pedido}}* foi recebido e está aguardando confirmação de pagamento.\n\n👤 *Aluno:* {{nome_aluno}}\n📦 *Itens:* {{itens_resumo}}\n💰 *Total:* {{valor_total}}\n💳 *Pagamento:* {{forma_pagamento}}\n📅 *Data:* {{data_pedido}}\n\nAssim que o pagamento for confirmado, você receberá uma nova mensagem.\n\n{{link_pedido}}\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_pending_payment',
  TRUE
),
(
  'Pagamento Confirmado',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}! ✅\n\nO pagamento do pedido *{{numero_pedido}}* foi confirmado!\n\n👤 *Aluno:* {{nome_aluno}}\n📦 *Itens:* {{itens_resumo}}\n💰 *Valor:* {{valor_total}}\n\nEstamos separando os itens. Você será avisado quando estiver pronto para retirada.\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_payment_confirmed',
  TRUE
),
(
  'Pedido em Separação',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}! 📦\n\nO pedido *{{numero_pedido}}* está sendo separado pela equipe da loja.\n\n👤 *Aluno:* {{nome_aluno}}\n📦 *Itens:* {{itens_resumo}}\n\nEm breve você será notificado quando estiver pronto para retirada.\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_picking',
  TRUE
),
(
  'Pronto para Retirada',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}! 🎉\n\nO pedido *{{numero_pedido}}* está *pronto para retirada*!\n\n👤 *Aluno:* {{nome_aluno}}\n📦 *Itens:* {{itens_resumo}}\n🏫 *Previsão de retirada:* {{previsao_retirada}}\n\nDirija-se à secretaria para efetuar a retirada mediante apresentação de documento.\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_ready_for_pickup',
  TRUE
),
(
  'Lembrete de Retirada',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}! ⏰\n\nLembrete: o pedido *{{numero_pedido}}* ainda aguarda retirada.\n\n👤 *Aluno:* {{nome_aluno}}\n📦 *Itens:* {{itens_resumo}}\n🏫 *Previsão:* {{previsao_retirada}}\n\nPasse na secretaria para retirar. Em caso de dúvidas, entre em contato.\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_pickup_reminder',
  TRUE
),
(
  'Pedido Retirado',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}! 🏆\n\nO pedido *{{numero_pedido}}* foi retirado com sucesso!\n\n👤 *Aluno:* {{nome_aluno}}\n📦 *Itens:* {{itens_resumo}}\n\nObrigado pela confiança. Qualquer dúvida, estamos à disposição.\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_picked_up',
  TRUE
),
(
  'Pedido Concluído',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}! ⭐\n\nO pedido *{{numero_pedido}}* foi concluído com sucesso!\n\n👤 *Aluno:* {{nome_aluno}}\n💰 *Total:* {{valor_total}}\n\nEsperamos que os itens atendam às expectativas. Até a próxima!\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_completed',
  TRUE
),
(
  'Pedido Cancelado',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}. ❌\n\nInformamos que o pedido *{{numero_pedido}}* foi cancelado.\n\n👤 *Aluno:* {{nome_aluno}}\n📦 *Itens:* {{itens_resumo}}\n💰 *Valor:* {{valor_total}}\n\nEm caso de dúvidas, entre em contato com a secretaria.\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_cancelled',
  TRUE
),
(
  'Pagamento não Confirmado',
  'pedidos',
  'text',
  '{"body": "Olá, {{nome_responsavel}}. ⚠️\n\nO pagamento do pedido *{{numero_pedido}}* não foi confirmado ou o link expirou.\n\n👤 *Aluno:* {{nome_aluno}}\n💰 *Valor:* {{valor_total}}\n\nPara gerar um novo link de pagamento, entre em contato com a secretaria.\n\n_{{instituicao}}_"}'::jsonb,
  ARRAY['numero_pedido','nome_responsavel','nome_aluno','itens_resumo','valor_total','forma_pagamento','data_pedido','previsao_retirada','link_pedido','instituicao']::TEXT[],
  'order_payment_failed',
  TRUE
)
ON CONFLICT DO NOTHING;
