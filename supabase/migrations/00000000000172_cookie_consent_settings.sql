-- Migration 172: Cookie consent banner settings
-- Adiciona a chave `branding.cookies` usada pelo <CookieConsentBanner/> no
-- site público. Fica em `branding` porque já tem política RLS de leitura anon.

INSERT INTO system_settings (category, key, value) VALUES
  ('branding', 'cookies', '{
    "enabled": true,
    "title": "Este site usa cookies",
    "message": "Utilizamos cookies para melhorar sua experiência, analisar o tráfego e personalizar conteúdo. Ao continuar navegando, você concorda com o uso destes cookies conforme descrito em nossa política.",
    "accept_label": "Aceitar",
    "decline_label": "Recusar",
    "policy_label": "Política de Privacidade",
    "policy_route": "/politica-privacidade",
    "pulse": true
  }'::jsonb)
ON CONFLICT (category, key) DO NOTHING;
