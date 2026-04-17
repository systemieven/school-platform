-- Migration 133: tabela de acréscimos por forma de pagamento
CREATE TABLE IF NOT EXISTS store_payment_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  surcharge_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (surcharge_pct >= 0),
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','pdv','store')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE store_payment_surcharges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON store_payment_surcharges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Allow anonymous read for public checkout page
CREATE POLICY "anon_read" ON store_payment_surcharges
  FOR SELECT TO anon USING (true);
