import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useNotifications } from '../hooks/useNotifications';
import { ROLE_LABELS } from '../types/admin.types';
import { Bell, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';

interface Props {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function AdminHeader({ sidebarCollapsed, onToggleSidebar }: Props) {
  const { profile } = useAdminAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <header
      className={`sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 h-16 flex items-center justify-between px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
      }`}
    >
      {/* Left: sidebar toggle + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
        <Breadcrumb />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {panelOpen && (
            <NotificationsPanel
              notifications={notifications}
              onClose={() => setPanelOpen(false)}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
            />
          )}
        </div>

        {/* Avatar */}
        {profile && (
          <div className="flex items-center gap-2 ml-2 pl-4 border-l border-gray-100 dark:border-gray-700">
            <div className="w-8 h-8 bg-[#003876]/10 dark:bg-white/10 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-[#003876] dark:text-[#ffd700]">
                {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">
                {profile.full_name || 'Usuário'}
              </p>
              <p className="text-[10px] text-gray-400">{ROLE_LABELS[profile.role]}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// ── Breadcrumb (uses useLocation for reactivity) ─────────────────────────────
function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname
    .replace('/admin', '')
    .split('/')
    .filter(Boolean);

  const LABELS: Record<string, string> = {
    agendamentos: 'Agendamentos',
    matriculas:   'Pré-Matrículas',
    contatos:     'Contatos',
    usuarios:     'Usuários',
    configuracoes:'Configurações',
  };

  return (
    <nav className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">Admin</span>
      {segments.map((seg, i) => (
        <span key={seg} className="flex items-center gap-2">
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className={i === segments.length - 1 ? 'text-[#003876] dark:text-[#ffd700] font-medium' : 'text-gray-400'}>
            {LABELS[seg] || seg}
          </span>
        </span>
      ))}
    </nav>
  );
}
