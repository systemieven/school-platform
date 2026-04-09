import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useWhatsAppStatus } from '../contexts/WhatsAppStatusContext';
import { ROLE_LABELS } from '../types/admin.types';
import { Bell, ChevronDown, KeyRound, PanelLeftClose, PanelLeftOpen, MessageCircle, UserCog } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';
import EditProfileDrawer from './EditProfileDrawer';
import ChangePasswordDrawer from './ChangePasswordDrawer';

interface Props {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function AdminHeader({ sidebarCollapsed, onToggleSidebar }: Props) {
  const { profile } = useAdminAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { state: waState } = useWhatsAppStatus();
  const navigate = useNavigate();
  const [panelOpen,        setPanelOpen]        = useState(false);
  const [menuOpen,         setMenuOpen]         = useState(false);
  const [editProfileOpen,  setEditProfileOpen]  = useState(false);
  const [changePassOpen,   setChangePassOpen]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

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
        {/* WhatsApp status badge */}
        {waState !== 'unknown' && (
          <button
            onClick={() => navigate('/admin/configuracoes')}
            title={
              waState === 'connected'    ? 'WhatsApp conectado'
              : waState === 'connecting' ? 'WhatsApp conectando…'
              : 'WhatsApp desconectado — clique para configurar'
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <MessageCircle className={`w-4 h-4 ${
              waState === 'connected'    ? 'text-emerald-500'
              : waState === 'connecting' ? 'text-amber-400 animate-pulse'
              : 'text-red-400'
            }`} />
            <span className={`hidden sm:inline ${
              waState === 'connected'    ? 'text-emerald-600 dark:text-emerald-400'
              : waState === 'connecting' ? 'text-amber-500 dark:text-amber-400'
              : 'text-red-500 dark:text-red-400'
            }`}>
              {waState === 'connected' ? 'Conectado' : waState === 'connecting' ? 'Conectando…' : 'Desconectado'}
            </span>
          </button>
        )}

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

        {/* Avatar + dropdown */}
        {profile && (
          <div ref={menuRef} className="relative ml-2 pl-4 border-l border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Opções de perfil"
            >
              {/* Avatar with accent ring */}
              <div className="relative flex-shrink-0">
                <div className={`w-8 h-8 rounded-full p-[2px] transition-colors ${menuOpen ? 'bg-[#003876] dark:bg-[#ffd700]' : 'bg-[#003876]/30 dark:bg-[#ffd700]/40'}`}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#003876]/10 dark:bg-white/10 flex items-center justify-center">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-[#003876] dark:text-[#ffd700]">
                        {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden md:flex md:items-center md:gap-1">
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">
                    {profile.full_name || 'Usuário'}
                  </p>
                  <p className="text-[10px] text-gray-400">{ROLE_LABELS[profile.role]}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={() => { setMenuOpen(false); setEditProfileOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <UserCog className="w-4 h-4 text-gray-400" />
                  Editar perfil
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setChangePassOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-gray-400" />
                  Alterar senha
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile drawers — rendered outside the right-section div to avoid stacking context issues */}
      <EditProfileDrawer
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
      <ChangePasswordDrawer
        open={changePassOpen}
        onClose={() => setChangePassOpen(false)}
      />
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
