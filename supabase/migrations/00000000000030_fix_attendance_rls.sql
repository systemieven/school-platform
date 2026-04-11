-- ============================================================
-- Fix: RLS policies + SECURITY DEFINER for attendance triggers
-- ============================================================

-- 1. Make trigger functions SECURITY DEFINER so inserts into
--    attendance_history bypass RLS (triggers run in user context)
ALTER FUNCTION log_attendance_status_change() SECURITY DEFINER;
ALTER FUNCTION log_attendance_issued() SECURITY DEFINER;
ALTER FUNCTION attendance_timing() SECURITY DEFINER;

-- 2. Add INSERT policy on attendance_history for all staff roles
CREATE POLICY IF NOT EXISTS "Staff insert attendance_history" ON attendance_history
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin','admin','coordinator','teacher','user')
  ));

-- 3. Expand SELECT policy on attendance_history to include teacher/user
DROP POLICY IF EXISTS "Staff read attendance_history" ON attendance_history;
CREATE POLICY "Staff read attendance_history" ON attendance_history
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin','admin','coordinator','teacher','user')
  ));

-- 4. Expand attendance_tickets ALL policy to include teacher/user roles
DROP POLICY IF EXISTS "Staff full access on attendance_tickets" ON attendance_tickets;
CREATE POLICY "Staff full access on attendance_tickets" ON attendance_tickets
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('super_admin','admin','coordinator','teacher','user')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('super_admin','admin','coordinator','teacher','user')
  ));
