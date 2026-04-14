-- Migration 46: Modulo Financeiro (Fase 8)
-- Tabelas: financial_plans, financial_contracts, financial_installments,
--          financial_notification_log, payment_gateways, gateway_customers, gateway_webhook_log
-- Tambem expande students.status com novos valores.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Expandir students.status CHECK
-- ══════════════════════════════════════════════════════════════════════════════

-- Remover constraint antiga e adicionar com novos valores
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check
  CHECK (status IN ('active', 'inactive', 'transferred', 'cancelled', 'graduated'));

-- Adicionar school_year se nao existir
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_year INTEGER DEFAULT EXTRACT(YEAR FROM now());

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. payment_gateways — Gateways de pagamento configurados por tenant
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_gateways (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         TEXT NOT NULL CHECK (provider IN ('manual', 'asaas', 'efi', 'iugu', 'pagarme', 'vindi', 'pagseguro', 'mercadopago', 'sicredi')),
  label            TEXT NOT NULL DEFAULT '',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_default       BOOLEAN NOT NULL DEFAULT FALSE,
  environment      TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  credentials      JSONB NOT NULL DEFAULT '{}',   -- Criptografado com AES-256-CBC antes de salvar
  webhook_secret   TEXT,                           -- Nao retornado ao frontend apos criacao
  supported_methods TEXT[] NOT NULL DEFAULT ARRAY['boleto', 'pix']::TEXT[],
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas 1 gateway padrao por tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateways_default
  ON payment_gateways (is_default) WHERE is_default = TRUE;

ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access payment_gateways"
  ON payment_gateways FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. financial_plans — Planos de mensalidade
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_plans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  description              TEXT,
  amount                   NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  installments             INTEGER NOT NULL DEFAULT 12 CHECK (installments > 0),
  due_day                  INTEGER NOT NULL DEFAULT 10 CHECK (due_day BETWEEN 1 AND 28),
  punctuality_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (punctuality_discount_pct >= 0 AND punctuality_discount_pct <= 100),
  late_fee_pct             NUMERIC(5,2) NOT NULL DEFAULT 2 CHECK (late_fee_pct >= 0),
  interest_rate_pct        NUMERIC(5,4) NOT NULL DEFAULT 0.033 CHECK (interest_rate_pct >= 0),  -- % ao dia
  segment_ids              UUID[] NOT NULL DEFAULT '{}',
  school_year              INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_plans"
  ON financial_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view financial_plans"
  ON financial_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. financial_contracts — Contratos financeiros por aluno/ano
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  plan_id         UUID NOT NULL REFERENCES financial_plans(id) ON DELETE RESTRICT,
  school_year     INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'suspended', 'cancelled', 'concluded')),
  discount_type   TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  NUMERIC(10,2) DEFAULT 0,
  net_amount      NUMERIC(10,2),   -- Valor liquido apos desconto (calculado)
  gateway_id      UUID REFERENCES payment_gateways(id) ON DELETE SET NULL,
  notes           TEXT,
  activated_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, school_year)
);

CREATE INDEX IF NOT EXISTS idx_financial_contracts_student ON financial_contracts(student_id);
CREATE INDEX IF NOT EXISTS idx_financial_contracts_status ON financial_contracts(status);
CREATE INDEX IF NOT EXISTS idx_financial_contracts_year ON financial_contracts(school_year);

ALTER TABLE financial_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_contracts"
  ON financial_contracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view financial_contracts"
  ON financial_contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. financial_installments — Parcelas individuais
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_installments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id          UUID NOT NULL REFERENCES financial_contracts(id) ON DELETE CASCADE,
  student_id           UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  installment_number   INTEGER NOT NULL CHECK (installment_number > 0),
  reference_month      TEXT NOT NULL,  -- "2026-01", "2026-02", etc.
  due_date             DATE NOT NULL,
  amount               NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  amount_with_discount NUMERIC(10,2),  -- Valor com desconto pontualidade (se pago ate o vencimento)
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'paid', 'overdue', 'negotiated', 'cancelled', 'renegotiated')),
  paid_at              TIMESTAMPTZ,
  paid_amount          NUMERIC(10,2),
  payment_method       TEXT CHECK (payment_method IN ('boleto', 'pix', 'credit_card', 'debit_card', 'cash', 'transfer', 'other')),
  payment_notes        TEXT,

  -- Gateway fields
  gateway_id           UUID REFERENCES payment_gateways(id) ON DELETE SET NULL,
  provider_charge_id   TEXT,          -- ID da cobranca no gateway
  boleto_url           TEXT,
  pix_code             TEXT,
  payment_link         TEXT,          -- Link unificado de pagamento
  gateway_fee_cents    INTEGER,       -- Taxa do gateway
  gateway_raw_response JSONB,         -- Ultima resposta bruta (debug)

  -- Juros e multa calculados
  late_fee_amount      NUMERIC(10,2) DEFAULT 0,
  interest_amount      NUMERIC(10,2) DEFAULT 0,
  total_due            NUMERIC(10,2),  -- amount + late_fee + interest (calculado)

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_financial_installments_student ON financial_installments(student_id);
CREATE INDEX IF NOT EXISTS idx_financial_installments_contract ON financial_installments(contract_id);
CREATE INDEX IF NOT EXISTS idx_financial_installments_status ON financial_installments(status);
CREATE INDEX IF NOT EXISTS idx_financial_installments_due_date ON financial_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_installments_overdue
  ON financial_installments(due_date, status) WHERE status = 'pending';

