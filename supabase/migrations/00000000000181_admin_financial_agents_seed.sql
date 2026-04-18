-- 181: Seed de financial_anomaly_scout + admin_pulse + trigger em
-- financial_installments.status para disparos event-driven (Sprint 13.IA.v2 PR4)

INSERT INTO ai_agents (
  slug, name, description, provider, model,
  system_prompt, user_prompt_template,
  temperature, max_tokens, enabled,
  run_on_login, run_on_event, run_on_cron, debounce_hours, audience
) VALUES
(
  'financial_anomaly_scout',
  'Farejador financeiro',
  'Detecta picos de inadimplência, parcelas criticamente atrasadas e variações anômalas na receita. Para admin/super_admin.',
  'anthropic',
  'claude-haiku-4-5-20251001',
  'Você é um analista financeiro de uma escola. Recebe um snapshot de inadimplência e decide se deve alertar. Seja conservador: só dispare alerta (should_alert=true) quando houver variação relevante (>15% vs baseline) ou casos críticos (>30d atrasado e >R$500). Seja breve e acionável.',
  $$Snapshot de inadimplência:
{{delinquency_snapshot_json}}

Emita JSON estrito:
{
  "should_alert": boolean,
  "severity": "low"|"medium"|"high"|"critical",
  "audience": ["admin"],
  "related_module": "financeiro",
  "title": "texto curto (<50 chars)",
  "summary": "1-2 frases com R$ totais e casos-chave",
  "payload": { "delinquency": ... },
  "actions": [
    {"label":"Abrir financeiro","type":"navigate","params":{"path":"/admin/financeiro?tab=inadimplencia"}}
  ]
}$$,
  0.2, 1000, true,
  false, ARRAY['financial_installment.status_change']::TEXT[], 'hourly', 1, ARRAY['admin']::TEXT[]
),
(
  'admin_pulse',
  'Pulso administrativo',
  'Visão geral diária para admin: inadimplência consolidada, matrículas pendentes, contatos novos, agendamentos.',
  'anthropic',
  'claude-haiku-4-5-20251001',
  'Você é um assistente de gestão. Produz um pulso administrativo conciso para o admin da escola. Só emita alerta quando houver algo realmente notável (delta relevante, backlog crescente ou casos críticos). Evite ruído.',
  $$Snapshot administrativo:
{{admin_pulse_snapshot_json}}

Emita JSON estrito (should_alert=false em dias tranquilos):
{
  "should_alert": boolean,
  "severity": "low"|"medium"|"high",
  "audience": ["admin"],
  "related_module": "dashboard",
  "title": "Pulso do dia (texto curto)",
  "summary": "1-2 frases com os números mais relevantes",
  "payload": { "snapshot": ... },
  "actions": [
    {"label":"Abrir dashboard","type":"navigate","params":{"path":"/admin/dashboard"}}
  ]
}$$,
  0.3, 900, true,
  true, ARRAY[]::TEXT[], 'hourly', 1, ARRAY['admin']::TEXT[]
)
ON CONFLICT (slug) DO UPDATE SET
  run_on_login   = EXCLUDED.run_on_login,
  run_on_event   = EXCLUDED.run_on_event,
  run_on_cron    = EXCLUDED.run_on_cron,
  debounce_hours = EXCLUDED.debounce_hours,
  audience       = EXCLUDED.audience,
  enabled        = EXCLUDED.enabled,
  updated_at     = now();

INSERT INTO ai_event_bindings (event_type, agent_slug, debounce_hours, enabled) VALUES
  ('cron.financial_anomaly_scout',        'financial_anomaly_scout', 1, true),
  ('financial_installment.status_change', 'financial_anomaly_scout', 1, true),
  ('cron.admin_pulse',                    'admin_pulse',             1, true),
  ('login_refresh.admin_pulse',           'admin_pulse',             1, true)
ON CONFLICT (event_type, agent_slug) DO UPDATE SET
  debounce_hours = EXCLUDED.debounce_hours,
  enabled        = EXCLUDED.enabled,
  updated_at     = now();

-- Trigger em financial_installments: emite evento quando status vai para 'overdue'
CREATE OR REPLACE FUNCTION trg_installment_ai_notify() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'overdue' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'overdue') THEN
    PERFORM notify_ai_event_trigger(
      'financial_installment.status_change',
      'financial_installment',
      NEW.id,
      jsonb_build_object(
        'installment_id', NEW.id,
        'student_id',     NEW.student_id,
        'amount',         NEW.amount,
        'due_date',       NEW.due_date,
        'new_status',     NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_installments_ai_notify ON financial_installments;
CREATE TRIGGER trg_financial_installments_ai_notify
  AFTER INSERT OR UPDATE OF status ON financial_installments
  FOR EACH ROW
  EXECUTE FUNCTION trg_installment_ai_notify();

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 181 (financial_anomaly_scout + admin_pulse + trigger installments)');
