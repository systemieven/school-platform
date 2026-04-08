-- Seed WhatsApp template for password reset by admin
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
  'redefinicao_senha',
  'geral',
  'text',
  jsonb_build_object(
    'body',
    'Olá, {{user_name}}! 👋' || chr(10) || chr(10) ||
    'Sua senha de acesso ao *Painel Administrativo* do {{school_name}} foi redefinida por um administrador.' || chr(10) || chr(10) ||
    '🔑 *Nova senha temporária:* {{temp_password}}' || chr(10) || chr(10) ||
    '*Como acessar:*' || chr(10) ||
    '1. Acesse: {{system_url}}' || chr(10) ||
    '2. Entre com seu e-mail e a senha acima' || chr(10) ||
    '3. Você será solicitado(a) a criar uma nova senha no próximo acesso' || chr(10) || chr(10) ||
    '_Se você não solicitou esta alteração, entre em contato com o administrador imediatamente._' || chr(10) || chr(10) ||
    '_Esta senha é pessoal e intransferível. Não a compartilhe._'
  ),
  ARRAY['user_name', 'school_name', 'temp_password', 'system_url'],
  NULL,
  0,
  true
)
ON CONFLICT DO NOTHING;
