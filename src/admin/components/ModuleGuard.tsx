import { Navigate } from 'react-router-dom';
import { usePermissions, type PermissionAction } from '../contexts/PermissionsContext';
import { Loader2 } from 'lucide-react';

interface Props {
  moduleKey: string;
  requiredAction?: PermissionAction;
  children: React.ReactNode;
}

/**
 * Route-level guard that checks:
 * 1. Whether the module is active (not disabled in Módulos tab)
 * 2. Whether the current user has permission for the required action
 *
 * Must be used inside PermissionsProvider (i.e., inside AdminLayout).
 * For inline element-level gating, use PermissionGate instead.
 */
export default function ModuleGuard({ moduleKey, requiredAction = 'view', children }: Props) {
  const { can, modules, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Check if the module exists and is active
  const mod = modules.find((m) => m.key === moduleKey);
  if (mod && !mod.is_active) {
    return <Navigate to="/admin" replace />;
  }

  // Check granular permission
  if (!can(moduleKey, requiredAction)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
