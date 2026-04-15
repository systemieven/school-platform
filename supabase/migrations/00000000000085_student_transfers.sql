-- Migration 85: Transferencias e Movimentacoes de Alunos (Fase 11)

CREATE TABLE IF NOT EXISTS student_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type                TEXT NOT NULL
                        CHECK (type IN (
                          'internal',       -- mudanca de turma dentro da escola
                          'transfer_out',   -- transferencia para outra escola
                          'trancamento',    -- trancamento de matricula
                          'cancellation'    -- cancelamento de matricula
                        )),
  from_class_id       UUID REFERENCES school_classes(id) ON DELETE SET NULL,
  to_class_id         UUID REFERENCES school_classes(id) ON DELETE SET NULL,  -- apenas para internal
  effective_date      DATE NOT NULL,
  reason              TEXT NOT NULL,
  destination_school  TEXT,                   -- para transfer_out
  declaration_needed  BOOLEAN NOT NULL DEFAULT false,
  declaration_request_id UUID REFERENCES document_requests(id) ON DELETE SET NULL,

  -- Impacto financeiro
  cancel_future_installments BOOLEAN NOT NULL DEFAULT true,
  installments_cancelled     INT NOT NULL DEFAULT 0,     -- quantas foram canceladas

  notes               TEXT,
  processed_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','completed','reversed')),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfers_student ON student_transfers(student_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status  ON student_transfers(status);

ALTER TABLE student_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coordinator full access transfers"
  ON student_transfers FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator'))
  );

-- RPC para processar transferencia interna com cancelamento de parcelas
CREATE OR REPLACE FUNCTION process_internal_transfer(
  p_student_id UUID,
  p_from_class_id UUID,
  p_to_class_id UUID,
  p_effective_date DATE,
  p_reason TEXT
) RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
BEGIN
  -- Cria o registro de transferencia
  INSERT INTO student_transfers (
    student_id, type, from_class_id, to_class_id,
    effective_date, reason, processed_by, status
  ) VALUES (
    p_student_id, 'internal', p_from_class_id, p_to_class_id,
    p_effective_date, p_reason, auth.uid(), 'processing'
  ) RETURNING id INTO v_transfer_id;

  -- Atualiza a turma do aluno
  UPDATE students SET class_id = p_to_class_id WHERE id = p_student_id;

  -- Marca como concluida
  UPDATE student_transfers SET status = 'completed', completed_at = now()
  WHERE id = v_transfer_id;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para cancelamento/trancamento com cancelamento de parcelas futuras
CREATE OR REPLACE FUNCTION process_student_cancellation(
  p_student_id UUID,
  p_type TEXT,   -- 'trancamento' | 'cancellation' | 'transfer_out'
  p_effective_date DATE,
  p_reason TEXT,
  p_destination_school TEXT DEFAULT NULL,
  p_cancel_installments BOOLEAN DEFAULT true
) RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
  v_cancelled INT := 0;
  v_class_id UUID;
BEGIN
  SELECT class_id INTO v_class_id FROM students WHERE id = p_student_id;

  -- Cria o registro de movimentacao
  INSERT INTO student_transfers (
    student_id, type, from_class_id, effective_date, reason,
    destination_school, cancel_future_installments, processed_by, status
  ) VALUES (
    p_student_id, p_type, v_class_id, p_effective_date, p_reason,
    p_destination_school, p_cancel_installments, auth.uid(), 'processing'
  ) RETURNING id INTO v_transfer_id;

  -- Cancela parcelas futuras se solicitado
  IF p_cancel_installments THEN
    UPDATE financial_installments fi
    SET status = 'cancelled'
    FROM financial_contracts fc
    WHERE fc.student_id = p_student_id
      AND fi.contract_id = fc.id
      AND fi.status IN ('pending')
      AND fi.due_date > p_effective_date;
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  END IF;

  -- Atualiza contador e status do aluno
  UPDATE student_transfers SET
    installments_cancelled = v_cancelled,
    status = 'completed',
    completed_at = now()
  WHERE id = v_transfer_id;

  -- Marca o aluno como inativo
  UPDATE students SET is_active = false WHERE id = p_student_id;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_student_transfers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_student_transfers_updated_at
  BEFORE UPDATE ON student_transfers
  FOR EACH ROW EXECUTE FUNCTION update_student_transfers_updated_at();
