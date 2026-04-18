-- Migration 193: student_access_attempts (Primeiro Acesso do Aluno v2 — §10.20)
-- Auditoria + rate-limit do edge function student-grant-access (acionado pelo
-- responsavel autenticado) e do fallback firstAccess legado.
-- RLS sem policies (service_role only) — mesmo padrao das migrations 190/191.

CREATE TABLE IF NOT EXISTS student_access_attempts (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                    UUID REFERENCES students(id) ON DELETE SET NULL,
  granted_by_guardian_user_id   UUID,  -- auth.users.id do responsavel; NULL para self_legacy
  ip_address                    TEXT,
  user_agent                    TEXT,
  channel                       TEXT NOT NULL CHECK (channel IN ('guardian_grant','self_legacy')),
  result                        TEXT NOT NULL CHECK (result IN (
    'sent','student_not_found','no_guardian_phone','no_whatsapp',
    'rate_limited','whatsapp_send_failed','invalid_input',
    'wa_not_configured','unauthorized'
  )),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_access_attempts_student_created
  ON student_access_attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_access_attempts_guardian_created
  ON student_access_attempts(granted_by_guardian_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_access_attempts_ip_created
  ON student_access_attempts(ip_address, created_at DESC);

ALTER TABLE student_access_attempts ENABLE ROW LEVEL SECURITY;
-- Sem policies — service_role only

COMMENT ON TABLE student_access_attempts IS
  'Auditoria do edge function student-grant-access (gate via responsavel autenticado) e do firstAccess legado (channel=self_legacy). Usado para rate-limit (3/student/h, 5/guardian/h, 5/IP/10min) e telemetria de uso do legado.';
