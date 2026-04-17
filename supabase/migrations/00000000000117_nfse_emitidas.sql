-- Migration 117: nfse_emitidas — Fase 14.S: Notas Fiscais de Serviço emitidas

CREATE OR REPLACE FUNCTION set_updated_at_nfse()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS nfse_emitidas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            INT,
  serie             TEXT NOT NULL DEFAULT 'RPS',
  chave_nfse        TEXT,
  provider_nfse_id  TEXT,
  prestador         JSONB NOT NULL DEFAULT '{}',
  tomador           JSONB NOT NULL DEFAULT '{}',
  servico           JSONB NOT NULL DEFAULT '{}',
  valor_servico     NUMERIC(12,2) NOT NULL DEFAULT 0,
  aliq_iss          NUMERIC(5,2),
  valor_iss         NUMERIC(12,2),
  valor_pis         NUMERIC(12,2),
  valor_cofins      NUMERIC(12,2),
  valor_csll        NUMERIC(12,2),
  valor_irpj        NUMERIC(12,2),
  valor_inss        NUMERIC(12,2),
  valor_iss_retido  NUMERIC(12,2),
  valor_liquido     NUMERIC(12,2),
  installment_id    UUID REFERENCES financial_installments(id) ON DELETE SET NULL,
  receivable_id     UUID REFERENCES financial_receivables(id) ON DELETE SET NULL,
  guardian_id       UUID REFERENCES guardian_profiles(id) ON DELETE SET NULL,
  link_pdf          TEXT,
  xml_retorno       TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','autorizada','cancelada','substituida','rejeitada')),
  motivo_rejeicao   TEXT,
  cancelada_em      TIMESTAMPTZ,
  cancelada_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  substituida_por   UUID REFERENCES nfse_emitidas(id) ON DELETE SET NULL,
  emitida_por       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfse_emitidas_status      ON nfse_emitidas(status);
CREATE INDEX IF NOT EXISTS idx_nfse_emitidas_installment ON nfse_emitidas(installment_id);
CREATE INDEX IF NOT EXISTS idx_nfse_emitidas_guardian    ON nfse_emitidas(guardian_id);
CREATE INDEX IF NOT EXISTS idx_nfse_emitidas_created     ON nfse_emitidas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfse_provider_id          ON nfse_emitidas(provider_nfse_id);

ALTER TABLE nfse_emitidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfse_emitidas_admin_all" ON nfse_emitidas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfse_emitidas_coordinator_select" ON nfse_emitidas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE TRIGGER trg_nfse_emitidas_updated_at
  BEFORE UPDATE ON nfse_emitidas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_nfse();
