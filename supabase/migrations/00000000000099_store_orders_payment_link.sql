-- Migration 99: Adicionar colunas de link de pagamento online em store_orders
-- Necessário para integração PDV com gateways (Asaas, etc.)

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS payment_link  TEXT,
  ADD COLUMN IF NOT EXISTS pix_code      TEXT,
  ADD COLUMN IF NOT EXISTS boleto_url    TEXT;
