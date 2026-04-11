-- ============================================================
-- Migration 31 — Atomic ticket claiming functions
--
-- Two SECURITY DEFINER functions that bypass RLS to allow
-- atomic claim/recall of attendance tickets using
-- SELECT ... FOR UPDATE SKIP LOCKED.
-- ============================================================

-- -----------------------------------------------------------------
-- 1. claim_next_ticket
--
-- Atomically picks the next waiting ticket from the queue,
-- respecting the priority sort order:
--   priority_group ASC  (0=transferred, 1=scheduled, 2=walk-in)
--   For group 1: scheduled_time ASC, issued_at ASC
--   Otherwise:   issued_at ASC
--
-- If p_sector_keys is provided, only tickets in those sectors
-- are considered. Sets status='called', called_at=now(),
-- called_by=p_caller_id and returns the full row.
-- Returns empty result set when no ticket is available.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_next_ticket(
  p_sector_keys TEXT[] DEFAULT NULL,
  p_caller_id   UUID DEFAULT NULL
)
RETURNS SETOF attendance_tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  -- Atomically lock and select the next waiting ticket
  SELECT t.id INTO v_ticket_id
  FROM attendance_tickets t
  WHERE t.status = 'waiting'
    AND (p_sector_keys IS NULL OR t.sector_key = ANY(p_sector_keys))
  ORDER BY
    t.priority_group ASC,
    CASE WHEN t.priority_group = 1
         THEN t.scheduled_time
         ELSE NULL
    END ASC NULLS LAST,
    t.issued_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- No ticket available
  IF v_ticket_id IS NULL THEN
    RETURN;
  END IF;

  -- Claim the ticket
  RETURN QUERY
    UPDATE attendance_tickets
    SET status    = 'called',
        called_at = now(),
        called_by = p_caller_id
    WHERE id = v_ticket_id
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION claim_next_ticket(TEXT[], UUID) IS
  'Atomically claims the next waiting ticket from the priority queue. Uses FOR UPDATE SKIP LOCKED to prevent race conditions.';

-- -----------------------------------------------------------------
-- 2. recall_ticket
--
-- Re-calls an already-called ticket (e.g. when the visitor
-- did not show up at the counter). Updates called_at to now()
-- so the display refreshes. Uses FOR UPDATE SKIP LOCKED to
-- prevent concurrent modifications.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION recall_ticket(
  p_ticket_id  UUID,
  p_caller_id  UUID
)
RETURNS SETOF attendance_tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  -- Lock the specific ticket if it is currently in 'called' status
  SELECT t.id INTO v_ticket_id
  FROM attendance_tickets t
  WHERE t.id = p_ticket_id
    AND t.status = 'called'
  FOR UPDATE SKIP LOCKED;

  -- Ticket not found, not in called status, or locked by another session
  IF v_ticket_id IS NULL THEN
    RETURN;
  END IF;

  -- Update called_at to signal a recall
  RETURN QUERY
    UPDATE attendance_tickets
    SET called_at = now(),
        called_by = p_caller_id
    WHERE id = v_ticket_id
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION recall_ticket(UUID, UUID) IS
  'Recalls an already-called ticket by refreshing called_at. Uses FOR UPDATE SKIP LOCKED to prevent concurrent modifications.';
