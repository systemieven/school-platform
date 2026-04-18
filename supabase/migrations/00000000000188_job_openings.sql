-- 188: Fase 16 PR2 — Vagas (`job_openings`)
--
-- Vagas abertas pela escola. Requisitos vão no prompt do agente
-- `resume_screener` (PR3) para pontuar candidatos.
--
-- RLS via módulo `rh-seletivo`. Admin/super_admin ALL.
-- Leitura pública (anon) das vagas `status='published'` para a página
-- `/trabalhe-conosco` (PR4) — a listagem pública respeita o RLS anônimo.

CREATE TABLE IF NOT EXISTS job_openings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  department         TEXT,
  location           TEXT,
  description        TEXT,                        -- HTML (HtmlTemplateEditor)
  requirements       TEXT,                        -- texto plano — entra no prompt do screener
  employment_type    TEXT NOT NULL
                     CHECK (employment_type IN ('clt','pj','estagio','terceirizado')),
  salary_range_min   NUMERIC(10,2),
  salary_range_max   NUMERIC(10,2),
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','published','paused','closed')),
  opened_at          TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_openings_status ON job_openings(status);
CREATE INDEX IF NOT EXISTS idx_job_openings_department ON job_openings(department);

CREATE TRIGGER trg_job_openings_updated_at
  BEFORE UPDATE ON job_openings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Opened_at auto-set quando status vira 'published'
-- ============================================================
CREATE OR REPLACE FUNCTION set_job_opening_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status <> 'published' AND NEW.opened_at IS NULL THEN
    NEW.opened_at := now();
  END IF;
  IF NEW.status = 'closed' AND OLD.status <> 'closed' AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_openings_timestamps
  BEFORE UPDATE ON job_openings
  FOR EACH ROW EXECUTE FUNCTION set_job_opening_timestamps();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE job_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_openings_admin_all" ON job_openings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')));

CREATE POLICY "job_openings_select_by_perm" ON job_openings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
            WHERE ep.module_key = 'rh-seletivo' AND ep.can_view = true)
  );

CREATE POLICY "job_openings_insert_by_perm" ON job_openings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
            WHERE ep.module_key = 'rh-seletivo' AND ep.can_create = true)
  );

CREATE POLICY "job_openings_update_by_perm" ON job_openings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
            WHERE ep.module_key = 'rh-seletivo' AND ep.can_edit = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
            WHERE ep.module_key = 'rh-seletivo' AND ep.can_edit = true)
  );

CREATE POLICY "job_openings_delete_by_perm" ON job_openings FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM get_effective_permissions(auth.uid()) ep
            WHERE ep.module_key = 'rh-seletivo' AND ep.can_delete = true)
  );

-- Leitura anônima de vagas publicadas (para página /trabalhe-conosco, PR4).
CREATE POLICY "job_openings_anon_published_read" ON job_openings FOR SELECT TO anon
  USING (status = 'published');
