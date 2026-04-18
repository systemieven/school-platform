-- 205: Fase 16 PR2 — Candidatos e candidaturas
--
-- `candidates`          — pessoa física (cadastro único por email).
-- `job_applications`    — relação candidato × vaga com pipeline kanban
--                         (novo → triagem → entrevista → proposta → contratado/descartado).
--
-- Trigger `promote_candidate_to_staff` cria linha em `staff` quando
-- stage vira 'contratado'. RPC homônima permite chamada manual pelo admin.
--
-- CV do candidato: bucket `hr-documents` (migration 187) sob prefixo
-- `_recruitment/{application_id}/resume.pdf`.

-- ============================================================
-- 1) candidates
-- ============================================================
CREATE TABLE IF NOT EXISTS candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  cpf             TEXT UNIQUE,
  rg              TEXT,
  cnh             TEXT,
  birth_date      DATE,
  linkedin_url    TEXT,
  portfolio_url   TEXT,
  -- Endereço (opcional no cadastro inicial)
  address_street       TEXT,
  address_number       TEXT,
  address_complement   TEXT,
  address_neighborhood TEXT,
  address_city         TEXT,
  address_state        TEXT,
  address_zip          TEXT,
  -- Campo livre para a extração IA (preserva payload do resume_extractor)
  extracted_payload    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT candidates_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidates_admin_all" ON candidates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')));

CREATE POLICY "candidates_select_by_perm" ON candidates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                 WHERE ep.module_key = 'rh-seletivo' AND ep.can_view = true));

CREATE POLICY "candidates_insert_by_perm" ON candidates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                      WHERE ep.module_key = 'rh-seletivo' AND ep.can_create = true));

CREATE POLICY "candidates_update_by_perm" ON candidates FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                 WHERE ep.module_key = 'rh-seletivo' AND ep.can_edit = true))
  WITH CHECK (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                      WHERE ep.module_key = 'rh-seletivo' AND ep.can_edit = true));

CREATE POLICY "candidates_delete_by_perm" ON candidates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                 WHERE ep.module_key = 'rh-seletivo' AND ep.can_delete = true));

-- ============================================================
-- 2) job_applications
-- ============================================================
CREATE TABLE IF NOT EXISTS job_applications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_opening_id     UUID NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
  candidate_id       UUID NOT NULL REFERENCES candidates(id)   ON DELETE CASCADE,
  stage              TEXT NOT NULL DEFAULT 'novo'
                     CHECK (stage IN ('novo','triagem','entrevista','proposta','contratado','descartado')),
  stage_position     INTEGER NOT NULL DEFAULT 0,   -- ordem dentro da coluna kanban
  source             TEXT,                          -- 'site','indicacao','linkedin','manual'...

  -- CV
  resume_path        TEXT,                          -- hr-documents/_recruitment/{id}/resume.pdf

  -- Screener IA (PR3)
  screener_score     INTEGER,                       -- 0-100
  screener_summary   TEXT,
  screener_payload   JSONB,                         -- pros[], cons[], recommendation, reasoning
  screened_at        TIMESTAMPTZ,

  -- Entrevista pré-candidatura (PR4) — se veio pelo site
  interview_report   TEXT,                          -- markdown do pre_screening_interviewer
  interview_payload  JSONB,                         -- DISC/Big Five/STAR scores

  -- Desfecho
  rejected_reason    TEXT,
  hired_staff_id     UUID REFERENCES staff(id) ON DELETE SET NULL,
  hired_at           TIMESTAMPTZ,

  notes              TEXT,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Um candidato não pode ter duas candidaturas na mesma vaga.
  UNIQUE (job_opening_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_opening ON job_applications(job_opening_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate ON job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_stage ON job_applications(stage);

CREATE TRIGGER trg_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_applications_admin_all" ON job_applications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')));

CREATE POLICY "job_applications_select_by_perm" ON job_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                 WHERE ep.module_key = 'rh-seletivo' AND ep.can_view = true));

CREATE POLICY "job_applications_insert_by_perm" ON job_applications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                      WHERE ep.module_key = 'rh-seletivo' AND ep.can_create = true));

CREATE POLICY "job_applications_update_by_perm" ON job_applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                 WHERE ep.module_key = 'rh-seletivo' AND ep.can_edit = true))
  WITH CHECK (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                      WHERE ep.module_key = 'rh-seletivo' AND ep.can_edit = true));

CREATE POLICY "job_applications_delete_by_perm" ON job_applications FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
                 WHERE ep.module_key = 'rh-seletivo' AND ep.can_delete = true));

-- ============================================================
-- 3) promote_candidate_to_staff — RPC + trigger AFTER UPDATE stage='contratado'
--
-- Cria linha em `staff` (sem profile_id — promoção ao sistema é passo
-- separado via UI/edge function `staff-grant-access`), preenche
-- `hired_staff_id` e `hired_at` na candidatura, copia dados extraídos
-- do candidato.
-- ============================================================
CREATE OR REPLACE FUNCTION promote_candidate_to_staff(p_application_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app    job_applications%ROWTYPE;
  v_cand   candidates%ROWTYPE;
  v_job    job_openings%ROWTYPE;
  v_staff  UUID;
BEGIN
  SELECT * INTO v_app FROM job_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura % não encontrada', p_application_id;
  END IF;

  IF v_app.hired_staff_id IS NOT NULL THEN
    RETURN v_app.hired_staff_id;  -- idempotente
  END IF;

  SELECT * INTO v_cand FROM candidates    WHERE id = v_app.candidate_id;
  SELECT * INTO v_job  FROM job_openings  WHERE id = v_app.job_opening_id;

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
    v_job.title, v_job.department, CURRENT_DATE, v_job.employment_type,
    true
  )
  RETURNING id INTO v_staff;

  UPDATE job_applications
     SET hired_staff_id = v_staff,
         hired_at       = now()
   WHERE id = p_application_id;

  RETURN v_staff;
END;
$$;

REVOKE ALL ON FUNCTION promote_candidate_to_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promote_candidate_to_staff(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION trg_promote_on_contratado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.stage = 'contratado' AND OLD.stage <> 'contratado' AND NEW.hired_staff_id IS NULL THEN
    PERFORM promote_candidate_to_staff(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_applications_promote
  AFTER UPDATE OF stage ON job_applications
  FOR EACH ROW
  WHEN (NEW.stage = 'contratado' AND OLD.stage <> 'contratado')
  EXECUTE FUNCTION trg_promote_on_contratado();
