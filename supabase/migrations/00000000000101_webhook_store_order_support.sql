-- Migration 101: Add store_order_id to gateway_webhook_log
-- Allows webhook processor to link a log entry to a store_order
-- when there is no matching financial_installment for the charge.

-- store_order_id added without FK to avoid dependency on migration order
ALTER TABLE gateway_webhook_log
  ADD COLUMN IF NOT EXISTS store_order_id UUID;

CREATE INDEX IF NOT EXISTS idx_gateway_webhook_log_store_order
  ON gateway_webhook_log(store_order_id)
  WHERE store_order_id IS NOT NULL;
