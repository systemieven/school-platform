-- Migration 196: Conserta rotas inexistentes em system_settings.navigation
--
-- Bug: a migration 035 seedou navigation.topbar e navigation.footer com
-- /portal-aluno, /area-professor e /biblioteca-virtual. NENHUMA dessas
-- rotas existe em src/App.tsx — clicar caia no NotFound. As rotas reais
-- dos portais sao /portal/login, /responsavel/login e /professor/login;
-- biblioteca virtual nao existe como rota publica (a biblioteca vive
-- dentro do portal do responsavel/aluno autenticado).
--
-- Fix: jsonb_set substitui em massa os 3 paths quebrados pelos reais.
-- Nao mexe em links customizados pelo cliente que ja apontem para rotas
-- diferentes. Tambem nao mexe nos labels — admin pode renomear depois.

-- ── topbar.quick_links ─────────────────────────────────────────────────────
UPDATE system_settings
SET value = jsonb_set(
  value,
  '{quick_links}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN item->>'route' = '/portal-aluno'
            THEN jsonb_set(item, '{route}', '"/portal/login"')
          WHEN item->>'route' = '/area-professor'
            THEN jsonb_set(item, '{route}', '"/professor/login"')
          WHEN item->>'route' = '/biblioteca-virtual'
            THEN jsonb_set(item, '{route}', '"/responsavel/login"')
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
                  WHEN link->>'route' = '/portal-aluno'
                    THEN jsonb_set(link, '{route}', '"/portal/login"')
                  WHEN link->>'route' = '/area-professor'
                    THEN jsonb_set(link, '{route}', '"/professor/login"')
                  WHEN link->>'route' = '/biblioteca-virtual'
                    THEN jsonb_set(link, '{route}', '"/responsavel/login"')
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

COMMENT ON TABLE system_settings IS
  'Settings versionados. navigation.topbar/footer conserto de rotas em migration 196 (rotas /portal-aluno, /area-professor, /biblioteca-virtual nunca existiram em App.tsx).';
