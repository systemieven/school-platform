-- Migration 141: discipline_id em class_diary_entries + subject_id em disciplines
-- Opção A da consolidação: disciplines como tabela canônica.
-- Nota: school_subjects não existe neste banco — apenas disciplines é usada.
-- subject_id em disciplines é UUID simples (sem FK) para mapeamento futuro
-- caso school_subjects seja criada via migrações anteriores pendentes.

-- ── 1. discipline_id em class_diary_entries ──────────────────────────────────
ALTER TABLE class_diary_entries
  ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines(id) ON DELETE SET NULL;

-- ── 2. subject_id em disciplines (UUID simples, sem FK por ora) ───────────────
ALTER TABLE disciplines
  ADD COLUMN IF NOT EXISTS subject_id UUID;
