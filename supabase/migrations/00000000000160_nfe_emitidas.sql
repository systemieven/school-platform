-- Migration 160: nfe_emitidas + nfe_emission_log — Sprint 14.S.P-ter
--
-- NF-e (modelo 55) emitidas a partir de nfe_entries (devolução ao fornecedor).
-- Cada nfe_entry pode gerar uma ou mais NF-e de devolução (parcial ou total).
--
-- Destinatário é o fornecedor da NF-e original (nfe_entries.emitente_cnpj vira
-- destinatário na devolução). Dados completos de endereço vêm de fornecedores
-- via JOIN por cnpj_cpf, mas são persistidos em JSONB para imutabilidade fiscal.
--
-- tipo_operacao CHECK deixa aberto para expansão futura ('saida_venda' etc.)
-- sem exigir nova migration.

CREATE TABLE IF NOT EXISTS nfe_emitidas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_entry_id      UUID REFERENCES nfe_entries(id) ON DELETE SET NULL,
  tipo_operacao     TEXT NOT NULL DEFAULT 'devolucao'
                      CHECK (tipo_operacao IN ('devolucao')),
  numero            INT,
  serie             INT NOT NULL DEFAULT 1,
  chave_nfe         TEXT,
  protocolo         TEXT,
  provider_nfe_id   TEXT,
  emitente          JSONB NOT NULL DEFAULT '{}',
  destinatario      JSONB NOT NULL DEFAULT '{}',
  itens             JSONB NOT NULL DEFAULT '[]',
  transp            JSONB NOT NULL DEFAULT '{}',
  referencia        JSONB NOT NULL DEFAULT '{}',
  valor_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_desconto    NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_tributos    NUMERIC(12,2) NOT NULL DEFAULT 0,
  motivo_operacao   TEXT,
  link_danfe        TEXT,
  link_xml          TEXT,
  xml_retorno       TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','autorizada','cancelada','rejeitada','denegada','inutilizada')),
  motivo_rejeicao   TEXT,
  motivo_cancelamento TEXT,
  autorizada_em     TIMESTAMPTZ,
  cancelada_em      TIMESTAMPTZ,
  cancelada_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  emitida_por       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfe_emitidas_status    ON nfe_emitidas(status);
CREATE INDEX IF NOT EXISTS idx_nfe_emitidas_entry     ON nfe_emitidas(nfe_entry_id);
CREATE INDEX IF NOT EXISTS idx_nfe_emitidas_created   ON nfe_emitidas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfe_provider_id        ON nfe_emitidas(provider_nfe_id);

ALTER TABLE nfe_emitidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_emitidas_admin_all" ON nfe_emitidas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfe_emitidas_coordinator_select" ON nfe_emitidas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE OR REPLACE FUNCTION set_updated_at_nfe()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_nfe_emitidas_updated_at
  BEFORE UPDATE ON nfe_emitidas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_nfe();

-- Log imutável de tentativas (análogo ao NFC-e/NFS-e)
CREATE TABLE IF NOT EXISTS nfe_emission_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_id       UUID REFERENCES nfe_emitidas(id) ON DELETE CASCADE,
  tentativa    INT NOT NULL DEFAULT 1,
  iniciado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dados_env    JSONB NOT NULL DEFAULT '{}',
  resposta     JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfe_log_nfe     ON nfe_emission_log(nfe_id);
CREATE INDEX IF NOT EXISTS idx_nfe_log_created ON nfe_emission_log(created_at DESC);

ALTER TABLE nfe_emission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_log_admin_select" ON nfe_emission_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE POLICY "nfe_log_coordinator_select" ON nfe_emission_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator'));

CREATE POLICY "nfe_log_admin_insert" ON nfe_emission_log
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'fiscal',
  'Aplicada migration 160 (nfe_emitidas + nfe_emission_log)'
);
