-- ============================================================
-- Transferência de atendimento entre setores
-- ============================================================

-- 1. Campos de transferência no ticket
ALTER TABLE attendance_tickets
  ADD COLUMN IF NOT EXISTS transferred_from_sector_key TEXT,
  ADD COLUMN IF NOT EXISTS transferred_from_sector_label TEXT,
  ADD COLUMN IF NOT EXISTS transfer_reason TEXT,
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transferred_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN attendance_tickets.priority_group IS
  '0 = transferido (topo da fila), 1 = agendado no horário, 2 = walk-in ou fora do horário';

-- 2. Histórico de transferências (suporta múltiplas transferências por ticket)
CREATE TABLE IF NOT EXISTS attendance_transfer_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES attendance_tickets(id) ON DELETE CASCADE,
  from_sector_key   TEXT NOT NULL,
  from_sector_label TEXT NOT NULL,
  to_sector_key     TEXT NOT NULL,
  to_sector_label   TEXT NOT NULL,
  reason            TEXT,
  transferred_by    UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_history_ticket
  ON attendance_transfer_history(ticket_id);

-- 3. RLS
ALTER TABLE attendance_transfer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read transfer_history" ON attendance_transfer_history
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin','admin','coordinator','teacher','user')
  ));

CREATE POLICY "Staff insert transfer_history" ON attendance_transfer_history
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin','admin','coordinator','teacher','user')
  ));

-- 4. Seed setting de transferência
INSERT INTO system_settings (category, key, value, description) VALUES
  ('attendance', 'transfer',
   '{"enabled":true,"quick_reasons":["Motivo incorreto no agendamento","Assunto resolvido por outro setor","Solicitação do cliente","Erro de triagem"]}'::jsonb,
   'Configuração de transferência de senhas entre setores')
ON CONFLICT (category, key) DO NOTHING;
