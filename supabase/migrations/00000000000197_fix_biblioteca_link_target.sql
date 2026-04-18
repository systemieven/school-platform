-- Migration 197: Corrige destino do link "Biblioteca Virtual" no navigation publico.
--
-- A migration 196 mapeou /biblioteca-virtual (rota inexistente) para
-- /responsavel/login. Errado: a biblioteca e feature do ALUNO, nao do
-- responsavel. A pagina /responsavel/biblioteca foi removida do codigo
-- nesta sprint (era redundante e usava library_items legado, enquanto o
-- portal do aluno usa library_resources). Destino correto: /portal/login.
--
-- Esta migration so atualiza linhas onde o label sugere biblioteca
-- (case-insensitive) E o route foi setado em /responsavel/login pela 196,
-- preservando customizacoes manuais que apontem para outros lugares.

-- ── topbar.quick_links ─────────────────────────────────────────────────────
UPDATE system_settings
SET value = jsonb_set(
  value,
  '{quick_links}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN item->>'route' = '/responsavel/login'
            AND lower(item->>'label') LIKE '%biblioteca%'
            THEN jsonb_set(item, '{route}', '"/portal/login"')
          ELSE item
        END
      )
      FROM jsonb_array_elements(value->'quick_links') AS item
    ),
    '[]'::jsonb
  )
)
WHERE category = 'navigation' AND key = 'topbar'
  AND value ? 'quick_links';

-- ── footer.columns[*].links ───────────────────────────────────────────────
UPDATE system_settings
SET value = jsonb_set(
  value,
  '{columns}',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_set(
          col,
          '{links}',
          COALESCE(
            (
              SELECT jsonb_agg(
                CASE
                  WHEN link->>'route' = '/responsavel/login'
                    AND lower(link->>'label') LIKE '%biblioteca%'
                    THEN jsonb_set(link, '{route}', '"/portal/login"')
                  ELSE link
                END
              )
              FROM jsonb_array_elements(col->'links') AS link
            ),
            '[]'::jsonb
          )
        )
      )
      FROM jsonb_array_elements(value->'columns') AS col
    ),
    '[]'::jsonb
  )
)
WHERE category = 'navigation' AND key = 'footer'
  AND value ? 'columns';
