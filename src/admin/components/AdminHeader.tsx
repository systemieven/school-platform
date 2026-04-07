import { useAdminAuth } from '../hooks/useAdminAuth';
import { ROLE_LABELS } from '../types/admin.types';
import { Bell, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface Props {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function AdminHeader({ sidebarCollapsed, onToggleSidebar }: Props) {
  const { profile } = useAdminAuth();

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
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Search className="w-5 h-5" />
        </button>

        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Bell className="w-5 h-5" />
        </button>

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

// ── Simple breadcrumb based on current path ──
function Breadcrumb() {
  const path = window.location.pathname;
  const segments = path
    .replace('/admin', '')
    .split('/')
    .filter(Boolean);

  const LABELS: Record<string, string> = {
    agendamentos: 'Agendamentos',
    matriculas: 'Pré-Matrículas',
    contatos: 'Contatos',
    usuarios: 'Usuários',
    configuracoes: 'Configurações',
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
