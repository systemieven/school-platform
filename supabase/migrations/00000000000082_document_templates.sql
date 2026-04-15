-- Migration 82: Declaracoes e Solicitacoes (Fase 11 — Secretaria Digital)

-- ── 1. document_templates ───────────────────────────────────────────────────
-- Templates HTML com variaveis no formato {{nome_completo}}, {{turma}}, etc.
CREATE TABLE IF NOT EXISTS document_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  document_type   TEXT NOT NULL DEFAULT 'declaracao'
                    CHECK (document_type IN (
                      'declaracao_matricula', 'declaracao_frequencia',
                      'declaracao_conclusao', 'historico_escolar',
                      'declaracao_transferencia', 'outro'
                    )),
  html_content    TEXT NOT NULL,              -- template HTML com {{variaveis}}
  variables       TEXT[] NOT NULL DEFAULT '{}',  -- lista das variaveis usadas
  is_active       BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access document_templates"
  ON document_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

CREATE POLICY "Coordinator view document_templates"
  ON document_templates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coordinator'))
  );

CREATE OR REPLACE FUNCTION update_document_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_document_templates_updated_at();

-- ── 2. document_requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID NOT NULL REFERENCES document_templates(id) ON DELETE RESTRICT,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- guardian ou admin
  requester_type      TEXT NOT NULL DEFAULT 'guardian'
                        CHECK (requester_type IN ('guardian','admin','coordinator')),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','generating','generated','delivered','rejected')),
  notes               TEXT,                              -- observacoes do solicitante
  rejection_reason    TEXT,                              -- motivo de rejeicao
  generated_at        TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  pdf_path            TEXT,                              -- caminho no Storage
  pdf_url             TEXT,                              -- signed URL (renovavel)
  pdf_url_expires_at  TIMESTAMPTZ,
  approved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_requests_student ON document_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_status  ON document_requests(status);

ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator full access doc_requests"
  ON document_requests FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

-- Responsavel pode ver e criar solicitacoes dos seus filhos
CREATE POLICY "Guardian view own requests"
  ON document_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = document_requests.student_id
        AND sg.guardian_user_id = auth.uid()
    )
  );

CREATE POLICY "Guardian create requests"
  ON document_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = document_requests.student_id
        AND sg.guardian_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_document_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_document_requests_updated_at
  BEFORE UPDATE ON document_requests
  FOR EACH ROW EXECUTE FUNCTION update_document_requests_updated_at();
