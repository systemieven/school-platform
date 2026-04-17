-- Migration 136: expande reference_type em financial_cash_movements
-- Aceita também 'installment' e 'order' além de 'receivable' e 'payable'
ALTER TABLE financial_cash_movements
  DROP CONSTRAINT IF EXISTS financial_cash_movements_reference_type_check;

ALTER TABLE financial_cash_movements
  ADD CONSTRAINT financial_cash_movements_reference_type_check
    CHECK (reference_type IN ('receivable', 'payable', 'installment', 'order'));
