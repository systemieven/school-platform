-- Migration 72: RPCs de Integração — Geração automática de recebíveis
-- a partir de pré-matrículas confirmadas e de eventos com taxa.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. RPC: criar receivable a partir de pré-matrícula confirmada
-- ══════════════════════════════════════════════════════════════════════════════
-- Lê a taxa de matrícula de system_settings (category='financial', key='enrollment_fee').
-- Se a chave não existir ou o valor for 0, não cria receivable (silencioso).
-- Chamada pelo frontend ao confirmar/aprovar uma pré-matrícula.

CREATE OR REPLACE FUNCTION create_enrollment_receivable(p_enrollment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enrollment    RECORD;
  v_student       RECORD;
  v_fee           NUMERIC(12,2);
  v_fee_raw       TEXT;
  v_category_id   UUID;
  v_receivable_id UUID;
BEGIN
  -- Buscar pré-matrícula
  SELECT * INTO v_enrollment FROM pre_enrollments WHERE id = p_enrollment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pré-matrícula não encontrada: %', p_enrollment_id;
  END IF;

  -- Buscar taxa de matrícula das configurações
  SELECT value INTO v_fee_raw
  FROM system_settings
  WHERE category = 'financial' AND key = 'enrollment_fee';

  v_fee := COALESCE(v_fee_raw::NUMERIC, 0);
  IF v_fee <= 0 THEN
    RETURN NULL; -- sem taxa configurada
  END IF;

  -- Verificar se já existe receivable para esta matrícula
  SELECT id INTO v_receivable_id
  FROM financial_receivables
  WHERE source_type = 'enrollment' AND source_id = p_enrollment_id;
  IF FOUND THEN
    RETURN v_receivable_id; -- idempotente
  END IF;

  -- Categoria padrão: Matrículas
  SELECT id INTO v_category_id
  FROM financial_account_categories
  WHERE name = 'Matrículas' AND type = 'receita'
  LIMIT 1;

  -- Criar receivable
  INSERT INTO financial_receivables (
    payer_name, payer_type, student_id,
    amount, account_category_id, description,
    due_date, status, source_type, source_id
  )
  VALUES (
    COALESCE(v_enrollment.student_name, v_enrollment.responsible_name, 'Não informado'),
    'external',
    NULL, -- student ainda pode não existir no momento da pré-matrícula
    v_fee,
    v_category_id,
    'Taxa de matrícula',
    CURRENT_DATE + 7,  -- vencimento: 7 dias a partir de hoje
    'pending',
    'enrollment',
    p_enrollment_id
  )
  RETURNING id INTO v_receivable_id;

  RETURN v_receivable_id;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. RPC: criar receivables para participantes de evento com taxa
-- ══════════════════════════════════════════════════════════════════════════════
-- Chamada pelo frontend ao publicar um evento com registration_fee > 0.
-- Gera um receivable por participante confirmado (idempotente).

CREATE OR REPLACE FUNCTION create_event_receivables(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event         RECORD;
  v_participant   RECORD;
  v_category_id   UUID;
  v_count         INTEGER := 0;
BEGIN
  -- Buscar evento
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado: %', p_event_id;
  END IF;

  -- Verificar se há taxa (campo registration_fee ou similar na tabela events)
  IF COALESCE(v_event.registration_fee, 0) <= 0 THEN
    RETURN 0;
  END IF;

  -- Categoria padrão: Taxas e Eventos
  SELECT id INTO v_category_id
  FROM financial_account_categories
  WHERE name = 'Taxas e Eventos' AND type = 'receita'
  LIMIT 1;

  -- Para cada participante confirmado, criar receivable (idempotente via source_id)
  FOR v_participant IN
    SELECT ep.*, s.full_name AS student_name, s.id AS student_id
    FROM event_participants ep
    LEFT JOIN students s ON s.id = ep.student_id
    WHERE ep.event_id = p_event_id
      AND ep.status = 'confirmed'
  LOOP
    -- Verificar se já existe receivable
    IF EXISTS (
      SELECT 1 FROM financial_receivables
      WHERE source_type = 'event'
        AND source_id = p_event_id
        AND (student_id = v_participant.student_id OR (student_id IS NULL AND payer_name = COALESCE(v_participant.student_name, v_participant.participant_name)))
    ) THEN
      CONTINUE; -- idempotente
    END IF;

    INSERT INTO financial_receivables (
      payer_name, payer_type, student_id,
      amount, account_category_id, description,
      due_date, status, source_type, source_id
    ) VALUES (
      COALESCE(v_participant.student_name, v_participant.participant_name, 'Participante'),
      CASE WHEN v_participant.student_id IS NOT NULL THEN 'student' ELSE 'external' END,
      v_participant.student_id,
      v_event.registration_fee,
      v_category_id,
      'Taxa de evento: ' || v_event.title,
      COALESCE(v_event.event_date::DATE - 3, CURRENT_DATE + 7),
      'pending',
      'event',
      p_event_id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