ALTER TABLE financial_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_installments"
  ON financial_installments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view financial_installments"
  ON financial_installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- Alunos podem ver suas proprias parcelas (portal)
CREATE POLICY "Student view own installments"
  ON financial_installments FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s WHERE s.auth_user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. financial_notification_log — Log da regua de cobranca
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_notification_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id      UUID NOT NULL REFERENCES financial_installments(id) ON DELETE CASCADE,
  trigger_type        TEXT NOT NULL CHECK (trigger_type IN ('D-5', 'D-1', 'D+0', 'D+3', 'D+10', 'D+30', 'payment_confirmed', 'manual')),
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  whatsapp_message_id UUID REFERENCES whatsapp_message_log(id) ON DELETE SET NULL,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_notification_log_installment
  ON financial_notification_log(installment_id);
CREATE INDEX IF NOT EXISTS idx_financial_notification_log_trigger
  ON financial_notification_log(trigger_type, sent_at);

ALTER TABLE financial_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_notification_log"
  ON financial_notification_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. gateway_customers — Cache de clientes no gateway
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gateway_customers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id           UUID NOT NULL REFERENCES payment_gateways(id) ON DELETE CASCADE,
  student_id           UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  provider_customer_id TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gateway_id, student_id)
);

ALTER TABLE gateway_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access gateway_customers"
  ON gateway_customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. gateway_webhook_log — Log de eventos de webhook
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gateway_webhook_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id         UUID REFERENCES payment_gateways(id) ON DELETE SET NULL,
  provider           TEXT NOT NULL,
  event_type         TEXT NOT NULL,
  provider_charge_id TEXT,
  installment_id     UUID REFERENCES financial_installments(id) ON DELETE SET NULL,
  normalized         JSONB NOT NULL DEFAULT '{}',  -- NormalizedWebhookEvent
  raw                JSONB NOT NULL DEFAULT '{}',  -- Payload bruto preservado
  processed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotencia: evitar processar mesmo evento 2x
CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_webhook_idempotent
  ON gateway_webhook_log(provider, provider_charge_id, event_type);

CREATE INDEX IF NOT EXISTS idx_gateway_webhook_log_installment
  ON gateway_webhook_log(installment_id);

ALTER TABLE gateway_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access gateway_webhook_log"
  ON gateway_webhook_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. Modulos de permissao — Financeiro
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on) VALUES
  ('financial',             'Financeiro',              'Dashboard financeiro com metricas de receita e inadimplencia',     'DollarSign',    'financeiro', 20, TRUE, ARRAY['students']),
  ('financial-plans',       'Planos de Mensalidade',   'Cadastro de planos de pagamento por segmento e ano letivo',       'FileText',      'financeiro', 21, TRUE, ARRAY['financial']),
  ('financial-contracts',   'Contratos',               'Contratos financeiros vinculando aluno, plano e descontos',       'FileSignature', 'financeiro', 22, TRUE, ARRAY['financial', 'students']),
  ('financial-installments','Parcelas / Cobrancas',    'Gestao de parcelas, baixa manual, negociacao de divida',          'Receipt',       'financeiro', 23, TRUE, ARRAY['financial-contracts']),
  ('financial-reports',     'Relatorios Financeiros',  'Extrato, fluxo de caixa, inadimplencia, projecao',               'BarChart3',     'financeiro', 24, TRUE, ARRAY['financial']),
  ('payment-gateways',      'Gateways de Pagamento',  'Configuracao de provedores de pagamento (Asaas, Efi, etc.)',      'CreditCard',    'financeiro', 25, TRUE, ARRAY['financial'])
ON CONFLICT (key) DO NOTHING;

