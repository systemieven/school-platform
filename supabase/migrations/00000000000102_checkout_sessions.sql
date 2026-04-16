-- Migration 102: checkout_sessions — custom branded checkout
-- Links a payment session (token) to a store_order or financial_installment.
-- The token is the public identifier used in /pagar/:token links.

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token               TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  store_order_id      UUID,   -- soft ref to store_orders (FK added when table exists)
  installment_id      UUID,   -- soft ref to financial_installments (future use)
  gateway_id          UUID REFERENCES payment_gateways(id) ON DELETE SET NULL,
  provider_charge_id  TEXT NOT NULL,
  billing_type        TEXT NOT NULL CHECK (billing_type IN ('PIX','BOLETO','CREDIT_CARD','UNDEFINED')),
  amount              NUMERIC(10,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','expired','cancelled')),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT checkout_session_has_ref CHECK (
    (store_order_id IS NOT NULL) OR (installment_id IS NOT NULL)
  )
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_sessions_token
  ON checkout_sessions(token);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_provider_charge
  ON checkout_sessions(provider_charge_id);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_store_order
  ON checkout_sessions(store_order_id)
  WHERE store_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status
  ON checkout_sessions(status, expires_at);

-- RLS: public read (token is the auth), service role writes
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkout_sessions_public_read" ON checkout_sessions
  FOR SELECT USING (true);
