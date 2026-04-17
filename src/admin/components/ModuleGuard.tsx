import { Navigate } from 'react-router-dom';
import { usePermissions, type PermissionAction } from '../contexts/PermissionsContext';
import { Loader2 } from 'lucide-react';

interface BaseProps {
  requiredAction?: PermissionAction;
  children: React.ReactNode;
}

interface SingleModuleProps extends BaseProps {
  moduleKey: string;
  anyModuleKeys?: never;
}

interface AnyModuleProps extends BaseProps {
  /**
   * Union variant for umbrella routes: passes when the user satisfies
   * `requiredAction` on **at least one** of these keys, AND the matched module
   * is active (or absent from the modules list, which means it isn't gated by
   * the Módulos tab).
   */
  anyModuleKeys: readonly string[];
  moduleKey?: never;
}

type Props = SingleModuleProps | AnyModuleProps;

/**
 * Route-level guard that checks:
 * 1. Whether the module is active (not disabled in Módulos tab)
 * 2. Whether the current user has permission for the required action
 *
 * Two modes:
 * - **Single (`moduleKey`)** — classic per-module gate.
 * - **Union (`anyModuleKeys`)** — for umbrella routes (e.g. /admin/configuracoes,
 *   /admin/academico) whose page body filters its own sub-tabs by permission.
 *   Visible iff at least one sub-tab is accessible to the user. Keep the list
 *   in sync with `src/admin/lib/umbrella-modules.ts`.
 *
 * Must be used inside PermissionsProvider (i.e., inside AdminLayout).
 * For inline element-level gating, use PermissionGate instead.
 */
export default function ModuleGuard({
  moduleKey,
  anyModuleKeys,
  requiredAction = 'view',
  children,
}: Props) {
  const { can, modules, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (anyModuleKeys && anyModuleKeys.length > 0) {
    const allowed = anyModuleKeys.some((key) => {
      const mod = modules.find((m) => m.key === key);
      if (mod && !mod.is_active) return false;
      return can(key, requiredAction);
    });
    if (!allowed) return <Navigate to="/admin" replace />;
    return <>{children}</>;
  }

  // Single-module mode
  const mod = modules.find((m) => m.key === moduleKey);
  if (mod && !mod.is_active) {
    return <Navigate to="/admin" replace />;
  }

  if (!can(moduleKey!, requiredAction)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
