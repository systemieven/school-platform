-- 211: Fase 16 PR3 — Módulo settings-rh + conteúdo default de /trabalhe-conosco
--
-- (210 reservada ao nfe_stock_ledger do módulo Financeiro.)
--
-- - Módulo granular `settings-rh` (grupo settings) para gatear a tela
--   /admin/configuracoes?tab=rh.
-- - INSERT default em `system_settings` key `content.careers` com textos
--   editáveis da página pública (whitelabel Fase 7).

-- ============================================================
-- 1) Módulo settings-rh
-- ============================================================
INSERT INTO modules (key, label, description, icon, "group", position)
VALUES ('settings-rh', 'Configurações › RH', 'Configuração do módulo RH e da página pública /trabalhe-conosco', 'Briefcase', 'settings', 215)
ON CONFLICT (key) DO NOTHING;

-- Defaults: só super_admin/admin.
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete)
VALUES
  ('super_admin', 'settings-rh', true, true, true, true),
  ('admin',       'settings-rh', true, true, true, false),
  ('coordinator', 'settings-rh', false, false, false, false),
  ('teacher',     'settings-rh', false, false, false, false),
  ('user',        'settings-rh', false, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;

-- ============================================================
-- 2) Default de content.careers (editável via Configurações › RH)
--    Uso: SELECT value FROM system_settings WHERE category='content' AND key='careers'.
--    Precisa ser legível pelo anon (página pública lê o conteúdo).
-- ============================================================

-- Amplia policy anônima para incluir `category='content'` (antes só
-- contact/visit/enrollment/general). Seguro: só leitura.
DROP POLICY IF EXISTS "Anon can read public settings" ON system_settings;
CREATE POLICY "Anon can read public settings" ON system_settings
  FOR SELECT
  USING (category IN ('contact','visit','enrollment','general','content'));

INSERT INTO system_settings (category, key, value, description)
VALUES (
  'content',
  'careers',
  jsonb_build_object(
    'hero_title', 'Trabalhe conosco',
    'hero_subtitle', 'Junte-se à nossa equipe e contribua com a formação da próxima geração.',
    'hero_image_url', null,
    'areas', jsonb_build_object(
      'pedagogica', jsonb_build_object(
        'label', 'Pedagógica',
        'description', 'Professores, coordenadores pedagógicos, monitores e auxiliares de sala.',
        'icon', 'GraduationCap'
      ),
      'administrativa', jsonb_build_object(
        'label', 'Administrativa',
        'description', 'Secretaria, financeiro, marketing, atendimento e áreas de apoio.',
        'icon', 'Briefcase'
      ),
      'servicos_gerais', jsonb_build_object(
        'label', 'Serviços Gerais',
        'description', 'Limpeza, manutenção, cozinha, portaria e demais serviços de infraestrutura.',
        'icon', 'Wrench'
      )
    ),
    'reserva_copy', 'Não encontrou uma vaga na sua área? Deixe seu currículo em nossa base reserva — entraremos em contato quando surgir uma oportunidade adequada.',
    'thank_you_title', 'Obrigado pela sua inscrição!',
    'thank_you_message', 'Recebemos seus dados e suas respostas. Nossa equipe de RH vai analisar seu perfil e entraremos em contato em breve.',
    'lgpd_consent_text', 'Autorizo o tratamento dos meus dados pessoais (incluindo CPF, RG e demais informações do currículo) para fins de processo seletivo e cadastro em base reserva, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).',
    'captcha_enabled', false,
    'rate_limit_per_hour', 10,
    'max_upload_mb', 5
  ),
  'Conteúdo customizável da página /trabalhe-conosco (PRD Fase 16 PR3).'
)
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'rh-seletivo',
        'Aplicada migration 211 (módulo settings-rh + default content.careers)');
