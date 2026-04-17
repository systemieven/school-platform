import { usePermissions, type PermissionAction } from '../contexts/PermissionsContext';

/**
 * Inline permission gate for use inside pages (within PermissionsProvider).
 *
 * Usage:
 *   <PermissionGate moduleKey="enrollments" action="delete">
 *     <DeleteButton />
 *   </PermissionGate>
 *
 * Estados:
 *   - loading: renderiza `loadingFallback` (default: null — não expõe o filho).
 *   - loadError: renderiza `fallback` por segurança. O ModuleGuard da rota
 *     é que mostra a mensagem de erro; o gate inline apenas oculta.
 *   - sem permissão: renderiza `fallback` (default: null).
 *   - permitido: renderiza `children`.
 *
 * IMPORTANTE: `loadingFallback` existe para dar ao chamador a opção de
 * mostrar um skeleton em lugar do botão enquanto a RPC resolve. O default
 * `null` mantém comportamento-zero-flash.
 */
export default function PermissionGate({
  moduleKey,
  action = 'view',
  children,
  fallback = null,
  loadingFallback = null,
}: {
  moduleKey: string;
  action?: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}) {
  const { can, loading, loadError } = usePermissions();

  if (loading) return <>{loadingFallback}</>;
  // Em erro de carga, trata como negado (seguro por default): a página
  // hospedeira pode ter sua própria mensagem; o gate apenas não vaza o botão.
  if (loadError) return <>{fallback}</>;
  if (!can(moduleKey, action)) return <>{fallback}</>;
  return <>{children}</>;
}
