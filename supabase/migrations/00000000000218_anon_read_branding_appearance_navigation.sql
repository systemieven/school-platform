-- ============================================================
-- 218_anon_read_branding_appearance_navigation
--
-- Corrige bug critico: logo da instituicao e hero (imagem/video)
-- nao renderizavam no site publico porque o RLS de system_settings
-- so permitia leitura anonima em: contact, visit, enrollment, general, content.
--
-- BrandingContext carrega `branding.logos` + `branding.identity` + `branding.colors`
-- + `branding.fonts` + `navigation.cta`; paginas publicas (Home, segmentos,
-- Sobre, Estrutura, Contato, TrabalheConosco, Loja, Matricula, AgendarVisita)
-- carregam `appearance.*`. Todas essas queries retornavam [] para visitantes
-- nao autenticados, entao identity.logo_url='' (img src vazio → alt visivel)
-- e hero.image='' / scenes=[] (HeroMedia retorna null → so o gradient CSS).
--
-- Fix: amplia a policy anonima de SELECT para incluir branding, appearance
-- e navigation — todas leitura-only, conteudo destinado ao publico.
--
-- Mantem contact/visit/enrollment/general/content ja liberados em 211.
-- ============================================================

DROP POLICY IF EXISTS "Anon can read public settings" ON system_settings;
CREATE POLICY "Anon can read public settings" ON system_settings
  FOR SELECT
  USING (category IN (
    'contact',
    'visit',
    'enrollment',
    'general',
    'content',
    'branding',
    'appearance',
    'navigation'
  ));

-- ------------------------------------------------------------
-- Log
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'migration_log') THEN
    INSERT INTO migration_log (name, description)
    VALUES (
      '00000000000218_anon_read_branding_appearance_navigation',
      'Libera leitura anonima de system_settings para branding/appearance/navigation — corrige logo e hero que nao renderizavam no site publico.'
    );
  END IF;
END
$$;
