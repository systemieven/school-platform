-- pre_screening_sessions tem RLS ativo mas nenhuma policy — toda leitura
-- via JWT (admin) era bloqueada, escondendo as mensagens da aba Chat do
-- CandidatoDrawer. Edge functions usam service-role e continuam passando.
--
-- Padrão de permissões: mesmo do job_applications — super_admin/admin via
-- role direto em `profiles`, ou operadores via `rh-seletivo` em
-- `get_effective_permissions`.

CREATE POLICY pre_screening_sessions_admin_all
  ON public.pre_screening_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['super_admin'::text, 'admin'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['super_admin'::text, 'admin'::text])
    )
  );

CREATE POLICY pre_screening_sessions_select_by_perm
  ON public.pre_screening_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_effective_permissions(auth.uid()) ep
      WHERE ep.module_key = 'rh-seletivo'
        AND ep.can_view = true
    )
  );
