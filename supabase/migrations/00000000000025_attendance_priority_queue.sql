-- ============================================================
-- Migration 25 — Prioridade de Atendimento por Agendamento
--
-- Adiciona campos de prioridade em attendance_tickets para que
-- clientes agendados no horário sejam chamados antes dos walk-ins.
-- A posição na fila nunca é armazenada — é sempre calculada.
-- ============================================================

-- 1. Novas colunas
ALTER TABLE attendance_tickets
  ADD COLUMN IF NOT EXISTS priority_group SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS scheduled_time TIME NULL;

COMMENT ON COLUMN attendance_tickets.priority_group IS '1 = agendado no horário (Grupo Prioritário), 2 = walk-in ou fora do horário (Grupo Normal)';
COMMENT ON COLUMN attendance_tickets.scheduled_time IS 'Horário do agendamento copiado na emissão do ticket. NULL para walk-ins e agendamentos fora da janela.';

-- 2. Índice para ordenação eficiente da fila
CREATE INDEX IF NOT EXISTS idx_attendance_tickets_queue_order
  ON attendance_tickets(status, priority_group, scheduled_time, issued_at);

-- 3. Setting de configuração da prioridade
INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'priority_queue',
   '{"enabled": false, "window_minutes_before": 30, "window_minutes_after": 30, "show_type_indicator": true}'::jsonb,
   'Prioridade por agendamento na fila de atendimento')
ON CONFLICT (category, key) DO NOTHING;
