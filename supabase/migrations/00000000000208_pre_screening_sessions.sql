-- 208: Fase 16 PR3 — Sessões de entrevista pré-candidatura
--
-- O candidato público não tem conta no sistema — o chat de pré-seleção é
-- autenticado por um TOKEN opaco devolvido pelo `careers-intake`.
-- Cada session guarda o histórico (`messages JSONB`) e o relatório final.
--
-- RLS: service_role only (toda comunicação pública passa por edge function
-- com service key, o token é verificado no body).

CREATE TABLE IF NOT EXISTS pre_screening_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','completed','abandoned','expired')),
  area           TEXT NOT NULL
                 CHECK (area IN ('pedagogica','administrativa','servicos_gerais')),
  messages       JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  client_ip      TEXT,
  user_agent     TEXT,
  final_payload  JSONB
);

CREATE INDEX IF NOT EXISTS idx_pre_screening_sessions_application
  ON pre_screening_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_pre_screening_sessions_status
  ON pre_screening_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pre_screening_sessions_token
  ON pre_screening_sessions(token);

ALTER TABLE pre_screening_sessions ENABLE ROW LEVEL SECURITY;

-- Service role only: sem policies. Admin SELECT ganha via JOIN indireto
-- no drawer de candidatura (edge function retorna o histórico quando
-- admin pede).

-- FK reversa: job_applications.pre_screening_session_id → pre_screening_sessions.id
-- (definida sem ON DELETE para evitar ciclos — cleanup via trigger ou manual).
ALTER TABLE job_applications
  DROP CONSTRAINT IF EXISTS job_applications_pre_screening_session_id_fkey;
ALTER TABLE job_applications
  ADD CONSTRAINT job_applications_pre_screening_session_id_fkey
  FOREIGN KEY (pre_screening_session_id)
  REFERENCES pre_screening_sessions(id)
  ON DELETE SET NULL;

-- ============================================================
-- Cron cleanup: marca sessões expiradas (roda via pg_cron se disponível)
-- ============================================================
CREATE OR REPLACE FUNCTION expire_stale_pre_screening_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE pre_screening_sessions
     SET status = 'expired'
   WHERE status = 'active'
     AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE job_applications
     SET pre_screening_status = 'abandoned'
   WHERE pre_screening_status IN ('pending','running')
     AND pre_screening_session_id IN (
       SELECT id FROM pre_screening_sessions WHERE status = 'expired'
     );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION expire_stale_pre_screening_sessions() FROM PUBLIC;
-- Chamada via cron ou service_role.

-- ============================================================
-- Log
-- ============================================================
INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'rh-seletivo',
        'Aplicada migration 208 (pre_screening_sessions + expire_stale_pre_screening_sessions)');
