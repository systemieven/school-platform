-- Migration 198 — remove_professor_login_from_nav
--
-- Remove entradas apontando para /professor/login das arrays de navegação
-- em system_settings (topbar.quick_links e footer.columns[*].links).
--
-- Contexto: o Portal do Professor (/professor/*) foi eliminado e integrado
-- ao /admin/area-professor. A rota /professor/login não existe mais —
-- preserva demais customizações de label/icon em cada link.
--
-- Idempotente: filtrar por route != '/professor/login' não altera linhas
-- que já estejam limpas.

-- ── Topbar ────────────────────────────────────────────────────────────────

UPDATE system_settings
SET value = jsonb_set(
  value,
  '{quick_links}',
  COALESCE(
    (
      SELECT jsonb_agg(item)
      FROM jsonb_array_elements(value->'quick_links') AS item
      WHERE item->>'route' IS DISTINCT FROM '/professor/login'
    ),
    '[]'::jsonb
  )
),
    updated_at = NOW()
WHERE category = 'navigation'
  AND key = 'topbar'
  AND value ? 'quick_links';

-- ── Footer columns[*].links ───────────────────────────────────────────────

UPDATE system_settings
SET value = jsonb_set(
  value,
  '{columns}',
  (
    SELECT jsonb_agg(
      jsonb_set(
        col,
        '{links}',
        COALESCE(
          (
            SELECT jsonb_agg(link)
            FROM jsonb_array_elements(col->'links') AS link
            WHERE link->>'route' IS DISTINCT FROM '/professor/login'
          ),
          '[]'::jsonb
        )
      )
    )
    FROM jsonb_array_elements(value->'columns') AS col
  )
),
    updated_at = NOW()
WHERE category = 'navigation'
  AND key = 'footer'
  AND value ? 'columns';
