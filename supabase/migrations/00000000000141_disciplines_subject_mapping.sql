-- Migration 141: Opção A — disciplines como tabela canônica
-- Liga disciplines → school_subjects via subject_id; popula discipline_id
-- em class_diary_entries e class_exams a partir do mapeamento de nomes.

-- ── 1. FK disciplines → school_subjects ─────────────────────────────────────
ALTER TABLE disciplines
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES school_subjects(id) ON DELETE SET NULL;

-- ── 2. Auto-mapeamento por nome (case-insensitive, sem espaços extras) ────────
UPDATE disciplines d
SET subject_id = s.id
FROM school_subjects s
WHERE d.subject_id IS NULL
  AND LOWER(TRIM(d.name)) = LOWER(TRIM(s.name));

-- ── 3. discipline_id em class_diary_entries ──────────────────────────────────
ALTER TABLE class_diary_entries
  ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines(id) ON DELETE SET NULL;

-- Popula registros existentes via mapeamento
UPDATE class_diary_entries cde
SET discipline_id = d.id
FROM disciplines d
WHERE cde.discipline_id IS NULL
  AND cde.subject_id IS NOT NULL
  AND d.subject_id = cde.subject_id;

-- ── 4. Popula class_exams.discipline_id (coluna criada na migration 140) ─────
UPDATE class_exams ce
SET discipline_id = d.id
FROM disciplines d
WHERE ce.discipline_id IS NULL
  AND ce.subject_id IS NOT NULL
  AND d.subject_id = ce.subject_id;
