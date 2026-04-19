-- 212: Fase 16 PR3 — coluna extracted_payload em job_applications
--
-- Armazena o JSON extraído pelo agente resume_extractor (nome, email,
-- telefone, formação, experiência, skills, etc.). Separado de
-- screener_payload (score vs vaga) e interview_payload (DISC/STAR).
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS extracted_payload JSONB;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'rh-seletivo',
        'Aplicada migration 212 (extracted_payload em job_applications)');
