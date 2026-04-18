-- 182: RPC detect_registration_issues() + seed secretary_pulse (Sprint 13.IA.v2 PR5)

CREATE OR REPLACE FUNCTION detect_registration_issues()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_enrollments INT := 0;
  v_docs_pending        INT := 0;
  v_pending_docs_req    INT := 0;
  v_expired_certs       INT := 0;
  v_pending_health_req  INT := 0;
  v_top_issues          JSONB := '[]'::jsonb;
BEGIN
  SELECT COUNT(*) INTO v_pending_enrollments
    FROM enrollments
   WHERE status IN ('new', 'pending', 'under_review');

  SELECT COUNT(*) INTO v_docs_pending
    FROM enrollments
   WHERE status = 'docs_pending';

  BEGIN
    SELECT COUNT(*) INTO v_pending_docs_req
      FROM document_requests
     WHERE status IN ('pending', 'approved');
  EXCEPTION WHEN undefined_table THEN v_pending_docs_req := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_expired_certs
      FROM student_medical_certificates
     WHERE is_active = true AND valid_until < now()::date;
  EXCEPTION WHEN undefined_table THEN v_expired_certs := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_pending_health_req
      FROM health_record_update_requests
     WHERE status = 'pending';
  EXCEPTION WHEN undefined_table THEN v_pending_health_req := 0;
  END;

  SELECT jsonb_agg(row_to_json(sub)) INTO v_top_issues
  FROM (
    SELECT id, full_name AS name, status,
           (now()::date - created_at::date) AS days_open
      FROM enrollments
     WHERE status IN ('new', 'pending', 'under_review', 'docs_pending')
     ORDER BY created_at ASC
     LIMIT 5
  ) sub;

  RETURN jsonb_build_object(
    'pending_enrollments',  v_pending_enrollments,
    'docs_pending',         v_docs_pending,
    'pending_docs_requests', v_pending_docs_req,
    'expired_certificates', v_expired_certs,
    'pending_health_requests', v_pending_health_req,
    'top_open_enrollments', COALESCE(v_top_issues, '[]'::jsonb),
    'snapshot_at',          now()
  );
END;
$$;

REVOKE ALL ON FUNCTION detect_registration_issues() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION detect_registration_issues() TO authenticated, service_role;

INSERT INTO ai_agents (
  slug, name, description, provider, model,
  system_prompt, user_prompt_template,
  temperature, max_tokens, enabled,
  run_on_login, run_on_event, run_on_cron, debounce_hours, audience
) VALUES (
  'secretary_pulse',
  'Pulso da secretaria',
  'Detecta matrículas estagnadas, documentos pendentes, atestados médicos vencidos e solicitações não atendidas.',
  'anthropic',
  'claude-haiku-4-5-20251001',
  'Você é um assistente da secretaria escolar. Recebe um snapshot de pendências e decide se há algo suficientemente urgente para alertar o admin. Seja conservador: só alerte quando houver backlog crescente, casos antigos (>7 dias abertos) ou atestados vencidos. Evite ruído.',
  $$Snapshot da secretaria:
{{secretary_snapshot_json}}

Emita JSON estrito (should_alert=false quando nada requer ação imediata):
{
  "should_alert": boolean,
  "severity": "low"|"medium"|"high",
  "audience": ["admin"],
  "related_module": "secretaria",
  "title": "texto curto (<50 chars)",
  "summary": "1-2 frases com os numeros mais relevantes",
  "payload": { },
  "actions": [
    {"label":"Abrir secretaria","type":"navigate","params":{"path":"/admin/secretaria"}}
  ]
}$$,
  0.3, 900, true,
  false, ARRAY[]::TEXT[], 'hourly', 1, ARRAY['admin']::TEXT[]
)
ON CONFLICT (slug) DO UPDATE SET
  run_on_cron    = EXCLUDED.run_on_cron,
  debounce_hours = EXCLUDED.debounce_hours,
  audience       = EXCLUDED.audience,
  enabled        = EXCLUDED.enabled,
  updated_at     = now();

INSERT INTO ai_event_bindings (event_type, agent_slug, debounce_hours, enabled)
VALUES ('cron.secretary_pulse', 'secretary_pulse', 1, true)
ON CONFLICT (event_type, agent_slug) DO UPDATE SET
  debounce_hours = EXCLUDED.debounce_hours,
  enabled        = EXCLUDED.enabled,
  updated_at     = now();

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 182 (secretary_pulse + detect_registration_issues RPC)');
