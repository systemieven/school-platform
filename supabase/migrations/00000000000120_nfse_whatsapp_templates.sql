-- Migration 120: nfse_whatsapp_templates — Fase 14.S

INSERT INTO whatsapp_template_categories (slug, label, color, sort_order)
VALUES ('fiscal', 'Fiscal', '#166534', 100)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO whatsapp_templates (name, category, message_type, content, variables, is_active)
VALUES
  (
    'nfse_autorizada',
    'fiscal',
    'text',
    '{"body": "Ola {{responsavel_nome}}, sua Nota Fiscal de Servico n {{numero_nfse}} referente a {{mes_referencia}} foi emitida. Valor: {{valor_servico}}. Acesse: {{link_nfse}}"}'::jsonb,
    ARRAY['responsavel_nome', 'numero_nfse', 'mes_referencia', 'valor_servico', 'link_nfse'],
    true
  ),
  (
    'nfse_cancelada',
    'fiscal',
    'text',
    '{"body": "Ola {{responsavel_nome}}, a Nota Fiscal de Servico n {{numero_nfse}} foi cancelada. Em caso de duvidas, entre em contato conosco."}'::jsonb,
    ARRAY['responsavel_nome', 'numero_nfse'],
    true
  )
ON CONFLICT DO NOTHING;
