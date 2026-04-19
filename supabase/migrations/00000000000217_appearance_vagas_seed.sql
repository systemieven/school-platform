-- ============================================================
-- 217_appearance_vagas_seed
--
-- Seed da configuração de Hero da página /trabalhe-conosco
-- (sub-aba "Vagas" em /admin/configuracoes → Site → Aparência).
--
-- Garante que instalações novas e existentes tenham a linha
-- appearance.vagas mesmo antes do primeiro "Salvar" no admin —
-- assim o hero da página pública renderiza com badge + palavra
-- em destaque igual ao padrão das demais páginas.
--
-- Idempotente: ON CONFLICT DO NOTHING preserva customizações já
-- salvas pelo cliente.
-- ============================================================

INSERT INTO system_settings (category, key, value)
VALUES (
  'appearance',
  'vagas',
  jsonb_build_object(
    'badge',     'Oportunidades',
    'title',     'Trabalhe Conosco',
    'highlight', 'Conosco',
    'subtitle',  'Junte-se à nossa equipe e contribua com a formação da próxima geração.',
    'video_url', '',
    'scenes',    '[]'::jsonb,
    'slideshow', jsonb_build_object(
      'default_duration',    8,
      'order',               'sequential',
      'transition',          'crossfade',
      'transition_duration', 1200
    )
  )
)
ON CONFLICT (category, key) DO NOTHING;

-- ------------------------------------------------------------
-- Log
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'migration_log') THEN
    INSERT INTO migration_log (name, description)
    VALUES (
      '00000000000217_appearance_vagas_seed',
      'Seed de appearance.vagas (hero do /trabalhe-conosco) — badge, título, palavra em destaque e slideshow default.'
    );
  END IF;
END
$$;
