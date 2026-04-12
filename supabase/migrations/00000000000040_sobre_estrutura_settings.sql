-- Migration 040: Seed appearance + content settings for /sobre and /estrutura pages

-- Appearance: hero fields
INSERT INTO system_settings (id, category, key, value)
VALUES
  (gen_random_uuid(), 'appearance', 'sobre',
   '{"badge":"Conheça nossa história","title":"Sobre o Colégio Batista","highlight":"Batista","subtitle":"Mais de 20 anos formando cidadãos com excelência acadêmica e valores cristãos.","image":""}'::jsonb),
  (gen_random_uuid(), 'appearance', 'estrutura',
   '{"badge":"Conheça nossos espaços","title":"Nossa Estrutura","highlight":"Estrutura","subtitle":"Ambientes modernos e acolhedores projetados para o melhor aprendizado.","image":""}'::jsonb)
ON CONFLICT (category, key) DO NOTHING;

-- Content: dynamic sections
INSERT INTO system_settings (id, category, key, value)
VALUES
  (gen_random_uuid(), 'content', 'page_sobre',
   '{"historia_title":"Nossa História","historia_text":"","timeline":[],"mvv":[],"numeros_title":"Nossos Números","numeros":[],"diferenciais_title":"Nossos Diferenciais","diferenciais":[],"cta_title":"Venha Conhecer Nossa Escola","cta_subtitle":""}'::jsonb),
  (gen_random_uuid(), 'content', 'page_estrutura',
   '{"categories":[],"destaques_title":"Destaques da Estrutura","destaques":[],"cta_title":"Venha Conhecer Nossa Estrutura","cta_subtitle":""}'::jsonb)
ON CONFLICT (category, key) DO NOTHING;
