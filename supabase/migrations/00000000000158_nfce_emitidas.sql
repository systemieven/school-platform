-- Migration 158: nfce_emitidas + nfce_emission_log — Sprint 14.S.P-bis
--
-- NFC-e (modelo 65) emitidas a partir de store_orders. Cada ordem pode gerar
-- uma NFC-e via auto-emit (quando company_nfce_config.auto_emit_on_payment=true
-- e o pagamento e confirmado) ou emissao manual.
--
-- CPF do consumidor vem por padrao do responsavel (students.guardian_id ->
-- guardian_profiles.cpf), mas pode ser sobreposto em store_orders.consumer_cpf_cnpj.

-- Campos opcionais em store_orders para sobrescrever dados do consumidor
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS consumer_cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS consumer_name     TEXT;

COMMENT ON COLUMN store_orders.consumer_cpf_cnpj IS
  'CPF/CNPJ do consumidor para NFC-e. Se NULL, usa CPF do responsavel (students.guardian_id).';

CREATE TABLE IF NOT EXISTS nfce_emitidas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID REFERENCES store_orders(id) ON DELETE SET NULL,
  numero            INT,
  serie             INT NOT NULL DEFAULT 1,
  chave_nfce        TEXT,
  protocolo         TEXT,
  provider_nfce_id  TEXT,
  emitente          JSONB NOT NULL DEFAULT '{}',
  consumidor        JSONB NOT NULL DEFAULT '{}',
  itens             JSONB NOT NULL DEFAULT '[]',
  valor_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_desconto    NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_tributos    NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pagamento   TEXT,
  link_danfe        TEXT,
  link_xml          TEXT,
  qrcode_url        TEXT,
  xml_retorno       TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','autorizada','cancelada','rejeitada','denegada','inutilizada')),
  motivo_rejeicao   TEXT,
  motivo_cancelamento TEXT,
  cancelada_em      TIMESTAMPTZ,
  cancelada_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  emitida_por       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfce_emitidas_status   ON nfce_emitidas(status);
CREATE INDEX IF NOT EXISTS idx_nfce_emitidas_order    ON nfce_emitidas(order_id);
CREATE INDEX IF NOT EXISTS idx_nfce_emitidas_created  ON nfce_emitidas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfce_provider_id       ON nfce_emitidas(provider_nfce_id);

ALTER TABLE nfce_emitidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfce_emitidas_admin_all" ON nfce_emitidas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfce_emitidas_coordinator_select" ON nfce_emitidas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE OR REPLACE FUNCTION set_updated_at_nfce()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_nfce_emitidas_updated_at
  BEFORE UPDATE ON nfce_emitidas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_nfce();

-- Log imutavel de tentativas
CREATE TABLE IF NOT EXISTS nfce_emission_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfce_id      UUID REFERENCES nfce_emitidas(id) ON DELETE CASCADE,
  tentativa    INT NOT NULL DEFAULT 1,
  iniciado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dados_env    JSONB NOT NULL DEFAULT '{}',
  resposta     JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfce_log_nfce    ON nfce_emission_log(nfce_id);
CREATE INDEX IF NOT EXISTS idx_nfce_log_created ON nfce_emission_log(created_at DESC);

ALTER TABLE nfce_emission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfce_log_admin_select" ON nfce_emission_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfce_log_coordinator_select" ON nfce_emission_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE POLICY "nfce_log_admin_insert" ON nfce_emission_log
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'fiscal',
  'Aplicada migration 158 (nfce_emitidas + nfce_emission_log + store_orders.consumer_*)'
);
