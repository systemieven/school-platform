-- Migration 138: Extend financial_receivables to support store_order source type
-- Adds 'store_order' to source_type CHECK constraint and a UNIQUE constraint
-- on (source_type, source_id) for idempotent upserts from the webhook.

-- ── 1. Drop the existing CHECK constraint and re-create with store_order ──────
ALTER TABLE financial_receivables
  DROP CONSTRAINT IF EXISTS financial_receivables_source_type_check;

ALTER TABLE financial_receivables
  ADD CONSTRAINT financial_receivables_source_type_check
    CHECK (source_type IN ('manual', 'event', 'enrollment', 'cash_movement', 'store_order'));

-- ── 2. UNIQUE index on (source_type, source_id) for idempotency ───────────────
-- Partial index: only rows where source_id IS NOT NULL (manual entries have NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_receivables_source
  ON financial_receivables(source_type, source_id)
  WHERE source_id IS NOT NULL;
