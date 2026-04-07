-- Sequential enrollment number generator: YYYY-NNNN format
CREATE OR REPLACE FUNCTION generate_enrollment_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT;
  v_max  INT;
  v_next TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(split_part(enrollment_number, '-', 2) AS INT)
  ), 0)
  INTO v_max
  FROM enrollments
  WHERE enrollment_number LIKE v_year || '-%';

  v_next := v_year || '-' || lpad((v_max + 1)::TEXT, 4, '0');
  RETURN v_next;
END; $$;
