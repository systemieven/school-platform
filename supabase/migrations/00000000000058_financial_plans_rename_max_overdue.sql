-- Migration 58: Semantica correta — prazo maximo de pagamento pelo portal
-- Apos esse periodo a parcela vai para cobranca extrajudicial e e bloqueada no portal
-- Renomeia grace_days → max_overdue_days e expande o intervalo para 0-90 dias

ALTER TABLE financial_plans
  DROP CONSTRAINT IF EXISTS financial_plans_grace_days_check;

ALTER TABLE financial_plans
  RENAME COLUMN grace_days TO max_overdue_days;

ALTER TABLE financial_plans
  ADD CONSTRAINT financial_plans_max_overdue_days_check
    CHECK (max_overdue_days >= 0 AND max_overdue_days <= 90);

COMMENT ON COLUMN financial_plans.max_overdue_days IS
  'Dias maximos apos vencimento em que o portal ainda aceita pagamento. 0 = sem limite. Apos esse periodo, a parcela e considerada em cobranca extrajudicial e o botao de pagamento e bloqueado no portal.';
