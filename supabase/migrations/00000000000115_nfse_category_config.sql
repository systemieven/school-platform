-- Migration 115: nfse_category_config — Fase 14.S
-- Adiciona campos NFS-e à tabela financial_account_categories

ALTER TABLE financial_account_categories
  ADD COLUMN IF NOT EXISTS gera_nfse            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS codigo_servico        TEXT,
  ADD COLUMN IF NOT EXISTS cnae                  TEXT,
  ADD COLUMN IF NOT EXISTS item_lc116            TEXT,
  ADD COLUMN IF NOT EXISTS descricao_servico_tpl TEXT,
  ADD COLUMN IF NOT EXISTS aliq_iss              NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS reter_pis             BOOLEAN,
  ADD COLUMN IF NOT EXISTS reter_cofins          BOOLEAN,
  ADD COLUMN IF NOT EXISTS reter_csll            BOOLEAN,
  ADD COLUMN IF NOT EXISTS reter_irpj            BOOLEAN,
  ADD COLUMN IF NOT EXISTS reter_inss            BOOLEAN;
