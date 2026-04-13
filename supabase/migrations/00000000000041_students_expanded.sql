-- Expand students table with detailed fields (retro-compatible, all nullable)
ALTER TABLE students
  -- Guardian address
  ADD COLUMN IF NOT EXISTS guardian_cpf TEXT,
  ADD COLUMN IF NOT EXISTS guardian_zip_code TEXT,
  ADD COLUMN IF NOT EXISTS guardian_street TEXT,
  ADD COLUMN IF NOT EXISTS guardian_number TEXT,
  ADD COLUMN IF NOT EXISTS guardian_complement TEXT,
  ADD COLUMN IF NOT EXISTS guardian_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS guardian_city TEXT,
  ADD COLUMN IF NOT EXISTS guardian_state TEXT,
  -- Student address
  ADD COLUMN IF NOT EXISTS student_zip_code TEXT,
  ADD COLUMN IF NOT EXISTS student_street TEXT,
  ADD COLUMN IF NOT EXISTS student_number TEXT,
  ADD COLUMN IF NOT EXISTS student_complement TEXT,
  ADD COLUMN IF NOT EXISTS student_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS student_city TEXT,
  ADD COLUMN IF NOT EXISTS student_state TEXT,
  -- School history
  ADD COLUMN IF NOT EXISTS first_school BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_grade TEXT,
  ADD COLUMN IF NOT EXISTS previous_school_name TEXT,
  ADD COLUMN IF NOT EXISTS segment TEXT,
  -- Parents
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS father_cpf TEXT,
  ADD COLUMN IF NOT EXISTS father_phone TEXT,
  ADD COLUMN IF NOT EXISTS father_email TEXT,
  ADD COLUMN IF NOT EXISTS mother_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_cpf TEXT,
  ADD COLUMN IF NOT EXISTS mother_phone TEXT,
  ADD COLUMN IF NOT EXISTS mother_email TEXT,
  -- Extra
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS document_urls TEXT[] DEFAULT '{}'::text[];

-- Storage bucket for student documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users can upload student docs" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'student-documents');
CREATE POLICY "Auth users can read student docs" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'student-documents');
CREATE POLICY "Admin can delete student docs" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'student-documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- Updated enrollment number generator (checks both enrollments and students)
CREATE OR REPLACE FUNCTION generate_enrollment_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT; v_max_e INT; v_max_s INT; v_next TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(split_part(enrollment_number,'-',2) AS INT)),0)
    INTO v_max_e FROM enrollments WHERE enrollment_number LIKE v_year||'-%';
  SELECT COALESCE(MAX(CAST(split_part(enrollment_number,'-',2) AS INT)),0)
    INTO v_max_s FROM students WHERE enrollment_number LIKE v_year||'-%';
  v_next := v_year||'-'||lpad((GREATEST(v_max_e,v_max_s)+1)::TEXT,4,'0');
  RETURN v_next;
END; $$;

-- Batch enrollment number generator for imports
CREATE OR REPLACE FUNCTION generate_enrollment_numbers(p_count INT)
RETURNS TEXT[] LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT; v_max_e INT; v_max_s INT; v_base INT; v_result TEXT[];
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(split_part(enrollment_number,'-',2) AS INT)),0)
    INTO v_max_e FROM enrollments WHERE enrollment_number LIKE v_year||'-%';
  SELECT COALESCE(MAX(CAST(split_part(enrollment_number,'-',2) AS INT)),0)
    INTO v_max_s FROM students WHERE enrollment_number LIKE v_year||'-%';
  v_base := GREATEST(v_max_e, v_max_s);
  FOR i IN 1..p_count LOOP
    v_result := array_append(v_result, v_year||'-'||lpad((v_base+i)::TEXT,4,'0'));
  END LOOP;
  RETURN v_result;
END; $$;
