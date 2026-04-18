import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useGuardian } from './contexts/GuardianAuthContext';
import GuardianProtectedRoute from './components/GuardianProtectedRoute';
import {
  LayoutDashboard, Star, CalendarClock, Wallet, Megaphone,
  CalendarDays, AlertCircle, CheckSquare, User,
  LogOut, Menu, X, ChevronDown, Users, FileText, RefreshCw,
  MessageSquareDot, DoorOpen, HeartPulse, ShoppingBag,
} from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';
import PortalAiNudge from '../shared/components/PortalAiNudge';

const NAV = [
  { path: '/responsavel',              label: 'Início',         icon: LayoutDashboard, end: true },
  { path: '/responsavel/notas',        label: 'Notas',          icon: Star },
  { path: '/responsavel/frequencia',   label: 'Frequência',     icon: CalendarClock },
  { path: '/responsavel/financeiro',   label: 'Financeiro',     icon: Wallet },
  { path: '/responsavel/declaracoes',  label: 'Declarações',    icon: FileText },
  { path: '/responsavel/rematricula',  label: 'Rematrícula',    icon: RefreshCw },
  { path: '/responsavel/saude',        label: 'Saúde',          icon: HeartPulse },
  { path: '/responsavel/comunicados',  label: 'Comunicados',    icon: Megaphone },
  { path: '/responsavel/eventos',      label: 'Eventos',        icon: CalendarDays },
  { path: '/responsavel/grade',        label: 'Grade Horária',  icon: CalendarClock },
  { path: '/responsavel/ocorrencias',        label: 'Ocorrências',     icon: AlertCircle },
  { path: '/responsavel/autorizacoes',       label: 'Autorizações',    icon: CheckSquare },
  { path: '/responsavel/faltas',             label: 'Comunicar Falta', icon: MessageSquareDot },
  { path: '/responsavel/autorizacoes-saida', label: 'Saída Autorizada', icon: DoorOpen },
  { path: '/responsavel/pedidos',            label: 'Pedidos',         icon: ShoppingBag },
  { path: '/responsavel/perfil',             label: 'Perfil',          icon: User },
];

function StudentSelector() {
  const { students, currentStudentId, setCurrentStudent } = useGuardian();
  const [open, setOpen] = useState(false);

  if (students.length <= 1) return null;

  const current = students.find((s) => s.student_id === currentStudentId);
  const currentName = current?.student?.full_name ?? 'Selecionar aluno';

  return (
    <div className="px-5 py-2 border-b border-white/10 relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 text-xs font-medium"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-3.5 h-3.5 flex-shrink-0 text-brand-secondary" />
          <span className="truncate">{currentName}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
          {students.map((s) => (
            <button
              key={s.student_id}
              onClick={() => { setCurrentStudent(s.student_id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                s.student_id === currentStudentId
                  ? 'bg-brand-primary/5 text-brand-primary dark:text-brand-secondary font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {s.student?.full_name ?? 'Aluno'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GuardianNav({ unreadOccurrences, onClose }: { unreadOccurrences: number; onClose?: () => void }) {
  const { guardian, signOut } = useGuardian();
  const { identity } = useBranding();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/responsavel/login');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-secondary flex items-center justify-center text-brand-primary font-bold text-sm">
            {identity.school_initials || 'ME'}
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">{identity.school_short_name || ''}</p>
            <p className="text-white/50 text-xs">Portal do Responsável</p>
          </div>
        </div>
      </div>

      {/* Guardian info */}
      {guardian && (
        <div className="px-5 py-3 border-b border-white/10">
          <div className="w-8 h-8 rounded-full bg-brand-secondary/20 flex items-center justify-center text-brand-secondary font-bold text-sm mb-1.5">
            {guardian.name.charAt(0).toUpperCase()}
          </div>
          <p className="text-white text-xs font-medium truncate">{guardian.name}</p>
          <p className="text-white/50 text-xs">Responsável</p>
        </div>
      )}

      {/* Student selector */}
      <StudentSelector />

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
            <span className="flex-1">{label}</span>
            {path === '/responsavel/ocorrencias' && unreadOccurrences > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {unreadOccurrences > 9 ? '9+' : unreadOccurrences}
              </span>
            )}
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

export default function GuardianLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadOccurrences] = useState(0); // managed by DashboardPage or context if needed
  const { identity } = useBranding();
  const { guardian } = useGuardian();

  return (
    <GuardianProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 bg-brand-primary dark:bg-gray-800 flex-col fixed inset-y-0 left-0 z-30">
          <GuardianNav unreadOccurrences={unreadOccurrences} />
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
              <GuardianNav unreadOccurrences={unreadOccurrences} onClose={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
          {/* Mobile topbar */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 bg-brand-primary text-white sticky top-0 z-20">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-secondary flex items-center justify-center text-brand-primary font-bold text-xs">
                {identity.school_initials || 'ME'}
              </div>
              <span className="font-semibold text-sm">Portal do Responsável</span>
            </div>
            <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10">
              <Menu className="w-5 h-5" />
            </button>
          </header>

          <main className="flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
        <PortalAiNudge authUserId={guardian?.id ?? null} />
      </div>
    </GuardianProtectedRoute>
  );
}
