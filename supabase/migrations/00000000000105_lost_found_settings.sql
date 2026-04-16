-- Migration 105: lost_found_settings — default system_settings for Fase 15

INSERT INTO system_settings (category, key, value) VALUES
  ('general', 'lost_found_types',
   '["eletrônico","vestuário","acessório","material escolar","documento","calçado","bolsa/mochila","outro"]'::jsonb),
  ('general', 'lost_found_found_locations',
   '["sala de aula","corredor","pátio","quadra","banheiro","refeitório","portaria","outro"]'::jsonb),
  ('general', 'lost_found_storage_locations',
   '["secretaria","portaria","coordenação","outro"]'::jsonb),
  ('general', 'lost_found_discard_days', '30'::jsonb),
  ('general', 'lost_found_show_photo_on_portal', 'true'::jsonb)
ON CONFLICT (category, key) DO NOTHING;
