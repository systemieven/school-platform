import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { usePermissions } from '../contexts/PermissionsContext';
import { ADMIN_NAV } from '../lib/admin-navigation';
import { ROLE_LABELS } from '../types/admin.types';
import { useBranding } from '../../contexts/BrandingContext';
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
  LayoutTemplate,
  Send,
  Kanban,
  BarChart2,
  School,
  UserCheck,
  BookOpen,
  BookOpenCheck,
  Library,
  Megaphone,
  CalendarDays,
  Ticket,
  Shield,
  FileSearch,
  DollarSign,
  Archive,
  ScanFace,
  DoorOpen,
  ShoppingBag,
  Monitor,
} from 'lucide-react';

// Map icon name → component
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  CalendarCheck,
  GraduationCap,
  MessageSquare,
  Users,
  Settings,
  LayoutTemplate,
  Send,
  Kanban,
  BarChart2,
  School,
  UserCheck,
  BookOpen,
  BookOpenCheck,
  Library,
  Megaphone,
  CalendarDays,
  Ticket,
  Shield,
  FileSearch,
  DollarSign,
  Archive,
  ScanFace,
  DoorOpen,
  ShoppingBag,
  Monitor,
};

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle: _onToggle }: Props) {
  const { profile, signOut } = useAdminAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const { identity } = useBranding();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('admin_theme', next ? 'dark' : 'light'); } catch {}
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-brand-primary text-white flex flex-col z-40 transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 flex-shrink-0">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ${identity.logo_url ? 'bg-white p-1' : 'bg-brand-secondary'}`}>
          {identity.logo_url ? (
            <img src={identity.logo_url} alt={identity.school_short_name || ''} className="w-full h-full object-contain" />
          ) : (
            <span className="text-brand-primary font-bold text-sm">{identity.school_initials || 'CB'}</span>
          )}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-display font-bold text-sm leading-tight truncate">{identity.school_short_name || ''}</p>
            <p className="text-[10px] text-white/50">Painel Administrativo</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {ADMIN_NAV.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!profile) return false;
            // Use granular permissions if loaded; fall back to legacy roles array
            if (!permsLoading && item.moduleKey) return canView(item.moduleKey);
            return item.roles.includes(profile.role);
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-white/40 mb-2 px-2">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
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
                            ? 'bg-brand-secondary text-brand-primary shadow-lg shadow-brand-secondary/20'
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
          onClick={toggleTheme}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
          title={isDark ? 'Modo Claro' : 'Modo Escuro'}
        >
          {isDark ? (
            <Sun className="w-5 h-5 flex-shrink-0" />
          ) : (
            <Moon className="w-5 h-5 flex-shrink-0" />
          )}
          {!collapsed && <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>}
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
