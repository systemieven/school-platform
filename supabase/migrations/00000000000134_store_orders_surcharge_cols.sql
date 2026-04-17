-- Migration 134: colunas de acréscimo em store_orders
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS surcharge_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_amount  NUMERIC(12,2) NOT NULL DEFAULT 0;
