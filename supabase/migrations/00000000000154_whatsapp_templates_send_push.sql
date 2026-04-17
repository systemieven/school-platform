-- Migration 154: PWA Push Notifications — Sprint 13.N.3
--
-- Adiciona flag `send_push` em `whatsapp_templates`. Quando `true`, a notificacao
-- automatica disparada pelo `auto-notify` envia tambem push via `push-send`,
-- alem do WhatsApp (quando aplicavel). O fan-out acontece no
-- `message-orchestrator` e ignora o dedup de telefone (push tem seu proprio
-- ciclo de vida por subscription).

ALTER TABLE whatsapp_templates
  ADD COLUMN IF NOT EXISTS send_push BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN whatsapp_templates.send_push IS
  'Se true, o auto-notify tambem envia push (alem do WhatsApp) quando o template dispara.';

INSERT INTO audit_logs (action, module, description)
VALUES (
  'system.migration',
  'push',
  'Aplicada migration 154 (whatsapp_templates.send_push)'
);
