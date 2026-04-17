-- Migration 151: Central de Migracao — split do modulo "segments" em 3.
--
-- PR2c do Sprint 10. A hierarquia academica (segment -> series -> class)
-- e importada em 3 passos separados, cada um com seu proprio lock. O card
-- original 'segments' passa a cobrir APENAS school_segments; dois novos
-- rows sao adicionados para series e classes.

INSERT INTO module_imports (module_key, status) VALUES
  ('school-series',  'available'),
  ('school-classes', 'available')
ON CONFLICT (module_key) DO NOTHING;
