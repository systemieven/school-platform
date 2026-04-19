-- Notificações automáticas para o pipeline de RH.
--
-- Hoje o admin move um candidato em `job_applications.stage` e nada é enviado.
-- Esta migration liga a infra de auto-notify (trigger → pg_net → edge function
-- `auto-notify` → UazAPI) também ao módulo `rh-seletivo`, com dedup por stage
-- (coluna `notified_stages`).
--
-- Escopo: 4 transições — entrevista, proposta, contratado, descartado.
-- `novo`/`triagem` seguem silenciosos (IA de triagem já faz o trabalho).

-- ── 1) Categoria `rh-seletivo` em whatsapp_templates ────────────────────────

ALTER TABLE whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_category_check;

ALTER TABLE whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_category_check
  CHECK (category IN (
    'agendamento','matricula','contato','geral','boas_vindas',
    '2fa','academico','financeiro','fiscal','pedidos','rh-seletivo'
  ));

-- ── 2) Dedup por stage em job_applications ──────────────────────────────────

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS notified_stages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN job_applications.notified_stages IS
  'Stages cujo template de notificação já disparou. Evita re-envio ao voltar/avançar de novo o candidato. Limpar manualmente para forçar re-envio.';

-- ── 3a) Seed: URL pública do site (fallback quando env SITE_URL não existir) ─

INSERT INTO system_settings (category, key, value, description)
VALUES (
  'general',
  'site_url',
  '""'::jsonb,
  'URL pública do site institucional (sem trailing slash). Usada em templates (/agendar-visita, /trabalhe-conosco). Cada cliente preenche em /admin/configuracoes.'
)
ON CONFLICT (category, key) DO NOTHING;

-- ── 3b) Seed: documentos para efetivar contratação ──────────────────────────

INSERT INTO system_settings (category, key, value, description)
VALUES (
  'hr',
  'required_docs',
  '["RG e CPF (originais + cópia)","Carteira de trabalho","Comprovante de residência","Título de eleitor","PIS/PASEP","1 foto 3x4","Diploma ou certificado de escolaridade","Atestado de antecedentes criminais"]'::jsonb,
  'Lista de documentos solicitados no template de boas-vindas ao contratado.'
)
ON CONFLICT (category, key) DO NOTHING;

-- ── 4) Trigger: dispara auto-notify + marca stage como notificado ──────────

CREATE OR REPLACE FUNCTION notify_on_rh_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret TEXT;
  v_url    TEXT;
BEGIN
  -- Só dispara se stage realmente mudou.
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    RETURN NEW;
  END IF;

  -- Só os 4 estágios com template.
  IF NEW.stage NOT IN ('entrevista','proposta','contratado','descartado') THEN
    RETURN NEW;
  END IF;

  -- Idempotência: se já notificou esse stage, pula (e preserva array).
  IF NEW.stage = ANY(NEW.notified_stages) THEN
    RETURN NEW;
  END IF;

  SELECT value #>> '{}' INTO v_secret
    FROM system_settings
    WHERE category = 'internal' AND key = 'trigger_secret';

  IF v_secret IS NULL THEN
    RAISE NOTICE '[rh-notify] trigger_secret ausente — pulando';
    RETURN NEW;
  END IF;

  v_url := current_setting('app.settings.supabase_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://dinbwugbwnkrzljuocbs.supabase.co';
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/auto-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-trigger-secret', v_secret
    ),
    body := jsonb_build_object(
      'event',      'on_status_change',
      'module',     'rh-seletivo',
      'record_id',  NEW.id::TEXT,
      'old_status', OLD.stage,
      'new_status', NEW.stage
    )
  );

  -- Marca como notificado (BEFORE UPDATE → mesma transação, sem 2ª UPDATE).
  NEW.notified_stages := array_append(NEW.notified_stages, NEW.stage);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_rh_stage_change ON job_applications;

CREATE TRIGGER trg_notify_on_rh_stage_change
  BEFORE UPDATE OF stage ON job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_on_rh_stage_change();

-- ── 4b) Categoria dinâmica no catálogo (exibida na UI de templates) ────────

INSERT INTO whatsapp_template_categories (slug, label, color, variables, sort_order)
VALUES (
  'rh-seletivo', 'RH — Seleção', 'indigo',
  ARRAY[
    'candidate_name','candidate_first_name','job_title','job_area',
    'school_name','business_hours_text','schedule_url','careers_url','required_docs_list'
  ],
  7
)
ON CONFLICT (slug) DO NOTHING;

-- ── 5) Seed dos 4 templates ────────────────────────────────────────────────

INSERT INTO whatsapp_templates (name, category, message_type, content, variables, trigger_event, trigger_conditions, is_active)
VALUES
(
  'rh_stage_entrevista',
  'rh-seletivo',
  'text',
  '{"body":"Olá, {{candidate_first_name}}! 🎉\n\nSeu currículo para a vaga de *{{job_title}}* foi aprovado na triagem e você avançou para a etapa de *entrevista* com a equipe da {{school_name}}.\n\nAgende seu horário neste link:\n{{schedule_url}}\n\nSelecione o motivo relacionado ao RH e escolha o melhor dia/horário dentro da nossa disponibilidade.\n\nQualquer dúvida, é só responder por aqui. 🙌"}'::jsonb,
  ARRAY['candidate_first_name','job_title','school_name','schedule_url']::TEXT[],
  'on_status_change',
  '{"status":"entrevista"}'::jsonb,
  TRUE
),
(
  'rh_stage_proposta',
  'rh-seletivo',
  'text',
  '{"body":"Olá, {{candidate_first_name}}!\n\nTemos uma ótima notícia: queremos conversar com você sobre uma *proposta* para a vaga de *{{job_title}}*.\n\nPor favor, compareça à {{school_name}} em nosso horário de atendimento:\n{{business_hours_text}}\n\nLeve um documento com foto. Estamos te esperando! 🤝"}'::jsonb,
  ARRAY['candidate_first_name','job_title','school_name','business_hours_text']::TEXT[],
  'on_status_change',
  '{"status":"proposta"}'::jsonb,
  TRUE
),
(
  'rh_stage_contratado',
  'rh-seletivo',
  'text',
  '{"body":"Seja bem-vindo(a) à equipe da {{school_name}}, {{candidate_first_name}}! 🎊\n\nPara efetivar sua contratação na vaga de *{{job_title}}*, compareça à escola trazendo os seguintes documentos:\n\n{{required_docs_list}}\n\nNosso horário de atendimento:\n{{business_hours_text}}\n\nQualquer dúvida, responda esta mensagem. Estamos ansiosos pra te receber! 💙"}'::jsonb,
  ARRAY['candidate_first_name','job_title','school_name','required_docs_list','business_hours_text']::TEXT[],
  'on_status_change',
  '{"status":"contratado"}'::jsonb,
  TRUE
),
(
  'rh_stage_descartado',
  'rh-seletivo',
  'text',
  '{"body":"Olá, {{candidate_first_name}}.\n\nAgradecemos seu interesse na vaga de *{{job_title}}* na {{school_name}}. Neste momento, optamos por seguir com outros perfis, mas seu currículo fica em nossa base.\n\nVocê pode se candidatar novamente em processos futuros ou conferir outras vagas abertas em:\n{{careers_url}}\n\nDesejamos muito sucesso na sua trajetória! 🌟"}'::jsonb,
  ARRAY['candidate_first_name','job_title','school_name','careers_url']::TEXT[],
  'on_status_change',
  '{"status":"descartado"}'::jsonb,
  TRUE
)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE 'Aplicada migration 220 (rh pipeline notifications)';
END $$;
