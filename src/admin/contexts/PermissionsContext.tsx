import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';

// ── Types ──

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'import';

export interface ModulePermission {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_import: boolean;
}

export interface ModuleInfo {
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  group: string;
  position: number;
  is_active: boolean;
  depends_on: string[];
}

interface PermissionsContextValue {
  permissions: ModulePermission[];
  modules: ModuleInfo[];
  loading: boolean;
  can: (moduleKey: string, action: PermissionAction) => boolean;
  canView: (moduleKey: string) => boolean;
  getModulePermission: (moduleKey: string) => ModulePermission | undefined;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAdminAuth();
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!profile) {
      setPermissions([]);
      setModules([]);
      setLoading(false);
      return;
    }

    try {
      const [permsRes, modulesRes] = await Promise.all([
        supabase.rpc('get_effective_permissions', { p_user_id: profile.id }),
        supabase.from('modules').select('*').eq('is_active', true).order('position'),
      ]);

      if (!permsRes.error) setPermissions(permsRes.data as ModulePermission[]);
      else console.error('Failed to fetch permissions:', permsRes.error);

      if (!modulesRes.error) setModules(modulesRes.data as ModuleInfo[]);
      else console.error('Failed to fetch modules:', modulesRes.error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const permMap = useMemo(() => {
    const map = new Map<string, ModulePermission>();
    for (const p of permissions) map.set(p.module_key, p);
    return map;
  }, [permissions]);

  const can = useCallback(
    (moduleKey: string, action: PermissionAction): boolean => {
      if (profile?.role === 'super_admin') return true;
      const perm = permMap.get(moduleKey);
      if (!perm) return false;
      switch (action) {
        case 'view':   return perm.can_view;
        case 'create': return perm.can_create;
        case 'edit':   return perm.can_edit;
        case 'delete': return perm.can_delete;
        case 'import': return perm.can_import;
        default:       return false;
      }
    },
    [profile, permMap],
  );

  const canView = useCallback(
    (moduleKey: string): boolean => can(moduleKey, 'view'),
    [can],
  );

  const getModulePermission = useCallback(
    (moduleKey: string): ModulePermission | undefined => {
      if (profile?.role === 'super_admin') {
        return { module_key: moduleKey, can_view: true, can_create: true, can_edit: true, can_delete: true, can_import: true };
      }
      return permMap.get(moduleKey);
    },
    [profile, permMap],
  );

  return (
    <PermissionsContext.Provider value={{ permissions, modules, loading, can, canView, getModulePermission, refresh: fetchPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within <PermissionsProvider>');
  return ctx;
}
