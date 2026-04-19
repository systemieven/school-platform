-- ============================================================
-- 213_careers_pr3_hardening
--
-- PR3.1 — Corrige blockers identificados na auditoria pós-PR3 (§10.17.A do PRD):
--   #1 Agenda cron.schedule para expire_stale_pre_screening_sessions (a cada 15 min).
--   #2 Adiciona trilha de consentimento LGPD em job_applications
--      (lgpd_consent_at, lgpd_consent_version, lgpd_consent_ip).
--   #5 Reescreve promote_candidate_to_staff para aceitar candidaturas
--      de base reserva (job_opening_id NULL) com fallback de position/
--      employment_type vindo da própria candidatura (area) ou de parâmetros.
-- ============================================================

-- ------------------------------------------------------------
-- #2 Trilha de consentimento LGPD
-- ------------------------------------------------------------
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS lgpd_consent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lgpd_consent_version TEXT,
  ADD COLUMN IF NOT EXISTS lgpd_consent_ip      TEXT;

COMMENT ON COLUMN job_applications.lgpd_consent_at      IS
  'Instante em que o candidato aceitou o termo LGPD no wizard público (preenchido por careers-intake).';
COMMENT ON COLUMN job_applications.lgpd_consent_version IS
  'Hash sha256 (hex, 12 primeiros) do texto LGPD vigente no momento do aceite — permite rastrear qual versão do termo foi aceita.';
COMMENT ON COLUMN job_applications.lgpd_consent_ip      IS
  'IP (do header X-Forwarded-For) que submeteu o consentimento — armazenado apenas para auditoria.';

-- ------------------------------------------------------------
-- #5 promote_candidate_to_staff — aceitar reserva
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_candidate_to_staff(
  p_application_id  UUID,
  p_position        TEXT DEFAULT NULL,
  p_department      TEXT DEFAULT NULL,
  p_employment_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_app    job_applications%ROWTYPE;
  v_cand   candidates%ROWTYPE;
  v_job    job_openings%ROWTYPE;
  v_staff  UUID;
  v_position        TEXT;
  v_department      TEXT;
  v_employment_type TEXT;
BEGIN
  SELECT * INTO v_app FROM job_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura % não encontrada', p_application_id;
  END IF;

  IF v_app.hired_staff_id IS NOT NULL THEN
    RETURN v_app.hired_staff_id;
  END IF;

  SELECT * INTO v_cand FROM candidates WHERE id = v_app.candidate_id;

  -- Reserva (sem vaga) ou vaga real?
  IF v_app.job_opening_id IS NOT NULL THEN
    SELECT * INTO v_job FROM job_openings WHERE id = v_app.job_opening_id;
  END IF;

  -- Resolve position: argumento explícito > vaga > fallback por área.
  v_position := COALESCE(
    NULLIF(TRIM(p_position), ''),
    v_job.title,
    CASE v_app.area
      WHEN 'pedagogica'      THEN 'Profissional pedagógico'
      WHEN 'administrativa'  THEN 'Profissional administrativo'
      WHEN 'servicos_gerais' THEN 'Serviços gerais'
      ELSE 'Colaborador'
    END
  );

  v_department := COALESCE(
    NULLIF(TRIM(p_department), ''),
    v_job.department,
    CASE v_app.area
      WHEN 'pedagogica'      THEN 'Pedagógico'
      WHEN 'administrativa'  THEN 'Administrativo'
      WHEN 'servicos_gerais' THEN 'Serviços gerais'
      ELSE NULL
    END
  );

  v_employment_type := COALESCE(
    NULLIF(TRIM(p_employment_type), ''),
    v_job.employment_type,
    'clt'
  );

  INSERT INTO staff (
    full_name, email, phone, cpf, rg, birth_date,
    address_street, address_number, address_complement, address_neighborhood,
    address_city, address_state, address_zip,
    position, department, hire_date, employment_type,
    is_active
  ) VALUES (
    v_cand.full_name, v_cand.email, v_cand.phone, v_cand.cpf, v_cand.rg, v_cand.birth_date,
    v_cand.address_street, v_cand.address_number, v_cand.address_complement, v_cand.address_neighborhood,
    v_cand.address_city, v_cand.address_state, v_cand.address_zip,
    v_position, v_department, CURRENT_DATE, v_employment_type,
    true
  )
  RETURNING id INTO v_staff;

  UPDATE job_applications
     SET hired_staff_id = v_staff,
         hired_at       = now()
   WHERE id = p_application_id;

  RETURN v_staff;
END;
$function$;

COMMENT ON FUNCTION public.promote_candidate_to_staff(UUID, TEXT, TEXT, TEXT) IS
  'Promove uma candidatura a colaborador (staff). Aceita candidaturas de base reserva (job_opening_id NULL) — quando a vaga não existe, usa os parâmetros opcionais p_position/p_department/p_employment_type ou infere por área.';

-- ------------------------------------------------------------
-- #1 Cron — expira sessões de pré-triagem a cada 15 minutos
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove job antigo (se existir) para permitir re-agendamento idempotente.
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'expire_pre_screening_sessions';

    PERFORM cron.schedule(
      'expire_pre_screening_sessions',
      '*/15 * * * *',
      $job$SELECT public.expire_stale_pre_screening_sessions();$job$
    );
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Log
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'migration_log') THEN
    INSERT INTO migration_log (name, description)
    VALUES (
      '00000000000213_careers_pr3_hardening',
      'PR3.1: cron expire_pre_screening_sessions + LGPD audit trail em job_applications + promote_candidate_to_staff aceita reserva'
    );
  END IF;
END
$$;
