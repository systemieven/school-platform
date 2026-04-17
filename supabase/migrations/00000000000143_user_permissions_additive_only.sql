-- Migration 143: user_permission_overrides vira ADITIVO
--
-- Bug que motivou: Silmara (role 'teacher') só via Dashboard, mesmo com 11
-- módulos liberados ao role. Causa: o save do drawer de usuário inseria UMA
-- linha em user_permission_overrides POR módulo com o estado atual dos toggles.
-- Como a maioria dos toggles começa OFF, gravava-se can_view=false para 19 dos
-- 20 módulos. A função get_effective_permissions usava COALESCE(upo, rp), e
-- como `false` não é NULL, o override silenciosamente vencia o role grant.
--
-- Solução em camadas:
--   1. Função: troca COALESCE por (rp.x OR COALESCE(upo.x, false)).
--      User override agora só pode ADICIONAR permissão, nunca remover.
--      Linhas com tudo false viram no-ops semânticos.
--   2. Limpa o lixo deixado pelo save antigo: deleta linhas de override que
--      têm todas as flags = false (não conferem nada, só atrapalham).
--   3. Frontend (UsersPage.tsx) passa a filtrar `false` antes do INSERT,
--      evitando re-poluir a tabela.
--
-- Trade-off: perde-se a capacidade de "negar explicitamente um módulo a um
-- user específico que o role libera". Se isso for necessário no futuro,
-- adicionar coluna `is_deny boolean` em user_permission_overrides e
-- ramificar a lógica na função.

CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_user_id uuid)
RETURNS TABLE(module_key text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean, can_import boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

  IF v_role = 'super_admin' THEN
    RETURN QUERY SELECT m.key, true, true, true, true, true FROM modules m WHERE m.is_active;
    RETURN;
  END IF;

  -- Aditivo: efetivo = role permission OR user override (com false default)
  -- Inclui todos os módulos onde role OU user concede pelo menos uma flag.
  RETURN QUERY
    SELECT m.key,
      COALESCE(rp.can_view,   false) OR COALESCE(upo.can_view,   false),
      COALESCE(rp.can_create, false) OR COALESCE(upo.can_create, false),
      COALESCE(rp.can_edit,   false) OR COALESCE(upo.can_edit,   false),
      COALESCE(rp.can_delete, false) OR COALESCE(upo.can_delete, false),
      COALESCE(rp.can_import, false) OR COALESCE(upo.can_import, false)
    FROM modules m
    LEFT JOIN role_permissions rp
      ON rp.module_key = m.key AND rp.role = v_role
    LEFT JOIN user_permission_overrides upo
      ON upo.user_id = p_user_id AND upo.module_key = m.key
    WHERE m.is_active
      AND (rp.module_key IS NOT NULL OR upo.user_id IS NOT NULL);
END;
$function$;

-- Limpa os overrides "vazios" deixados pelo save antigo
DELETE FROM user_permission_overrides
WHERE COALESCE(can_view,   false) = false
  AND COALESCE(can_create, false) = false
  AND COALESCE(can_edit,   false) = false
  AND COALESCE(can_delete, false) = false
  AND COALESCE(can_import, false) = false;
