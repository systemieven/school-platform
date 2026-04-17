-- Migration 118: nfse_emission_log — Fase 14.S: Log imutável de tentativas de emissão

CREATE TABLE IF NOT EXISTS nfse_emission_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfse_id      UUID REFERENCES nfse_emitidas(id) ON DELETE CASCADE,
  tentativa    INT NOT NULL DEFAULT 1,
  iniciado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dados_env    JSONB NOT NULL DEFAULT '{}',
  resposta     JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfse_log_nfse    ON nfse_emission_log(nfse_id);
CREATE INDEX IF NOT EXISTS idx_nfse_log_created ON nfse_emission_log(created_at DESC);

ALTER TABLE nfse_emission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfse_log_admin_select" ON nfse_emission_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfse_log_coordinator_select" ON nfse_emission_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE POLICY "nfse_log_service_insert" ON nfse_emission_log
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));
