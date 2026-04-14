import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useStudentAuth } from './contexts/StudentAuthContext';
import StudentProtectedRoute from './components/StudentProtectedRoute';
import {
  LayoutDashboard, ClipboardList, Star, Megaphone, Library, User, LogOut, Menu, X, CalendarDays, Wallet, CalendarClock,
} from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';

const NAV = [
  { path: '/portal',            label: 'Início',       icon: LayoutDashboard, end: true },
  { path: '/portal/atividades', label: 'Atividades',   icon: ClipboardList },
  { path: '/portal/notas',      label: 'Notas',        icon: Star },
  { path: '/portal/grade',      label: 'Grade Horária', icon: CalendarClock },
  { path: '/portal/comunicados',label: 'Comunicados',  icon: Megaphone },
  { path: '/portal/eventos',    label: 'Eventos',      icon: CalendarDays },
  { path: '/portal/financeiro', label: 'Financeiro',   icon: Wallet },
  { path: '/portal/biblioteca', label: 'Biblioteca',   icon: Library },
  { path: '/portal/perfil',     label: 'Perfil',       icon: User },
];

function PortalNav({ onClose }: { onClose?: () => void }) {
  const { student, signOut } = useStudentAuth();
  const { identity } = useBranding();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/portal/login');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-secondary flex items-center justify-center text-brand-primary font-bold text-sm">{identity.school_initials || 'CB'}</div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">{identity.school_short_name || ''}</p>
            <p className="text-white/50 text-xs">Portal do Aluno</p>
          </div>
        </div>
      </div>

      {/* Student info */}
      {student && (
        <div className="px-5 py-3 border-b border-white/10">
          <div className="w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-bold text-sm mb-1.5">
            {student.full_name.charAt(0).toUpperCase()}
          </div>
          <p className="text-white text-xs font-medium truncate">{student.full_name}</p>
          <p className="text-white/50 text-xs">Matrícula {student.enrollment_number}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ path, label, icon: Icon, end }) => (
          <NavLink key={path} to={path} end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-secondary text-brand-primary'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`
            }>
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-white/10">
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </div>
  );
}

export default function PortalLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { identity } = useBranding();

  return (
    <StudentProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 bg-brand-primary dark:bg-gray-800 flex-col fixed inset-y-0 left-0 z-30">
          <PortalNav />
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-brand-primary flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end p-3">
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-white/70 hover:bg-white/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <PortalNav onClose={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
          {/* Mobile topbar */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 bg-brand-primary text-white sticky top-0 z-20">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-secondary flex items-center justify-center text-brand-primary font-bold text-xs">{identity.school_initials || 'CB'}</div>
              <span className="font-semibold text-sm">Portal do Aluno</span>
            </div>
            <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10">
              <Menu className="w-5 h-5" />
            </button>
          </header>

          <main className="flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </StudentProtectedRoute>
  );
}
