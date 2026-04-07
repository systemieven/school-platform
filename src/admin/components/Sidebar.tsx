import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { ADMIN_NAV } from '../lib/admin-navigation';
import { ROLE_LABELS } from '../types/admin.types';
import {
  LayoutDashboard,
  CalendarCheck,
  GraduationCap,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';

// Map icon name → component
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  CalendarCheck,
  GraduationCap,
  MessageSquare,
  Users,
  Settings,
};

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const { profile, signOut } = useAdminAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-[#003876] text-white flex flex-col z-40 transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 flex-shrink-0">
        <div className="w-9 h-9 bg-[#ffd700] rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-[#003876] font-bold text-sm">CB</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-display font-bold text-sm leading-tight truncate">Colégio Batista</p>
            <p className="text-[10px] text-white/50">Painel Administrativo</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {ADMIN_NAV.map((group) => {
          const visibleItems = group.items.filter(
            (item) => profile && item.roles.includes(profile.role),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-white/40 mb-2 px-2">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      end={item.path === '/admin'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-[#ffd700] text-[#003876] shadow-lg shadow-[#ffd700]/20'
                            : 'text-white/70 hover:text-white hover:bg-white/10'
                        } ${collapsed ? 'justify-center' : ''}`
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom: user + actions */}
      <div className="border-t border-white/10 p-3 flex-shrink-0">
        {/* User info */}
        {profile && !collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold">
                {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{profile.full_name || 'Usuário'}</p>
              <p className="text-[10px] text-white/50">{ROLE_LABELS[profile.role]}</p>
            </div>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={() => {
            const html = document.documentElement;
            const isDark = html.classList.toggle('dark');
            try { localStorage.setItem('admin_theme', isDark ? 'dark' : 'light'); } catch {}
          }}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Alternar tema"
        >
          <Moon className="w-5 h-5 flex-shrink-0 dark:hidden" />
          <Sun className="w-5 h-5 flex-shrink-0 hidden dark:block" />
          {!collapsed && <span className="dark:hidden">Modo Escuro</span>}
          {!collapsed && <span className="hidden dark:block">Modo Claro</span>}
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all mt-1 ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Sair"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
