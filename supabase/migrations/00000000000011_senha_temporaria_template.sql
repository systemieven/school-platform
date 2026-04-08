-- Seed WhatsApp template for temporary password / first access
INSERT INTO whatsapp_templates (
  name,
  category,
  message_type,
  content,
  variables,
  trigger_event,
  trigger_delay_minutes,
  is_active
)
VALUES (
  'senha_temporaria',
  'boas_vindas',
  'text',
  jsonb_build_object(
    'body',
    'Olá, {{user_name}}! 👋' || chr(10) || chr(10) ||
    'Seu acesso ao *Painel Administrativo* do Colégio Batista em Caruaru foi criado.' || chr(10) || chr(10) ||
    '🔑 *Senha temporária:* {{temp_password}}' || chr(10) || chr(10) ||
    '*Como acessar:*' || chr(10) ||
    '1. Acesse: {{system_url}}' || chr(10) ||
    '2. Entre com seu e-mail e a senha acima' || chr(10) ||
    '3. Você será solicitado(a) a criar uma nova senha no primeiro acesso' || chr(10) || chr(10) ||
    '_Esta senha é pessoal e intransferível. Não a compartilhe._'
  ),
  ARRAY['user_name', 'temp_password', 'system_url'],
  'on_create',
  0,
  true
)
ON CONFLICT DO NOTHING;
