-- Migration 122: fornecedor_contas_bancarias — Fase 14.E: Módulo de Fornecedores
-- Contas bancárias por fornecedor (N:1).
-- Trigger garante no máximo uma conta is_default = true por fornecedor.

CREATE TABLE IF NOT EXISTS fornecedor_contas_bancarias (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id   UUID    NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  banco_codigo    TEXT,
  banco_nome      TEXT,
  agencia         TEXT,
  conta           TEXT,
  tipo_conta      TEXT    CHECK (tipo_conta IN ('corrente','poupanca','pagamento','')),
  tipo_chave_pix  TEXT    CHECK (tipo_chave_pix IN ('cpf_cnpj','email','telefone','aleatoria','')),
  chave_pix       TEXT,
  favorecido      TEXT,   -- nome do titular quando diferente do fornecedor
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcb_fornecedor
  ON fornecedor_contas_bancarias (fornecedor_id);

-- Garante unicidade de is_default = true por fornecedor
CREATE UNIQUE INDEX IF NOT EXISTS idx_fcb_default_unique
  ON fornecedor_contas_bancarias (fornecedor_id)
  WHERE is_default = true;

-- RLS (mesmas regras da tabela pai)
ALTER TABLE fornecedor_contas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcb_admin_all" ON fornecedor_contas_bancarias
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin'))
  );

CREATE POLICY "fcb_coordinator_select" ON fornecedor_contas_bancarias
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coordinator')
  );
