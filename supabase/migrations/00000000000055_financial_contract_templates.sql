-- Migration 55: Templates de documentos financeiros (contrato, recibo, boleto)

CREATE TABLE IF NOT EXISTS contract_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  -- Tipo: contract, receipt, boleto, enrollment_form, termination
  template_type  TEXT NOT NULL CHECK (template_type IN ('contract', 'receipt', 'boleto', 'enrollment_form', 'termination')),
  -- Conteudo HTML com placeholders {{variavel}}
  content        TEXT NOT NULL,
  -- Variaveis disponiveis (documentacao para o usuario)
  variables      JSONB NOT NULL DEFAULT '[]',
  -- Estilo/config de layout (margens, fontes, logo_url, etc.)
  style_config   JSONB NOT NULL DEFAULT '{}',
  -- Escopo
  segment_ids    UUID[] NOT NULL DEFAULT '{}',
  plan_ids       UUID[] NOT NULL DEFAULT '{}',
  -- Apenas 1 template default por tipo
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  school_year    INTEGER,
  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_templates_default_per_type
  ON contract_templates (template_type) WHERE is_default = TRUE AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON contract_templates(template_type) WHERE is_active = TRUE;

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access contract_templates"
  ON contract_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Coordinator view contract_templates"
  ON contract_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'coordinator'
    )
  );

-- Modulo e permissoes
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on) VALUES
  ('financial-templates', 'Templates de Documentos', 'Templates de contrato, recibo e boleto com placeholders', 'FileText', 'financeiro', 28, TRUE, ARRAY['financial'])
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import) VALUES
  ('admin',       'financial-templates', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'financial-templates', TRUE, FALSE, FALSE, FALSE, FALSE),
  ('teacher',     'financial-templates', FALSE, FALSE, FALSE, FALSE, FALSE),
  ('user',        'financial-templates', FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- Seeds: templates padrao (contrato, recibo, boleto)
-- Nota: os seeds sao aplicados via dashboard/MCP. Esta migration apenas cria o schema.
