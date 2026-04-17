import { Navigate } from 'react-router-dom';
import { usePermissions, type PermissionAction } from '../contexts/PermissionsContext';
import { Loader2, AlertTriangle } from 'lucide-react';

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
 * Route-level guard que:
 *   1. Espera a hidratação de permissões (`loading`)
 *   2. Se houve **erro de carga** (RPC falhou), mostra mensagem — não
 *      redireciona, senão vira um loop infinito para /admin.
 *   3. Caso contrário, avalia `can(key, action)` e redireciona para /admin
 *      quando o usuário não tem direito.
 *
 * Deve viver dentro de <PermissionsProvider>. Para gating inline de
 * elementos, use <PermissionGate>.
 */
export default function ModuleGuard({
  moduleKey,
  anyModuleKeys,
  requiredAction = 'view',
  children,
}: Props) {
  const { can, loading, loadError } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-1">
          Não foi possível carregar suas permissões
        </h2>
        <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
        <p className="text-xs text-red-600 dark:text-red-400 mt-3">
          Tente recarregar a página. Se o problema persistir, contate o administrador.
        </p>
      </div>
    );
  }

  if (anyModuleKeys && anyModuleKeys.length > 0) {
    // O `can()` já valida modules.is_active internamente.
    const allowed = anyModuleKeys.some((key) => can(key, requiredAction));
    if (!allowed) return <Navigate to="/admin" replace />;
    return <>{children}</>;
  }

  if (!can(moduleKey!, requiredAction)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
