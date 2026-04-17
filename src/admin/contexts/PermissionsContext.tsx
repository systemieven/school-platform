import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
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
  /**
   * Null quando o fetch foi bem-sucedido. String quando a RPC falhou — o guard
   * usa isso para distinguir "sem permissão" (silencioso) de "erro de carga"
   * (mostra mensagem ao invés de redirecionar em loop para /admin).
   */
  loadError: string | null;
  can: (moduleKey: string, action: PermissionAction) => boolean;
  canView: (moduleKey: string) => boolean;
  /** Retorna true se o módulo está listado em `modules` e ativo. */
  isModuleActive: (moduleKey: string) => boolean;
  getModulePermission: (moduleKey: string) => ModulePermission | undefined;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAdminAuth();
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Debounce para realtime: várias linhas podem mudar juntas (save em lote).
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!profile) {
      setPermissions([]);
      setModules([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    try {
      const [permsRes, modulesRes] = await Promise.all([
        supabase.rpc('get_effective_permissions', { p_user_id: profile.id }),
        supabase.from('modules').select('*').order('position'),
      ]);

      if (permsRes.error) {
        console.error('Failed to fetch permissions:', permsRes.error);
        setLoadError(permsRes.error.message || 'Falha ao carregar permissões');
        setPermissions([]);
      } else {
        setPermissions((permsRes.data as ModulePermission[]) ?? []);
        setLoadError(null);
      }

      if (modulesRes.error) {
        console.error('Failed to fetch modules:', modulesRes.error);
        // Erro de modules é menos crítico: não derruba a árvore inteira
        setModules([]);
      } else {
        setModules((modulesRes.data as ModuleInfo[]) ?? []);
      }
    } catch (err) {
      console.error('Unexpected error loading permissions:', err);
      setLoadError((err as Error).message || 'Falha inesperada');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Realtime: se role_permissions, user_permission_overrides OU modules
  // mudarem, re-sincroniza a sessão ativa. Evita o caso em que o super_admin
  // revoga um módulo enquanto o usuário está logado — sem isso, a aba atual
  // continuava mostrando dados sensíveis até F5.
  useEffect(() => {
    if (!profile) return;
    const scheduleRefresh = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => {
        fetchPermissions();
      }, 250);
    };
    const channel = supabase
      .channel(`perms:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_permission_overrides', filter: `user_id=eq.${profile.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modules' }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [profile, fetchPermissions]);

  const permMap = useMemo(() => {
    const map = new Map<string, ModulePermission>();
    for (const p of permissions) map.set(p.module_key, p);
    return map;
  }, [permissions]);

  const moduleMap = useMemo(() => {
    const map = new Map<string, ModuleInfo>();
    for (const m of modules) map.set(m.key, m);
    return map;
  }, [modules]);

  const isModuleActive = useCallback(
    (moduleKey: string): boolean => {
      const mod = moduleMap.get(moduleKey);
      // Quando o módulo não está no cadastro (ainda), preferimos não bloquear:
      // isso ocorre durante hidrate ou em chaves que não passam pelo toggle
      // de Módulos. O ModuleGuard da rota é quem toma a decisão final.
      if (!mod) return true;
      return mod.is_active;
    },
    [moduleMap],
  );

  const can = useCallback(
    (moduleKey: string, action: PermissionAction): boolean => {
      if (profile?.role === 'super_admin') {
        // Mesmo super_admin respeita modules.is_active — quando o próprio admin
        // desativa o módulo via /admin/configuracoes → Módulos, todos perdem.
        return isModuleActive(moduleKey);
      }
      if (!isModuleActive(moduleKey)) return false;
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
    [profile, permMap, isModuleActive],
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
    <PermissionsContext.Provider value={{ permissions, modules, loading, loadError, can, canView, isModuleActive, getModulePermission, refresh: fetchPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within <PermissionsProvider>');
  return ctx;
}
