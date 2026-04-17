-- Migration 156: NFS-e auto-emit on installment payment — Sprint 14.S.P.2
--
-- Adiciona flag `auto_emit_on_payment` em `company_nfse_config`. Quando true,
-- o `FinancialInstallmentsPage.handlePay` dispara automaticamente o
-- `nfse-emitter` apos baixar uma parcela. O disparo e client-side
-- (nao via DB trigger) para manter visibilidade do fluxo no UI.

ALTER TABLE company_nfse_config
  ADD COLUMN IF NOT EXISTS auto_emit_on_payment BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN company_nfse_config.auto_emit_on_payment IS
  'Se true, toda baixa de parcela (financial_installments.status=paid) dispara emissao automatica de NFS-e.';

-- Registra motivo de cancelamento (cancelada_em ja existe desde a 117)
ALTER TABLE nfse_emitidas
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'fiscal',
  'Aplicada migration 156 (company_nfse_config.auto_emit_on_payment)'
);
