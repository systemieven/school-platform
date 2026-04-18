-- 177: Seed do agente academic_pulse + binding para cron hourly (Sprint 13.IA.v2 PR2)
-- academic_pulse: varre alunos ativos a cada hora, invoca calculate_academic_risk
-- para cada um, e consolida achados relevantes (risk_level >= 'medium') em
-- insights por coordenador/professor. Execução proxy via ai_scheduled_runner +
-- ai_event_dispatcher (event_type = 'cron.academic_pulse').

INSERT INTO ai_agents (
  slug, name, description, provider, model,
  system_prompt, user_prompt_template,
  temperature, max_tokens, enabled,
  run_on_login, run_on_event, run_on_cron, debounce_hours, audience
) VALUES (
  'academic_pulse',
  'Pulso acadêmico',
  'Agente proativo que monitora frequência e desempenho de alunos ativos. Emite insights de risco acadêmico para coordenação e professores.',
  'anthropic',
  'claude-haiku-4-5-20251001',
  'Você é um analista pedagógico. Recebe um lote de alunos com sinais de risco acadêmico calculados e decide se deve emitir um alerta para a coordenação. Seja conservador: só emita alerta (should_alert=true) quando risk_level for medium, high ou critical. Responda em JSON estrito no formato documentado.',
  $$Analise os alunos abaixo e emita no máximo UM insight consolidando os casos mais graves. Ignore risk_level='low'.

Alunos:
{{students_risk_json}}

Responda APENAS com JSON válido no formato:
{
  "should_alert": boolean,
  "severity": "low"|"medium"|"high"|"critical",
  "audience": ["coordinator","teacher"],
  "related_module": "academico",
  "title": "texto curto",
  "summary": "1-2 frases destacando os piores casos com nomes",
  "payload": { "students": [...] },
  "actions": [
    {"label":"Abrir acadêmico","type":"navigate","params":{"path":"/admin/academico"}}
  ]
}$$,
  0.2, 1200, true,
  false, ARRAY[]::TEXT[], 'hourly', 1, ARRAY['coordinator','teacher']::TEXT[]
)
ON CONFLICT (slug) DO UPDATE SET
  run_on_cron    = EXCLUDED.run_on_cron,
  debounce_hours = EXCLUDED.debounce_hours,
  audience       = EXCLUDED.audience,
  enabled        = EXCLUDED.enabled,
  updated_at     = now();

INSERT INTO ai_event_bindings (event_type, agent_slug, debounce_hours, enabled)
VALUES ('cron.academic_pulse', 'academic_pulse', 1, true)
ON CONFLICT (event_type, agent_slug) DO UPDATE SET
  debounce_hours = EXCLUDED.debounce_hours,
  enabled        = EXCLUDED.enabled,
  updated_at     = now();

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 177 (academic_pulse seed + binding)');
