import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import type { Role } from '../types/admin.types';
import type { PermissionAction } from '../contexts/PermissionsContext';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Legacy: array of roles allowed (fallback when moduleKey is not set) */
  roles?: Role[];
  /** Granular: module key to check permission against */
  moduleKey?: string;
  /** Action required (defaults to 'view') */
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

  // Role-based check (legacy fallback — granular checks happen in Sidebar
  // and PermissionGate within pages, powered by PermissionsContext)
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
