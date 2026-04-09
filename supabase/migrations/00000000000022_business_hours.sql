-- Add business_hours setting (Mon–Fri 07:00–17:00, weekends closed by default)
INSERT INTO system_settings (key, value, category, description)
VALUES (
  'business_hours',
  '{"0":{"open":false,"start":"07:00","end":"17:00"},"1":{"open":true,"start":"07:00","end":"17:00"},"2":{"open":true,"start":"07:00","end":"17:00"},"3":{"open":true,"start":"07:00","end":"17:00"},"4":{"open":true,"start":"07:00","end":"17:00"},"5":{"open":true,"start":"07:00","end":"17:00"},"6":{"open":false,"start":"07:00","end":"17:00"}}',
  'general',
  'Horário de funcionamento por dia da semana'
)
ON CONFLICT (category, key) DO NOTHING;
