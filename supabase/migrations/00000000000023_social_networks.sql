-- Add social_networks setting with default values (Instagram, WhatsApp, Facebook)
INSERT INTO system_settings (key, value, category, description)
VALUES (
  'social_networks',
  '[{"id":1,"network":"instagram","handle":"colegiobatistacaruarupe"},{"id":2,"network":"whatsapp","handle":"5581991398203","message":"Olá, vim do site e queria mais informações"},{"id":3,"network":"facebook","handle":"colegiobatistacaruarupe"}]',
  'general',
  'Redes sociais da instituição'
)
ON CONFLICT (category, key) DO NOTHING;
