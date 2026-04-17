-- Migration 135: vincula NF-e de entrada a contas a pagar
ALTER TABLE financial_payables
  ADD COLUMN IF NOT EXISTS nfe_entry_id UUID REFERENCES nfe_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payables_nfe_entry
  ON financial_payables(nfe_entry_id);
