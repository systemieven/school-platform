import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions, type ModuleInfo } from '../../contexts/PermissionsContext';
import { ROLE_LABELS } from '../../types/admin.types';
import type { Role, Profile } from '../../types/admin.types';
import {
  Shield, Loader2, Save, Check, X, Users, Info, ToggleLeft, ToggleRight, Puzzle,
  Search, ChevronDown, Eye,
} from 'lucide-react';

// ── Constants ──

const MANAGEABLE_ROLES: Role[] = ['admin', 'coordinator', 'teacher', 'user'];

const ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_import'] as const;
type ActionKey = typeof ACTIONS[number];

const ACTION_LABELS: Record<ActionKey, string> = {
  can_view: 'Visualizar',
  can_create: 'Criar',
  can_edit: 'Editar',
  can_delete: 'Excluir',
  can_import: 'Importar',
};

const ROLE_COLORS: Record<string, string> = {
  admin:       'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  coordinator: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  teacher:     'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  user:        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

// ── Types ──

interface RolePermsRow {
  id?: string;
  role: string;
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_import: boolean;
}

interface UserOverrideRow {
  id?: string;
  user_id: string;
  module_key: string;
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
  can_import: boolean | null;
}

// ── Searchable User Select ──

function UserSearchSelect({ users, selectedUserId, onSelect }: {
  users: Profile[];
  selectedUserId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = users.find(u => u.id === selectedUserId);

  const filtered = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q);
  });

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-3">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">Usuário:</span>
      <div className="relative min-w-[280px]">
        <button
          type="button"
          onClick={() => { setOpen(!open); setSearch(''); }}
          className="w-full flex items-center justify-between gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm transition-colors hover:border-gray-300 dark:hover:border-gray-500 focus:border-brand-primary outline-none"
        >
          <span className={selected ? 'text-gray-800 dark:text-gray-200 truncate' : 'text-gray-400'}>
            {selected ? `${selected.full_name || 'Sem nome'} — ${ROLE_LABELS[selected.role]}` : 'Selecione um usuário...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none focus:border-brand-primary dark:focus:border-brand-secondary"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="max-h-60 overflow-y-auto">
              {/* Clear option */}
              <button
                type="button"
                onClick={() => { onSelect(null); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Nenhum selecionado
              </button>

              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  Nenhum usuário encontrado
                </div>
              ) : (
                filtered.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { onSelect(u.id); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                      u.id === selectedUserId
                        ? 'bg-brand-primary/5 dark:bg-brand-secondary/5 text-brand-primary dark:text-brand-secondary'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="w-7 h-7 bg-brand-primary/10 dark:bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-brand-primary dark:text-brand-secondary">
                        {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.full_name || 'Sem nome'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{ROLE_LABELS[u.role]}</p>
                    </div>
                    {u.id === selectedUserId && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──

export default function PermissionsPage({ embedded = false }: { embedded?: boolean }) {
  const { profile: currentUser } = useAdminAuth();
  const { modules, refresh: refreshPerms } = usePermissions();

  const [activeTab, setActiveTab] = useState<'roles' | 'overrides' | 'modules'>('roles');
  const [selectedRole, setSelectedRole] = useState<Role>('admin');
  const [rolePerms, setRolePerms] = useState<RolePermsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Overrides tab state
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userOverrides, setUserOverrides] = useState<UserOverrideRow[]>([]);
  const [overridesDirty, setOverridesDirty] = useState(false);

  // Effective permissions preview state
  const [showEffective, setShowEffective] = useState(false);
  const [effectivePerms, setEffectivePerms] = useState<{ module_key: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; can_import: boolean }[]>([]);
  const [effectiveLoading, setEffectiveLoading] = useState(false);
  const [selectedUserRolePerms, setSelectedUserRolePerms] = useState<RolePermsRow[]>([]);

  // Modules tab state (all modules, including inactive)
  const [allModules, setAllModules] = useState<(ModuleInfo & { is_active: boolean })[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesDirty, setModulesDirty] = useState(false);

  // ── Fetch role permissions ──

  const fetchRolePerms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role', selectedRole);

    if (!error && data) setRolePerms(data as RolePermsRow[]);
    setLoading(false);
    setDirty(false);
  }, [selectedRole]);

  useEffect(() => { fetchRolePerms(); }, [fetchRolePerms]);

  // ── Fetch users for overrides tab ──

  useEffect(() => {
    if (activeTab !== 'overrides') return;
    supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .neq('role', 'super_admin')
      .order('full_name')
      .then(({ data }) => {
        if (data) setUsers(data as Profile[]);
      });
  }, [activeTab]);

  // ── Fetch user overrides ──

  const fetchUserOverrides = useCallback(async () => {
    if (!selectedUserId) {
      setUserOverrides([]);
      setShowEffective(false);
      setEffectivePerms([]);
      return;
    }
    const { data } = await supabase
      .from('user_permission_overrides')
      .select('*')
      .eq('user_id', selectedUserId);
    if (data) setUserOverrides(data as UserOverrideRow[]);
    setOverridesDirty(false);
  }, [selectedUserId]);

  useEffect(() => { fetchUserOverrides(); }, [fetchUserOverrides]);

  // ── Fetch effective permissions for selected user ──

  const fetchEffectivePerms = useCallback(async () => {
    if (!selectedUserId || !showEffective) return;
    setEffectiveLoading(true);

    const selectedUser = users.find((u) => u.id === selectedUserId);
    const [effRes, roleRes] = await Promise.all([
      supabase.rpc('get_effective_permissions', { p_user_id: selectedUserId }),
      selectedUser
        ? supabase.from('role_permissions').select('*').eq('role', selectedUser.role)
        : Promise.resolve({ data: [] as RolePermsRow[], error: null }),
    ]);

    if (!effRes.error && effRes.data) setEffectivePerms(effRes.data);
    if (!roleRes.error && roleRes.data) setSelectedUserRolePerms(roleRes.data as RolePermsRow[]);
    setEffectiveLoading(false);
  }, [selectedUserId, showEffective, users]);

  useEffect(() => { fetchEffectivePerms(); }, [fetchEffectivePerms]);

  // ── Fetch all modules (including inactive) ──

  const fetchAllModules = useCallback(async () => {
    setModulesLoading(true);
    const { data } = await supabase
      .from('modules')
      .select('*')
      .order('position');
    if (data) setAllModules(data as (ModuleInfo & { is_active: boolean })[]);
    setModulesLoading(false);
    setModulesDirty(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'modules') fetchAllModules();
  }, [activeTab, fetchAllModules]);

  // ── Toggle module active state ──

  function toggleModuleActive(key: string) {
    setAllModules((prev) => {
      const mod = prev.find((m) => m.key === key);
      if (!mod) return prev;

      // Check if any active module depends on this one
      if (mod.is_active) {
        const dependents = prev.filter((m) => m.is_active && m.depends_on.includes(key));
        if (dependents.length > 0) {
          alert(`Não é possível desativar "${mod.label}" porque ${dependents.map((d) => `"${d.label}"`).join(', ')} depende(m) dele.`);
          return prev;
        }
      } else {
        // If activating, check if all dependencies are active
        const missingDeps = mod.depends_on.filter((dep) => {
          const depMod = prev.find((m) => m.key === dep);
          return depMod && !depMod.is_active;
        });
        if (missingDeps.length > 0) {
          const depLabels = missingDeps.map((dep) => prev.find((m) => m.key === dep)?.label || dep);
          alert(`Para ativar "${mod.label}", ative primeiro: ${depLabels.join(', ')}`);
          return prev;
        }
      }

      return prev.map((m) => m.key === key ? { ...m, is_active: !m.is_active } : m);
    });
    setModulesDirty(true);
  }

  // ── Save module states ──

  async function saveModuleStates() {
    setSaving(true);
    for (const mod of allModules) {
      await supabase
        .from('modules')
        .update({ is_active: mod.is_active })
        .eq('key', mod.key);
    }
    logAudit({ action: 'update', module: 'permissions', description: 'Estados dos módulos atualizados' });
    setSaving(false);
    setModulesDirty(false);
    refreshPerms();
  }

  // ── Toggle role permission ──

  function toggleRolePerm(moduleKey: string, action: ActionKey) {
    setRolePerms((prev) =>
      prev.map((p) =>
        p.module_key === moduleKey ? { ...p, [action]: !p[action] } : p,
      ),
    );
    setDirty(true);
    setSaved(false);
  }

  // ── Save role permissions ──

  async function saveRolePerms() {
    setSaving(true);
    for (const p of rolePerms) {
      await supabase
        .from('role_permissions')
        .upsert(
          {
            role: p.role,
            module_key: p.module_key,
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
            can_import: p.can_import,
          },
          { onConflict: 'role,module_key' },
        );
    }
    logAudit({ action: 'update', module: 'permissions', description: `Permissões do role "${rolePerms[0]?.role}" atualizadas` });
    setSaving(false);
    setDirty(false);
    setSaved(true);
    refreshPerms();
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Toggle user override ──

  function toggleUserOverride(moduleKey: string, action: ActionKey) {
    setUserOverrides((prev) => {
      const existing = prev.find((o) => o.module_key === moduleKey);
      if (existing) {
        const current = existing[action];
        // Cycle: null → true → false → null
        const next = current === null ? true : current === true ? false : null;
        return prev.map((o) =>
          o.module_key === moduleKey ? { ...o, [action]: next } : o,
        );
      }
      // Create new override
      return [
        ...prev,
        {
          user_id: selectedUserId!,
          module_key: moduleKey,
          can_view: action === 'can_view' ? true : null,
          can_create: action === 'can_create' ? true : null,
          can_edit: action === 'can_edit' ? true : null,
          can_delete: action === 'can_delete' ? true : null,
          can_import: action === 'can_import' ? true : null,
        },
      ];
    });
    setOverridesDirty(true);
  }

  // ── Save user overrides ──

  async function saveUserOverrides() {
    if (!selectedUserId) return;
    setSaving(true);

    // Delete existing overrides for this user
    await supabase
      .from('user_permission_overrides')
      .delete()
      .eq('user_id', selectedUserId);

    // Insert non-null overrides
    const toInsert = userOverrides.filter(
      (o) => o.can_view !== null || o.can_create !== null || o.can_edit !== null || o.can_delete !== null || o.can_import !== null,
    );

    if (toInsert.length > 0) {
      await supabase
        .from('user_permission_overrides')
        .insert(
          toInsert.map((o) => ({
            user_id: selectedUserId,
            module_key: o.module_key,
            can_view: o.can_view,
            can_create: o.can_create,
            can_edit: o.can_edit,
            can_delete: o.can_delete,
            can_import: o.can_import,
            granted_by: currentUser?.id,
          })),
        );
    }

    logAudit({ action: 'update', module: 'permissions', recordId: selectedUserId, description: `Overrides de permissão do usuário atualizados` });
    setSaving(false);
    setOverridesDirty(false);
    refreshPerms();
  }

  // ── Group modules ──

  const groupedModules = modules.reduce<Record<string, ModuleInfo[]>>((acc, m) => {
    (acc[m.group] ??= []).push(m);
    return acc;
  }, {});

  const GROUP_LABELS: Record<string, string> = {
    principal: 'Principal',
    gestao: 'Gestão',
    qualificacao: 'Qualificação',
    escola: 'Escola',
    sistema: 'Sistema',
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header (hidden when embedded in SettingsPage) */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-secondary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">Permissões</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Gerencie permissões por cargo e por usuário
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'roles'
              ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Por Cargo
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'overrides'
              ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Por Usuário
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'modules'
              ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          <Puzzle className="w-4 h-4 inline mr-2" />
          Módulos
        </button>
      </div>

      {/* ── Tab: Role Permissions ── */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {/* Role selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Cargo:</span>
            <div className="flex gap-2">
              {MANAGEABLE_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedRole === role
                      ? ROLE_COLORS[role] + ' ring-2 ring-offset-1 ring-gray-300 dark:ring-gray-600'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          {/* Info banner for super_admin */}
          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/40">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <strong>Super Admin</strong> tem acesso total automaticamente e não aparece nesta lista.
              As permissões abaixo são para o cargo <strong>{ROLE_LABELS[selectedRole]}</strong>.
            </p>
          </div>

          {/* Permissions grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_repeat(4,80px)] bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700/60">
                <span className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400">Módulo</span>
                {ACTIONS.map((a) => (
                  <span key={a} className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 text-center">
                    {ACTION_LABELS[a]}
                  </span>
                ))}
              </div>

              {/* Rows grouped by category */}
              {Object.entries(groupedModules).map(([group, mods]) => (
                <div key={group}>
                  <div className="px-5 py-2 bg-gray-50/50 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-700/30">
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400">
                      {GROUP_LABELS[group] || group}
                    </span>
                  </div>
                  {mods.map((mod) => {
                    const perm = rolePerms.find((p) => p.module_key === mod.key);
                    return (
                      <div
                        key={mod.key}
                        className="grid grid-cols-[1fr_repeat(4,80px)] px-5 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{mod.label}</span>
                          {mod.description && (
                            <p className="text-[11px] text-gray-400 mt-0.5">{mod.description}</p>
                          )}
                        </div>
                        {ACTIONS.map((action) => (
                          <div key={action} className="flex items-center justify-center">
                            <button
                              onClick={() => toggleRolePerm(mod.key, action)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                perm?.[action]
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                              }`}
                            >
                              {perm?.[action] ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Save button */}
          {dirty && (
            <div className="fixed bottom-6 right-6 z-50">
              <button
                onClick={saveRolePerms}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-3 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/30 hover:bg-brand-primary-dark transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Permissões
              </button>
            </div>
          )}
          {saved && (
            <div className="fixed bottom-6 right-6 z-50">
              <div className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-white rounded-xl shadow-lg">
                <Check className="w-4 h-4" />
                Salvo!
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: User Overrides ── */}
      {activeTab === 'overrides' && (
        <div className="space-y-4">
          {/* User selector (searchable) */}
          <UserSearchSelect
            users={users}
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
          />

          {/* Info */}
          <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/40">
            <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Overrides sobrescrevem as permissões do cargo. Clique para alternar:
              <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-500 text-[10px]">— herda</span>
              <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 rounded text-emerald-600 text-[10px]">✓ concede</span>
              <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 rounded text-red-600 text-[10px]">✕ nega</span>
            </p>
          </div>

          {selectedUserId && (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_repeat(4,80px)] bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700/60">
                  <span className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400">Módulo</span>
                  {ACTIONS.map((a) => (
                    <span key={a} className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 text-center">
                      {ACTION_LABELS[a]}
                    </span>
                  ))}
                </div>

                {modules.map((mod) => {
                  const override = userOverrides.find((o) => o.module_key === mod.key);
                  return (
                    <div
                      key={mod.key}
                      className="grid grid-cols-[1fr_repeat(4,80px)] px-5 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{mod.label}</span>
                      {ACTIONS.map((action) => {
                        const val = override?.[action] ?? null;
                        return (
                          <div key={action} className="flex items-center justify-center">
                            <button
                              onClick={() => toggleUserOverride(mod.key, action)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all text-xs font-bold ${
                                val === true
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                  : val === false
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                              }`}
                            >
                              {val === true ? <Check className="w-4 h-4" /> : val === false ? <X className="w-3.5 h-3.5" /> : '—'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Effective permissions preview toggle */}
              <div className="mt-4">
                <button
                  onClick={() => setShowEffective((prev) => !prev)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    showEffective
                      ? 'bg-brand-primary/10 dark:bg-brand-secondary/10 text-brand-primary dark:text-brand-secondary'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {showEffective ? 'Ocultar' : 'Visualizar'} Permissões Efetivas
                </button>
              </div>

              {/* Effective permissions grid (read-only) */}
              {showEffective && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/40">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Resultado final das permissões do cargo <strong>{ROLE_LABELS[users.find((u) => u.id === selectedUserId)?.role || 'user']}</strong> combinadas
                      com os overrides individuais. Células destacadas em{' '}
                      <span className="inline-block w-2 h-2 rounded-sm bg-amber-400 align-middle mx-0.5" /> amarelo indicam que um override alterou o valor do cargo.
                    </p>
                  </div>

                  {effectiveLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_repeat(4,80px)] bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700/60">
                        <span className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400">Módulo</span>
                        {ACTIONS.map((a) => (
                          <span key={a} className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 text-center">
                            {ACTION_LABELS[a]}
                          </span>
                        ))}
                      </div>

                      {modules.map((mod) => {
                        const eff = effectivePerms.find((p) => p.module_key === mod.key);
                        const rolePerm = selectedUserRolePerms.find((p) => p.module_key === mod.key);
                        return (
                          <div
                            key={mod.key}
                            className="grid grid-cols-[1fr_repeat(4,80px)] px-5 py-3 border-b border-gray-50 dark:border-gray-800"
                          >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{mod.label}</span>
                            {ACTIONS.map((action) => {
                              const effVal = eff?.[action] ?? false;
                              const roleVal = rolePerm?.[action] ?? false;
                              const isOverridden = effVal !== roleVal;
                              return (
                                <div key={action} className="flex items-center justify-center">
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                      effVal
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                                    } ${isOverridden ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
                                    title={isOverridden ? 'Alterado por override' : 'Herdado do cargo'}
                                  >
                                    {effVal ? <Check className="w-4 h-4" /> : <X className="w-3.5 h-3.5" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {overridesDirty && (
                <div className="fixed bottom-6 right-6 z-50">
                  <button
                    onClick={saveUserOverrides}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-3 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/30 hover:bg-brand-primary-dark transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Overrides
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Modules ── */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {/* Info */}
          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/40">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Desative módulos que não são utilizados. Módulos desativados ficam ocultos do menu e inacessíveis.
              Dependências são respeitadas automaticamente.
            </p>
          </div>

          {modulesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
              {Object.entries(
                allModules.reduce<Record<string, typeof allModules>>((acc, m) => {
                  (acc[m.group] ??= []).push(m);
                  return acc;
                }, {}),
              ).map(([group, mods]) => (
                <div key={group}>
                  <div className="px-5 py-2 bg-gray-50/50 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-700/30">
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400">
                      {GROUP_LABELS[group] || group}
                    </span>
                  </div>
                  {mods.map((mod) => {
                    const dependents = allModules.filter((m) => m.is_active && m.depends_on.includes(mod.key));
                    return (
                      <div
                        key={mod.key}
                        className={`flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800 transition-colors ${
                          !mod.is_active ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{mod.label}</span>
                            {mod.depends_on.length > 0 && (
                              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                                depende de: {mod.depends_on.map((d) => allModules.find((m) => m.key === d)?.label || d).join(', ')}
                              </span>
                            )}
                            {dependents.length > 0 && mod.is_active && (
                              <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                {dependents.length} módulo(s) depende(m) deste
                              </span>
                            )}
                          </div>
                          {mod.description && (
                            <p className="text-[11px] text-gray-400 mt-0.5">{mod.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleModuleActive(mod.key)}
                          className="flex-shrink-0 ml-4"
                          title={mod.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {mod.is_active ? (
                            <ToggleRight className="w-8 h-8 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {modulesDirty && (
            <div className="fixed bottom-6 right-6 z-50">
              <button
                onClick={saveModuleStates}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-3 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/30 hover:bg-brand-primary-dark transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Módulos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