-- Permissoes default
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import) VALUES
  -- Admin: acesso total
  ('admin', 'financial',              TRUE, TRUE, TRUE, TRUE, TRUE),
  ('admin', 'financial-plans',        TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'financial-contracts',    TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'financial-installments', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin', 'financial-reports',      TRUE, TRUE, TRUE, FALSE, FALSE),
  ('admin', 'payment-gateways',       TRUE, TRUE, TRUE, TRUE, FALSE),
  -- Coordinator: somente leitura
  ('coordinator', 'financial',              TRUE, FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-plans',        TRUE, FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-contracts',    TRUE, FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-installments', TRUE, FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-reports',      TRUE, FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'payment-gateways',       FALSE, FALSE, FALSE, FALSE, FALSE),
  -- Teacher e User: sem acesso
  ('teacher', 'financial',              FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'financial-plans',        FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'financial-contracts',    FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'financial-installments', FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'financial-reports',      FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher', 'payment-gateways',       FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial',              FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial-plans',        FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial-contracts',    FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial-installments', FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'financial-reports',      FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user', 'payment-gateways',       FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 10. WhatsApp — Nova categoria financeiro
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO whatsapp_template_categories (key, label, color)
VALUES ('financeiro', 'Financeiro', '#14532d')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 11. Funcao para gerar parcelas ao ativar contrato
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_installments_for_contract(p_contract_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract  financial_contracts%ROWTYPE;
  v_plan      financial_plans%ROWTYPE;
  v_amount    NUMERIC(10,2);
  v_due       DATE;
  v_count     INTEGER := 0;
  v_i         INTEGER;
  v_month     DATE;
BEGIN
  SELECT * INTO v_contract FROM financial_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado: %', p_contract_id; END IF;

  SELECT * INTO v_plan FROM financial_plans WHERE id = v_contract.plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano nao encontrado: %', v_contract.plan_id; END IF;

  -- Calcular valor liquido
  v_amount := v_plan.amount;
  IF v_contract.discount_type = 'percentage' AND v_contract.discount_value > 0 THEN
    v_amount := v_amount * (1 - v_contract.discount_value / 100);
  ELSIF v_contract.discount_type = 'fixed' AND v_contract.discount_value > 0 THEN
    v_amount := v_amount - v_contract.discount_value;
  END IF;
  IF v_amount < 0 THEN v_amount := 0; END IF;

  -- Atualizar net_amount no contrato
  UPDATE financial_contracts SET net_amount = v_amount WHERE id = p_contract_id;

  -- Valor por parcela
  v_amount := ROUND(v_amount / v_plan.installments, 2);

  -- Gerar parcelas
  FOR v_i IN 1..v_plan.installments LOOP
    -- Mes de referencia: janeiro do school_year + (i-1)
    v_month := make_date(v_contract.school_year, 1, 1) + ((v_i - 1) || ' months')::INTERVAL;
    v_due   := make_date(EXTRACT(YEAR FROM v_month)::INTEGER, EXTRACT(MONTH FROM v_month)::INTEGER, LEAST(v_plan.due_day, 28));

    INSERT INTO financial_installments (
      contract_id, student_id, installment_number, reference_month,
      due_date, amount, amount_with_discount, status
    ) VALUES (
      p_contract_id, v_contract.student_id, v_i,
      to_char(v_month, 'YYYY-MM'),
      v_due, v_amount,
      ROUND(v_amount * (1 - v_plan.punctuality_discount_pct / 100), 2),
      CASE WHEN v_due < CURRENT_DATE THEN 'overdue' ELSE 'pending' END
    )
    ON CONFLICT (contract_id, installment_number) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 12. Funcao para calcular juros/multa de parcela em atraso
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_overdue_amounts(p_installment_id UUID)
RETURNS TABLE(late_fee NUMERIC, interest NUMERIC, total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inst      financial_installments%ROWTYPE;
  v_plan      financial_plans%ROWTYPE;
  v_days      INTEGER;
  v_late_fee  NUMERIC(10,2) := 0;
  v_interest  NUMERIC(10,2) := 0;
BEGIN
  SELECT * INTO v_inst FROM financial_installments WHERE id = p_installment_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT fp.* INTO v_plan
  FROM financial_plans fp
  JOIN financial_contracts fc ON fc.plan_id = fp.id
  WHERE fc.id = v_inst.contract_id;

  v_days := GREATEST(0, CURRENT_DATE - v_inst.due_date);

  IF v_days > 0 THEN
    v_late_fee := ROUND(v_inst.amount * v_plan.late_fee_pct / 100, 2);
    v_interest := ROUND(v_inst.amount * v_plan.interest_rate_pct / 100 * v_days, 2);
  END IF;

  RETURN QUERY SELECT v_late_fee, v_interest, v_inst.amount + v_late_fee + v_interest;
END;
$$;
