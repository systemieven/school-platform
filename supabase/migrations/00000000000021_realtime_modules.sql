-- Ativa Supabase Realtime para os módulos principais do admin.
-- visit_appointments já estava na publication (veio da migration
-- original de confirmation tracking / testimonials). Aqui adicionamos
-- enrollments e contact_requests para que a UI do painel receba
-- INSERT/UPDATE/DELETE em tempo real.
--
-- REPLICA IDENTITY permanece como DEFAULT (usa a primary key para
-- identificar linhas em eventos de UPDATE/DELETE). FULL só é necessário
-- se precisarmos inspecionar valores antigos — hoje a UI só precisa
-- saber o id e o payload novo.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'enrollments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contact_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_requests;
  END IF;
END $$;
