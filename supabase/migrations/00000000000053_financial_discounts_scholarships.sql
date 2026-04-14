-- Migration 53: Descontos e Bolsas financeiras com escopo 3 niveis (global/grupo/aluno)
-- Cria: financial_discounts, financial_scholarships
-- Modulos: financial-discounts, financial-scholarships

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. financial_discounts — Descontos comerciais com escopo em 3 niveis
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_discounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  -- Escopo: global aplica a todos, group filtra por plan/segment/class, student filtra por aluno especifico
  scope           TEXT NOT NULL CHECK (scope IN ('global', 'group', 'student')),
  -- Filtros do escopo (usados conforme o scope)
  plan_id         UUID REFERENCES financial_plans(id) ON DELETE CASCADE,
  segment_id      UUID REFERENCES school_segments(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES school_classes(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
  -- Valor do desconto
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
  -- Validade (NULL = permanente)
  valid_from      DATE,
  valid_until     DATE,
  -- Motivo/categoria: comercial, pontualidade, irmao, funcionario, convenio, etc.
  reason          TEXT,
  -- Prioridade para resolver conflitos quando multiplos descontos se aplicam
  priority        INTEGER NOT NULL DEFAULT 0,
  -- Se TRUE, este desconto e cumulativo com outros. Se FALSE, e exclusivo.
  is_cumulative   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Ano letivo aplicavel (NULL = qualquer ano)
  school_year     INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'global') OR
    (scope = 'student' AND student_id IS NOT NULL) OR
    (scope = 'group' AND (plan_id IS NOT NULL OR segment_id IS NOT NULL OR class_id IS NOT NULL))
  ),
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until)
);

CREATE INDEX IF NOT EXISTS idx_financial_discounts_scope ON financial_discounts(scope) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_financial_discounts_student ON financial_discounts(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_discounts_plan ON financial_discounts(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_discounts_segment ON financial_discounts(segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_discounts_class ON financial_discounts(class_id) WHERE class_id IS NOT NULL;

ALTER TABLE financial_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_discounts"
  ON financial_discounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view financial_discounts"
  ON financial_discounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. financial_scholarships — Bolsas por aluno com validade obrigatoria
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_scholarships (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  -- Tipo: percentage, fixed, full (100%)
  scholarship_type   TEXT NOT NULL CHECK (scholarship_type IN ('percentage', 'fixed', 'full')),
  scholarship_value  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (scholarship_value >= 0),
  -- Validade obrigatoria (bolsas sempre tem periodo definido)
  valid_from         DATE NOT NULL,
  valid_until        DATE NOT NULL,
  -- Categoria: merito, social, filantropia, convenio, irmao, funcionario, etc.
  category           TEXT NOT NULL DEFAULT 'social',
  -- Documentacao/justificativa
  justification      TEXT,
  document_url       TEXT,
  -- Aprovacao
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  approved_by        UUID REFERENCES profiles(id),
  approved_at        TIMESTAMPTZ,
  rejection_reason   TEXT,
  school_year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  -- Renovacao
  is_renewable       BOOLEAN NOT NULL DEFAULT FALSE,
  renewed_from       UUID REFERENCES financial_scholarships(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_from <= valid_until)
);

CREATE INDEX IF NOT EXISTS idx_financial_scholarships_student ON financial_scholarships(student_id);
CREATE INDEX IF NOT EXISTS idx_financial_scholarships_status ON financial_scholarships(status);
CREATE INDEX IF NOT EXISTS idx_financial_scholarships_year ON financial_scholarships(school_year);
CREATE INDEX IF NOT EXISTS idx_financial_scholarships_active
  ON financial_scholarships(student_id, valid_from, valid_until)
  WHERE status = 'approved';

ALTER TABLE financial_scholarships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access financial_scholarships"
  ON financial_scholarships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view financial_scholarships"
  ON financial_scholarships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

CREATE POLICY "Student view own scholarships"
  ON financial_scholarships FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s WHERE s.auth_user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Modulos e permissoes
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on) VALUES
  ('financial-discounts',    'Descontos',    'Descontos comerciais com escopo global/grupo/aluno', 'Percent',      'financeiro', 26, TRUE, ARRAY['financial']),
  ('financial-scholarships', 'Bolsas',       'Bolsas de estudo com validade e aprovacao',          'GraduationCap','financeiro', 27, TRUE, ARRAY['financial'])
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import) VALUES
  ('admin',       'financial-discounts',    TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'financial-scholarships', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'financial-discounts',    TRUE, FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'financial-scholarships', TRUE, FALSE, FALSE, FALSE, FALSE),
  ('teacher',     'financial-discounts',    FALSE, FALSE, FALSE, FALSE, FALSE),
  ('teacher',     'financial-scholarships', FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user',        'financial-discounts',    FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user',        'financial-scholarships', FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;
