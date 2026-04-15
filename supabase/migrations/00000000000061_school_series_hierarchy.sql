-- Migration 61: Hierarquia 3 niveis Seguimento -> Serie -> Turma
--
-- Cria a tabela school_series como nivel intermediario entre school_segments
-- e school_classes. Adiciona FK series_id NOT NULL em school_classes (ambiente
-- limpo, sem necessidade de backfill) e renomeia year -> school_year para
-- consistencia com student_results.school_year e student_transcripts.school_year.
--
-- Regras de negocio habilitadas (implementadas em PRs subsequentes):
--   - Series sao permanentes; turmas sao por ano letivo.
--   - Aluno avanca/repete serie ao final do ano letivo.
--   - Limite max_students exige override por gestor.

-- 1. school_series
CREATE TABLE IF NOT EXISTS school_series (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  UUID        NOT NULL REFERENCES school_segments(id) ON DELETE RESTRICT,
  name        TEXT        NOT NULL,
  short_name  TEXT,
  order_index INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (segment_id, name)
);

CREATE INDEX IF NOT EXISTS idx_school_series_segment ON school_series (segment_id, order_index);

ALTER TABLE school_series ENABLE ROW LEVEL SECURITY;

-- Espelha policy de school_segments (admin+ leitura/escrita)
CREATE POLICY "Admin full access on school_series" ON school_series FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator')));

-- 2. school_classes: adicionar series_id (NOT NULL — ambiente limpo confirmado)
ALTER TABLE school_classes
  ADD COLUMN series_id UUID NOT NULL REFERENCES school_series(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_school_classes_series ON school_classes (series_id);

-- 3. Renomear year -> school_year (consistencia com outras tabelas academicas)
ALTER TABLE school_classes RENAME COLUMN year TO school_year;

-- 4. Indice composto para queries por serie+ano
CREATE INDEX IF NOT EXISTS idx_school_classes_series_year ON school_classes (series_id, school_year);

-- (Sem trigger de updated_at — segue o padrao das outras tabelas school_*,
--  o app seta updated_at manualmente no payload de UPDATE.)
