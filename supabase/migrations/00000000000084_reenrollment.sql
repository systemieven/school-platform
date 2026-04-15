-- Migration 84: Rematricula Online (Fase 11 — Secretaria Digital)

-- ── 1. reenrollment_campaigns ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reenrollment_campaigns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  school_year           INT NOT NULL,                    -- ano alvo (ex: 2027)
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  early_deadline        DATE,                            -- prazo para desconto antecipado
  early_discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0, -- % de desconto antecipado
  default_plan_id       UUID REFERENCES financial_plans(id) ON DELETE SET NULL,
  eligible_segments     UUID[],                          -- null = todos os segmentos
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','active','closed','cancelled')),
  auto_generate_contract BOOLEAN NOT NULL DEFAULT true,
  requires_signature     BOOLEAN NOT NULL DEFAULT false,
  instructions          TEXT,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reenrollment_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access campaigns"
  ON reenrollment_campaigns FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

CREATE POLICY "Coordinator view campaigns"
  ON reenrollment_campaigns FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coordinator'))
  );

-- Responsavel ve campanhas ativas
CREATE POLICY "Guardian view active campaigns"
  ON reenrollment_campaigns FOR SELECT
  USING (status = 'active');

CREATE OR REPLACE FUNCTION update_reenrollment_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_reenrollment_campaigns_updated_at
  BEFORE UPDATE ON reenrollment_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_reenrollment_campaigns_updated_at();

-- ── 2. reenrollment_applications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reenrollment_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES reenrollment_campaigns(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id         UUID REFERENCES guardian_profiles(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending','confirmed','signed','contract_generated',
                          'completed','cancelled'
                        )),
  early_discount_applied BOOLEAN NOT NULL DEFAULT false,
  plan_id             UUID REFERENCES financial_plans(id) ON DELETE SET NULL,
  contract_id         UUID REFERENCES financial_contracts(id) ON DELETE SET NULL,
  confirmed_at        TIMESTAMPTZ,
  signed_at           TIMESTAMPTZ,
  signature_data      TEXT,                              -- base64 da assinatura digital
  notes               TEXT,
  processed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_reenrollment_apps_campaign ON reenrollment_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reenrollment_apps_student  ON reenrollment_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_reenrollment_apps_status   ON reenrollment_applications(status);

ALTER TABLE reenrollment_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator full access applications"
  ON reenrollment_applications FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

-- Responsavel ve/edita aplicacoes dos proprios filhos
CREATE POLICY "Guardian view own applications"
  ON reenrollment_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_guardians sg
      WHERE sg.student_id = reenrollment_applications.student_id
        AND sg.guardian_user_id = auth.uid()
    )
  );

CREATE POLICY "Guardian update own applications"
  ON reenrollment_applications FOR UPDATE
  USING (
    guardian_id = auth.uid()
    AND status IN ('pending','confirmed')  -- nao pode alterar apos assinatura
  )
  WITH CHECK (guardian_id = auth.uid());

CREATE OR REPLACE FUNCTION update_reenrollment_applications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_reenrollment_applications_updated_at
  BEFORE UPDATE ON reenrollment_applications
  FOR EACH ROW EXECUTE FUNCTION update_reenrollment_applications_updated_at();
