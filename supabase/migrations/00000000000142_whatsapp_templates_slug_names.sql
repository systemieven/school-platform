-- Migration 142: padroniza name de whatsapp_templates como slug imutável
-- Bug que motivou: alguém renomeou "senha_temporaria" → "Senha temporária" no
-- admin UI. Lookups por .eq('name', 'senha_temporaria') passaram a retornar
-- null, ativando fallback de texto puro e fazendo botões sumirem.
--
-- Solução em camadas:
--   1. Slugifica todos os nomes existentes (lowercase, sem acento, _ no lugar
--      de espaço/traço, sem caracteres especiais)
--   2. CHECK constraint força formato slug em qualquer INSERT/UPDATE futuro
--   3. Código (UsersPage.tsx + edge functions) referencia template por UUID
--      via constants em src/admin/lib/whatsappTemplateIds.ts
--   4. Form do TemplatesPage valida em tempo real e auto-converte input
--
-- O `name` agora funciona como SLUG/identificador estável. Para label visual
-- amigável seguimos usando `category` (já tem PT-BR) ou se precisar mais tarde
-- adicionamos uma coluna `display_label` separada.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── 1. Slugificar nomes existentes ───────────────────────────────────────────
UPDATE whatsapp_templates
SET name = regexp_replace(
  regexp_replace(
    lower(unaccent(name)),
    '[\s\-]+', '_', 'g'
  ),
  '[^a-z0-9_]', '', 'g'
);

-- ── 2. CHECK constraint: name deve ser slug puro ─────────────────────────────
ALTER TABLE whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_name_slug_format;

ALTER TABLE whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_name_slug_format
  CHECK (name ~ '^[a-z0-9_]+$');
