-- Migration 43: Renomear attendance → student_attendance
-- Motivo: Disambiguar da tabela attendance_tickets (fila presencial)
-- A tabela "attendance" registra frequencia escolar diaria dos alunos.

-- Renomear tabela
ALTER TABLE IF EXISTS attendance RENAME TO student_attendance;

-- Renomear constraints (se existirem)
ALTER INDEX IF EXISTS attendance_pkey RENAME TO student_attendance_pkey;

-- Renomear unique constraint
ALTER INDEX IF EXISTS attendance_student_id_class_id_date_key
  RENAME TO student_attendance_student_id_class_id_date_key;

-- Atualizar RLS policies (recriar com nomes corretos)
DO $$
BEGIN
  -- Drop old policies se existirem
  DROP POLICY IF EXISTS "Admin full access attendance" ON student_attendance;
  DROP POLICY IF EXISTS "Teacher manage own class attendance" ON student_attendance;
  DROP POLICY IF EXISTS "Coordinator view segment attendance" ON student_attendance;

  -- Recriar policies com nomes corretos
  CREATE POLICY "Admin full access student_attendance"
    ON student_attendance FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
      )
    );

  CREATE POLICY "Teacher manage own class student_attendance"
    ON student_attendance FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('teacher', 'coordinator')
      )
    );
END
$$;

-- Habilitar Realtime (se necessario)
ALTER PUBLICATION supabase_realtime ADD TABLE student_attendance;
