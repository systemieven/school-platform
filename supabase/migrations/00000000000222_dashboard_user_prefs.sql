-- Fase 18 — Personalização per-user do dashboard
--
-- Cada usuário guarda visibilidade + ordem dos widgets do dashboard
-- num registro próprio. Resolução em runtime (lib mergePrefs):
--   user pref > global pref (dashboard_widget_prefs) > registry default.
--
-- RLS estrito: só o dono lê/escreve a própria pref. Nem super_admin
-- bypassa — preferência é pessoal por design.

CREATE TABLE IF NOT EXISTS public.dashboard_widget_user_prefs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module              text NOT NULL CHECK (module IN ('principal','financeiro','academico')),
  registry_widget_id  text NOT NULL,
  is_visible          boolean NOT NULL DEFAULT true,
  position            integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module, registry_widget_id)
);

CREATE INDEX IF NOT EXISTS dashboard_widget_user_prefs_lookup
  ON public.dashboard_widget_user_prefs (user_id, module);

ALTER TABLE public.dashboard_widget_user_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_owns_prefs_select" ON public.dashboard_widget_user_prefs;
CREATE POLICY "user_owns_prefs_select"
  ON public.dashboard_widget_user_prefs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_owns_prefs_insert" ON public.dashboard_widget_user_prefs;
CREATE POLICY "user_owns_prefs_insert"
  ON public.dashboard_widget_user_prefs FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_owns_prefs_update" ON public.dashboard_widget_user_prefs;
CREATE POLICY "user_owns_prefs_update"
  ON public.dashboard_widget_user_prefs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_owns_prefs_delete" ON public.dashboard_widget_user_prefs;
CREATE POLICY "user_owns_prefs_delete"
  ON public.dashboard_widget_user_prefs FOR DELETE
  USING (user_id = auth.uid());

-- Reusa trigger genérico do projeto (set_updated_at).
DROP TRIGGER IF EXISTS set_updated_at ON public.dashboard_widget_user_prefs;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.dashboard_widget_user_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
