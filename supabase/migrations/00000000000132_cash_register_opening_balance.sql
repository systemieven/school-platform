-- Migration 132: saldo inicial em caixas
-- Adiciona opening_balance para rastrear o saldo com que cada sessão de caixa foi aberta.

ALTER TABLE financial_cash_registers
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0;
