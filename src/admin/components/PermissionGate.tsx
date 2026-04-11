import { usePermissions, type PermissionAction } from '../contexts/PermissionsContext';

/**
 * Inline permission gate for use inside pages (within PermissionsProvider).
 *
 * Usage:
 *   <PermissionGate moduleKey="enrollments" action="delete">
 *     <DeleteButton />
 *   </PermissionGate>
 */
export default function PermissionGate({
  moduleKey,
  action = 'view',
  children,
  fallback = null,
}: {
  moduleKey: string;
  action?: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(moduleKey, action)) return <>{fallback}</>;
  return <>{children}</>;
}
