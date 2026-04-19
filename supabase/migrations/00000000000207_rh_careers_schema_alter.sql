-- 207: Fase 16 PR3 — ALTER de schema para captação pública
--
-- Mudanças necessárias para suportar o wizard público /trabalhe-conosco:
--   1. `job_openings.area` (pedagogica | administrativa | servicos_gerais)
--       — candidato escolhe área antes de ver as vagas.
--   2. `job_applications.job_opening_id` passa a NULLABLE — permite
--       "cadastro reserva" (candidato sem vaga publicada disponível).
--   3. `job_applications.area` obrigatório — preenchido inclusive nas
--       reservas, para filtrar o kanban por área.
--   4. `job_applications.pre_screening_status` / `pre_screening_session_id`
--       — tracking do chat pré-candidatura.
--   5. UNIQUE(job_opening_id, candidate_id) vira índice **parcial** (só
--       quando há vaga) — reserva pode ter múltiplas linhas por candidato.

-- ============================================================
-- 1) job_openings.area
-- ============================================================
ALTER TABLE job_openings
  ADD COLUMN IF NOT EXISTS area TEXT;

-- Backfill vagas antigas como 'administrativa' (neutro, pode ser editado).
UPDATE job_openings SET area = 'administrativa' WHERE area IS NULL;

ALTER TABLE job_openings
  ALTER COLUMN area SET NOT NULL;

ALTER TABLE job_openings
  DROP CONSTRAINT IF EXISTS job_openings_area_check;
ALTER TABLE job_openings
  ADD CONSTRAINT job_openings_area_check
  CHECK (area IN ('pedagogica','administrativa','servicos_gerais'));

CREATE INDEX IF NOT EXISTS idx_job_openings_area ON job_openings(area);

-- ============================================================
-- 2) job_applications: job_opening_id NULLABLE + area + pre_screening
-- ============================================================
ALTER TABLE job_applications
  ALTER COLUMN job_opening_id DROP NOT NULL;

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS area TEXT;

-- Backfill candidaturas antigas com a área da vaga correspondente.
UPDATE job_applications ja
   SET area = jo.area
  FROM job_openings jo
 WHERE ja.job_opening_id = jo.id
   AND ja.area IS NULL;

-- Se sobrou alguma sem vaga (não deveria existir pré-PR3), assume 'administrativa'.
UPDATE job_applications SET area = 'administrativa' WHERE area IS NULL;

ALTER TABLE job_applications
  ALTER COLUMN area SET NOT NULL;

ALTER TABLE job_applications
  DROP CONSTRAINT IF EXISTS job_applications_area_check;
ALTER TABLE job_applications
  ADD CONSTRAINT job_applications_area_check
  CHECK (area IN ('pedagogica','administrativa','servicos_gerais'));

CREATE INDEX IF NOT EXISTS idx_job_applications_area ON job_applications(area);

-- Tracking do chat pré-candidatura.
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS pre_screening_status TEXT
    CHECK (pre_screening_status IN ('pending','running','completed','abandoned')),
  ADD COLUMN IF NOT EXISTS pre_screening_session_id UUID;

ALTER TABLE job_applications
  ALTER COLUMN source SET DEFAULT 'manual';

-- ============================================================
-- 3) Unique (job_opening_id, candidate_id) vira índice parcial
--    — reserva admite múltiplas linhas do mesmo candidato
--    (ex.: inscreveu em pedagogica e administrativa).
-- ============================================================
ALTER TABLE job_applications
  DROP CONSTRAINT IF EXISTS job_applications_job_opening_id_candidate_id_key;

-- Índice parcial único: garante um-por-vaga quando há vaga, livre na reserva.
DROP INDEX IF EXISTS job_applications_opening_candidate_uniq;
CREATE UNIQUE INDEX job_applications_opening_candidate_uniq
  ON job_applications (job_opening_id, candidate_id)
  WHERE job_opening_id IS NOT NULL;

-- Reserva: um candidato não deveria aparecer 2x na mesma área sem vaga.
DROP INDEX IF EXISTS job_applications_reserva_area_uniq;
CREATE UNIQUE INDEX job_applications_reserva_area_uniq
  ON job_applications (candidate_id, area)
  WHERE job_opening_id IS NULL;

-- ============================================================
-- Log
-- ============================================================
INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'rh-seletivo',
        'Aplicada migration 207 (area em job_openings + job_applications, job_opening_id NULLABLE, partial unique)');
