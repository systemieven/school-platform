-- Migration 200 — appearance.loja seed
--
-- Adiciona row de `system_settings` para a aba Aparência → Loja (nova
-- sub-aba em /admin/configuracoes → Site → Aparência). A página pública
-- /loja agora consome este registro para renderizar o hero com slideshow
-- + fallback de vídeo, mesma estrutura usada pela Home.
--
-- Idempotente: ON CONFLICT DO NOTHING preserva qualquer ajuste já feito
-- por clientes que tenham populado a row manualmente antes desta migration.
-- A leitura anônima para category='appearance' já está liberada pela
-- migration 008, portanto nenhuma policy nova é necessária.

INSERT INTO system_settings (category, key, value) VALUES
(
  'appearance',
  'loja',
  '{
    "badge": "Nossa Loja",
    "title": "Uniformes e Material",
    "highlight": "Material",
    "subtitle": "Compre com praticidade e receba em casa.",
    "video_url": "",
    "scenes": [],
    "slideshow": {
      "default_duration": 8,
      "order": "sequential",
      "transition": "crossfade",
      "transition_duration": 1200
    }
  }'::jsonb
)
ON CONFLICT (category, key) DO NOTHING;
