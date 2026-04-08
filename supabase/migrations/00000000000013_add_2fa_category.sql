-- Adiciona categoria 2fa ao constraint de categorias de templates
ALTER TABLE whatsapp_templates
  DROP CONSTRAINT whatsapp_templates_category_check;

ALTER TABLE whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_category_check
  CHECK (category = ANY (ARRAY[
    'agendamento'::text,
    'matricula'::text,
    'contato'::text,
    'geral'::text,
    'boas_vindas'::text,
    '2fa'::text
  ]));

-- Move templates de senha para a categoria 2fa
UPDATE whatsapp_templates
  SET category = '2fa'
  WHERE name IN ('senha_temporaria', 'redefinicao_senha');
