-- ============================================================
-- Vincular usuários a setores de atendimento
-- ============================================================

-- 1. Adicionar sector_keys ao perfil (array de chaves de motivos de visita)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sector_keys TEXT[] NOT NULL DEFAULT '{}';

-- 2. Setting de visibilidade de setores no módulo de atendimento
--    "all" = todos veem tudo (comportamento atual)
--    "restricted" = cada atendente vê apenas seus setores
INSERT INTO system_settings (category, key, value, description)
VALUES (
  'attendance',
  'sector_visibility_mode',
  '"all"',
  'Modo de visibilidade de setores: "all" (todos veem tudo) ou "restricted" (usuários veem apenas seus setores)'
)
ON CONFLICT (category, key) DO NOTHING;
