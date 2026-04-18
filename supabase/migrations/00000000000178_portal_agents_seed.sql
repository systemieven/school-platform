-- 178: Seed dos 3 agentes proativos dos portais (Sprint 13.IA.v2 PR3)
-- student_study_buddy : cron 6h — dicas de estudo + conteúdo corrente do diário
-- guardian_pulse      : cron 12h — resumo de faltas, parcelas e eventos dos filhos
-- lost_found_match    : trigger AFTER INSERT em lost_found_items

INSERT INTO ai_agents (
  slug, name, description, provider, model,
  system_prompt, user_prompt_template,
  temperature, max_tokens, enabled,
  run_on_login, run_on_event, run_on_cron, debounce_hours, audience
) VALUES
(
  'student_study_buddy',
  'Monitor de estudos (aluno)',
  'Identifica disciplinas com notas em queda e oferece trilha de estudo + recurso externo (YouTube).',
  'anthropic',
  'claude-haiku-4-5-20251001',
  'Você é um tutor amigável que ajuda alunos do ensino fundamental/médio a melhorar seu desempenho. Seja direto, motivador, curto. Nunca invente links — quando não tiver URL real, use busca generica do YouTube: "https://www.youtube.com/results?search_query=<tópico>".',
  $$Aluno: {{student_name}}
Disciplinas em atenção (média < 6.0 ou em recuperação): {{low_grades_json}}
Conteúdo recente no diário: {{recent_topics_json}}

Emita JSON estrito:
{
  "should_alert": boolean,
  "severity": "low",
  "audience": ["student"],
  "recipient_id": "{{student_auth_user_id}}",
  "related_module": "portal-aluno",
  "title": "Dica curta (até 40 chars)",
  "summary": "1 frase acolhedora + 1 recurso",
  "payload": { "discipline": "...", "topic": "..." },
  "actions": [
    {"label":"Ver vídeo","type":"navigate","params":{"path":"https://www.youtube.com/results?search_query=..."}},
    {"label":"OK","type":"resolve"}
  ]
}$$,
  0.4, 800, true,
  false, ARRAY[]::TEXT[], '6h', 6, ARRAY['student']::TEXT[]
),
(
  'guardian_pulse',
  'Pulso do responsável',
  'Consolida sinais relevantes dos filhos: faltas recentes, parcelas próximas do vencimento e eventos escolares.',
  'anthropic',
  'claude-haiku-4-5-20251001',
  'Você é um assistente que ajuda responsáveis a acompanhar a vida escolar dos filhos sem sobrecarregá-los. Só emita alerta quando houver algo realmente novo e acionável. Evite alarmismo.',
  $$Responsável: {{guardian_name}}
Filhos: {{children_json}}
Parcelas a vencer nos próximos 7 dias: {{upcoming_installments_json}}
Faltas nos últimos 7 dias: {{recent_absences_json}}

Emita JSON estrito (should_alert=false se nada relevante):
{
  "should_alert": boolean,
  "severity": "low"|"medium"|"high",
  "audience": ["guardian"],
  "recipient_id": "{{guardian_id}}",
  "related_module": "portal-responsavel",
  "title": "texto curto",
  "summary": "1-2 frases",
  "payload": { ... },
  "actions": [
    {"label":"Abrir portal","type":"navigate","params":{"path":"/responsavel"}}
  ]
}$$,
  0.3, 900, true,
  false, ARRAY[]::TEXT[], '12h', 12, ARRAY['guardian']::TEXT[]
),
(
  'lost_found_match',
  'Achados e perdidos — match',
  'Quando um item é cadastrado no achados e perdidos, tenta identificar possíveis donos e notifica.',
  'anthropic',
  'claude-haiku-4-5-20251001',
  'Você analisa descrição de um item encontrado e produz um aviso curto e amigável no formato "É seu?" para possíveis donos. Não invente nomes nem identificações.',
  $$Item encontrado:
- Tipo: {{item_type}}
- Descrição: {{item_description}}
- Local: {{found_location}}
- Guardado em: {{storage_location}}

Emita JSON estrito:
{
  "should_alert": true,
  "severity": "low",
  "audience": ["student","guardian"],
  "related_module": "achados-perdidos",
  "related_entity_type": "lost_found_item",
  "related_entity_id": "{{item_id}}",
  "title": "Encontraram algo seu?",
  "summary": "Descrição amigável em 1 frase com tipo e local",
  "payload": { "item_id": "{{item_id}}" },
  "actions": [
    {"label":"É meu","type":"navigate","params":{"path":"/portal/achados-perdidos?claim={{item_id}}"}},
    {"label":"Não é","type":"resolve"}
  ]
}$$,
  0.3, 600, true,
  false, ARRAY['lost_found.after_insert']::TEXT[], NULL, 0, ARRAY['student','guardian']::TEXT[]
)
ON CONFLICT (slug) DO UPDATE SET
  run_on_cron    = EXCLUDED.run_on_cron,
  run_on_event   = EXCLUDED.run_on_event,
  debounce_hours = EXCLUDED.debounce_hours,
  audience       = EXCLUDED.audience,
  enabled        = EXCLUDED.enabled,
  updated_at     = now();

INSERT INTO ai_event_bindings (event_type, agent_slug, debounce_hours, enabled) VALUES
  ('cron.student_study_buddy', 'student_study_buddy', 6, true),
  ('cron.guardian_pulse',      'guardian_pulse',      12, true),
  ('lost_found.after_insert',  'lost_found_match',    0, true)
ON CONFLICT (event_type, agent_slug) DO UPDATE SET
  debounce_hours = EXCLUDED.debounce_hours,
  enabled        = EXCLUDED.enabled,
  updated_at     = now();

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 178 (seed portal agents: student_study_buddy, guardian_pulse, lost_found_match)');
