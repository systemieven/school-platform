-- Migration 68: Controle de Caixas
-- Tabelas: financial_cash_registers, financial_cash_movements

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. financial_cash_registers — Caixas
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_cash_registers (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  description          TEXT,
  responsible_user_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  status               TEXT        NOT NULL DEFAULT 'closed'
                                   CHECK (status IN ('open', 'closed')),
  current_balance      NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_cash_registers"
  ON financial_cash_registers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Coordinator NÃO tem acesso a caixas (operação sensível)

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. financial_cash_movements — Movimentações
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_cash_movements (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id      UUID        NOT NULL
                                    REFERENCES financial_cash_registers(id) ON DELETE RESTRICT,
  type                  TEXT        NOT NULL
                                    CHECK (type IN (
                                      'opening',    -- Abertura do caixa
                                      'closing',    -- Fechamento do caixa
                                      'sangria',    -- Retirada com justificativa
                                      'suprimento', -- Reforço com justificativa
                                      'inflow',     -- Entrada avulsa
                                      'outflow'     -- Saída avulsa
                                    )),
  sub_type              TEXT        CHECK (sub_type IN (
                                      'recebimento',        -- Entrada: recebimento de pagante
                                      'devolucao',          -- Entrada: estorno de recebimento
                                      'taxa_evento',        -- Entrada: taxa de evento
                                      'taxa_passeio',       -- Entrada: taxa de passeio
                                      'taxa_diversa',       -- Entrada: taxa livre
                                      'despesa_operacional' -- Saída: despesa operacional
                                    )),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_after         NUMERIC(12,2) NOT NULL,  -- saldo snapshot imediatamente após este movimento
  description           TEXT        NOT NULL,
  payer_name            TEXT,                     -- identificação do pagante (para recebimentos)
  payment_method        TEXT,                     -- cash, pix, credit_card, debit_card, transfer, boleto, other
  account_category_id   UUID        REFERENCES financial_account_categories(id) ON DELETE SET NULL,
  event_id              UUID,                     -- FK opcional para events (sem FK rígida por flexibilidade)
  reference_id          UUID,                     -- FK polimórfica: receivable ou payable
  reference_type        TEXT        CHECK (reference_type IN ('receivable', 'payable')),
  receipt_url           TEXT,
  receipt_path          TEXT,
  recorded_by           UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  movement_date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_register
  ON financial_cash_movements(cash_register_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_date
  ON financial_cash_movements(movement_date);

CREATE INDEX IF NOT EXISTS idx_cash_movements_type
  ON financial_cash_movements(type, sub_type);

ALTER TABLE financial_cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_cash_movements"
  ON financial_cash_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );
