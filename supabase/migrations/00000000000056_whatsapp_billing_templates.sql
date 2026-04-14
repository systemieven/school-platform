-- Migration 56: Expandir trigger_events e seed templates WhatsApp financeiros

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
    'low_grade'
  ]));

INSERT INTO whatsapp_templates (name, category, message_type, content, variables, trigger_event, is_active) VALUES
(
  'Cobranca D-5 (lembrete pre-vencimento)',
  'financeiro',
  'text',
  '{"body": "Olá, {{guardian_name}}! 👋\n\nPassando para lembrar que a mensalidade do(a) {{student_name}} vence em 5 dias.\n\n📅 *Vencimento:* {{due_date}}\n💰 *Valor:* R$ {{amount}}\n📝 *Referência:* {{reference_month}}\n\nPagando até o vencimento você garante o desconto de pontualidade!\n\n{{payment_link}}\n\n_{{school_name}}_"}'::jsonb,
  ARRAY['guardian_name','student_name','due_date','amount','reference_month','payment_link','school_name']::TEXT[],
  'billing_d_minus_5',
  TRUE
),
(
  'Cobranca D+0 (vencimento hoje)',
  'financeiro',
  'text',
  '{"body": "Olá, {{guardian_name}}! 📌\n\nA mensalidade do(a) {{student_name}} vence *hoje*.\n\n📅 *Vencimento:* {{due_date}}\n💰 *Valor:* R$ {{amount}}\n📝 *Referência:* {{reference_month}}\n\nEfetue o pagamento hoje para evitar multa e juros:\n\n{{payment_link}}\n\n_{{school_name}}_"}'::jsonb,
  ARRAY['guardian_name','student_name','due_date','amount','reference_month','payment_link','school_name']::TEXT[],
  'billing_d_zero',
  TRUE
),
(
  'Cobranca D+3 (atraso leve)',
  'financeiro',
  'text',
  '{"body": "Olá, {{guardian_name}}. ⚠️\n\nIdentificamos que a mensalidade do(a) {{student_name}} está em atraso há 3 dias.\n\n📅 *Venceu em:* {{due_date}}\n💰 *Valor original:* R$ {{amount}}\n💰 *Valor atualizado:* R$ {{total_due}} (com multa e juros)\n📝 *Referência:* {{reference_month}}\n\nRegularize agora para evitar novos encargos:\n\n{{payment_link}}\n\nSe precisar de ajuda, responda esta mensagem.\n\n_{{school_name}}_"}'::jsonb,
  ARRAY['guardian_name','student_name','due_date','amount','total_due','reference_month','payment_link','school_name']::TEXT[],
  'billing_d_plus_3',
  TRUE
),
(
  'Cobranca D+10 (atraso moderado)',
  'financeiro',
  'text',
  '{"body": "Olá, {{guardian_name}}. 🚨\n\nA mensalidade do(a) {{student_name}} está em atraso há 10 dias.\n\n📅 *Venceu em:* {{due_date}}\n💰 *Valor atualizado:* R$ {{total_due}}\n📝 *Referência:* {{reference_month}}\n\nPedimos que regularize o quanto antes ou entre em contato com a secretaria para negociar.\n\n{{payment_link}}\n\nEstamos à disposição para ajudar.\n\n_{{school_name}}_"}'::jsonb,
  ARRAY['guardian_name','student_name','due_date','total_due','reference_month','payment_link','school_name']::TEXT[],
  'billing_d_plus_10',
  TRUE
),
(
  'Cobranca D+30 (atraso critico)',
  'financeiro',
  'text',
  '{"body": "Olá, {{guardian_name}}.\n\nA mensalidade do(a) {{student_name}}, referente a {{reference_month}}, está em atraso há 30 dias.\n\n💰 *Valor atualizado:* R$ {{total_due}}\n📅 *Venceu em:* {{due_date}}\n\nSolicitamos seu contato urgente com a secretaria para regularização ou acordo. A persistência do débito poderá impactar a matrícula do(a) aluno(a).\n\n📞 {{school_phone}}\n🔗 {{payment_link}}\n\n_{{school_name}}_"}'::jsonb,
  ARRAY['guardian_name','student_name','reference_month','total_due','due_date','payment_link','school_phone','school_name']::TEXT[],
  'billing_d_plus_30',
  TRUE
),
(
  'Confirmacao de pagamento',
  'financeiro',
  'text',
  '{"body": "Olá, {{guardian_name}}! ✅\n\nRecebemos o pagamento da mensalidade do(a) {{student_name}}.\n\n💰 *Valor pago:* R$ {{paid_amount}}\n📝 *Referência:* {{reference_month}}\n📅 *Data do pagamento:* {{paid_at}}\n\nObrigado pela pontualidade!\n\n_{{school_name}}_"}'::jsonb,
  ARRAY['guardian_name','student_name','paid_amount','reference_month','paid_at','school_name']::TEXT[],
  'payment_confirmed',
  TRUE
)
ON CONFLICT DO NOTHING;
