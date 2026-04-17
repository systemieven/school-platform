import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import type { PermissionAction } from '../contexts/PermissionsContext';
import type { Role } from '../types/admin.types';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Legacy: array of roles allowed (fallback when moduleKey is not set) */
  roles?: Role[];
  /**
   * Reserved for future use. **Today this prop is intentionally ignored.**
   *
   * `<ProtectedRoute>` wraps `<AdminLayout>`, and `<PermissionsProvider>`
   * lives *inside* AdminLayout — so calling `usePermissions()` here would
   * throw ("must be used within <PermissionsProvider>") and lock the whole
   * app at the loading screen. Granular permission checks must happen
   * lower in the tree via `<ModuleGuard moduleKey requiredAction>`, which
   * is mounted around each route element.
   */
  moduleKey?: string;
  /** Reserved for future use — see `moduleKey` above. */
  requiredAction?: PermissionAction;
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { profile, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/admin/login" replace />;
  }

  // First-access: force password change before anything else
  if (profile.must_change_password && location.pathname !== '/admin/alterar-senha') {
    return <Navigate to="/admin/alterar-senha" replace />;
  }

  // super_admin bypasses all permission checks
  if (profile.role === 'super_admin') {
    return <>{children}</>;
  }

  // Role-based check (legacy fallback — granular checks happen in
  // ModuleGuard / PermissionGate within pages, powered by PermissionsContext
  // which is provided *inside* AdminLayout — i.e. below this guard).
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
