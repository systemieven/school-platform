-- Migration 150: Central de Migracao de Dados (OP-1) — Sprint 10
--
-- Objetivo: Introduzir a Central de Migracao como um modulo super_admin-only,
-- centralizando a importacao de dados do sistema anterior. Cada modulo e
-- importado uma unica vez e "travado" apos o sucesso para prevenir
-- reimportacao acidental que geraria duplicidade.
--
-- Esta migration cria apenas a infraestrutura:
--   1. modulo `data-migration` (visivel no sidebar de super_admin)
--   2. tabela `module_imports` (estado de lock + auditoria por modulo)
--
-- O refator de StudentImportPage em ModuleImportWizard generico e os
-- importadores dos demais modulos virao em PRs seguintes do Sprint 10.

-- ============================================================
-- 1. Modulo data-migration
-- ============================================================

INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES (
  'data-migration',
  'Central de Migração',
  'Importação unificada de dados do sistema anterior (super_admin only)',
  'DatabaseBackup',
  'sistema',
  16,
  TRUE,
  '{}'
)
ON CONFLICT (key) DO NOTHING;

-- Observacao: nao seedamos role_permissions para este modulo.
-- super_admin tem bypass em `can()` (retorna true para qualquer modulo ativo).
-- Os demais roles ficam sem linha -> canView retorna false -> sidebar oculta.
-- A rota adicional protege via <ModuleGuard moduleKey="data-migration">.

-- ============================================================
-- 2. Tabela module_imports — lock + auditoria por modulo
-- ============================================================

CREATE TABLE IF NOT EXISTS module_imports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key        TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'completed')),
  records_imported  INT  NOT NULL DEFAULT 0,
  completed_at      TIMESTAMPTZ,
  completed_by      UUID REFERENCES profiles(id),
  unlocked_at       TIMESTAMPTZ,
  unlocked_by       UUID REFERENCES profiles(id),
  unlock_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_imports_status ON module_imports(status);

-- Touch updated_at automaticamente
CREATE OR REPLACE FUNCTION touch_module_imports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_module_imports ON module_imports;
CREATE TRIGGER trg_touch_module_imports
  BEFORE UPDATE ON module_imports
  FOR EACH ROW EXECUTE FUNCTION touch_module_imports_updated_at();

-- ============================================================
-- 3. RLS — super_admin only
-- ============================================================

ALTER TABLE module_imports ENABLE ROW LEVEL SECURITY;

-- Uma unica policy cobre todas as operacoes: apenas super_admin.
DROP POLICY IF EXISTS module_imports_super_admin ON module_imports;
CREATE POLICY module_imports_super_admin ON module_imports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================
-- 4. Seed inicial: um registro por modulo importavel
-- ============================================================
--
-- Cada row representa o estado de lock de um modulo. Inicialmente todos
-- em 'available'. A UI da MigracaoPage le desta tabela para renderizar
-- cards Disponivel/Concluido.

INSERT INTO module_imports (module_key, status) VALUES
  ('students',      'available'),
  ('segments',      'available'),
  ('contacts',      'available'),
  ('fornecedores',  'available'),
  ('store-products','available'),
  ('users',         'available'),
  ('financial-receivables', 'available'),
  ('financial-payables',    'available'),
  ('appointments', 'available'),
  ('financial-cash','available')
ON CONFLICT (module_key) DO NOTHING;
