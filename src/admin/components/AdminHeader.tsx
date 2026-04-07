import { useAdminAuth } from '../hooks/useAdminAuth';
import { ROLE_LABELS } from '../types/admin.types';
import { Bell, Search } from 'lucide-react';

interface Props {
  sidebarCollapsed: boolean;
}

export default function AdminHeader({ sidebarCollapsed }: Props) {
  const { profile } = useAdminAuth();

  return (
    <header
      className={`sticky top-0 z-30 bg-white border-b border-gray-100 h-16 flex items-center justify-between px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
      }`}
    >
      {/* Left: breadcrumb placeholder */}
      <div className="flex items-center gap-4">
        <Breadcrumb />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Search (placeholder) */}
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#003876] hover:bg-gray-100 transition-colors">
          <Search className="w-5 h-5" />
        </button>

        {/* Notifications (placeholder) */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#003876] hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        {/* User mini */}
        {profile && (
          <div className="flex items-center gap-2 ml-2 pl-4 border-l border-gray-100">
            <div className="w-8 h-8 bg-[#003876]/10 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-[#003876]">
                {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-800 leading-tight">
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
          <span className="text-gray-300">/</span>
          <span className={i === segments.length - 1 ? 'text-[#003876] font-medium' : 'text-gray-400'}>
            {LABELS[seg] || seg}
          </span>
        </span>
      ))}
    </nav>
  );
}
