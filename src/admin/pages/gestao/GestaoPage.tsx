import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CalendarCheck, Ticket, MessageSquare, GraduationCap, History,
  PanelLeftClose, PanelLeftOpen, Settings, ShieldOff,
} from 'lucide-react';
import AppointmentsPage      from '../appointments/AppointmentsPage';
import AttendancePage        from '../attendance/AttendancePage';
import AttendanceHistoryPage from '../attendance/AttendanceHistoryPage';
import ContactsPage          from '../contacts/ContactsPage';
import EnrollmentsPage       from '../enrollments/EnrollmentsPage';
import { usePermissions } from '../../contexts/PermissionsContext';

interface TabDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  /** Granular module key required to view this tab. */
  moduleKey: string;
}

const TABS: TabDef[] = [
  {
    key: 'agendamentos',
    label: 'Agendamentos de Visita',
    shortLabel: 'Agendamentos',
    icon: CalendarCheck,
    description: 'Visitas agendadas e controle de horários',
    moduleKey: 'appointments',
  },
  {
    key: 'atendimentos',
    label: 'Atendimentos',
    shortLabel: 'Atendimentos',
    icon: Ticket,
    description: 'Fila de atendimento presencial, senhas e histórico',
    moduleKey: 'attendance',
  },
  {
    key: 'contatos',
    label: 'Contatos',
    shortLabel: 'Contatos',
    icon: MessageSquare,
    description: 'Mensagens recebidas pelo formulário do site',
    moduleKey: 'contacts',
  },
  {
    key: 'matriculas',
    label: 'Matrícula',
    shortLabel: 'Matrícula',
    icon: GraduationCap,
    description: 'Pré-matrículas, fichas e documentação',
    moduleKey: 'enrollments',
  },
  {
    key: 'historico',
    label: 'Histórico de Atendimentos',
    shortLabel: 'Histórico',
    icon: History,
    description: 'Tickets finalizados, abandonados e faltas',
    moduleKey: 'attendance',
  },
];

/**
 * Mapeamento tab → aba de Configurações (/admin/configuracoes?tab=X) com a
 * chave granular `settings-*` usada para gatear o atalho.
 */
const TAB_SETTINGS: Record<string, { tab: string; moduleKey: string }> = {
  agendamentos: { tab: 'visits',      moduleKey: 'settings-visits' },
  atendimentos: { tab: 'attendance',  moduleKey: 'settings-attendance' },
  contatos:     { tab: 'contact',     moduleKey: 'settings-contact' },
  matriculas:   { tab: 'enrollment',  moduleKey: 'settings-enrollment' },
  historico:    { tab: 'attendance',  moduleKey: 'settings-attendance' },
};

export default function GestaoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView } = usePermissions();
  const visibleTabs = useMemo(
    () => TABS.filter((t) => canView(t.moduleKey)),
    [canView],
  );
  const firstVisibleKey = visibleTabs[0]?.key ?? TABS[0].key;
  const requestedTab = searchParams.get('tab');
  const initialTab =
    requestedTab && visibleTabs.some((t) => t.key === requestedTab)
      ? requestedTab
      : firstVisibleKey;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tabsCollapsed, setTabsCollapsed] = useState(false);

  // If the active tab disappears from `visibleTabs` (perm refresh, etc.),
  // bounce to the first one the user is allowed to see.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(firstVisibleKey);
    }
  }, [activeTab, visibleTabs, firstVisibleKey]);

  // Sincroniza com URL (busca do breadcrumb → ?tab=X com página já montada).
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab && visibleTabs.some((t) => t.key === tab)) {
      setActiveTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const currentTab = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  if (visibleTabs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestão</h1>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <ShieldOff className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Você não tem permissão para visualizar nenhum módulo de gestão.
          </p>
        </div>
      </div>
    );
  }

  const settingsShortcut = TAB_SETTINGS[activeTab];
  const showSettingsLink =
    !!settingsShortcut && canView(settingsShortcut.moduleKey);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestão</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Agendamentos, atendimentos, contatos e matrículas
          </p>
        </div>
        {showSettingsLink && (
          <Link
            to={`/admin/configuracoes?tab=${settingsShortcut.tab}`}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4 text-brand-secondary" />
            Configurações
          </Link>
        )}
      </div>

      {/* Tabs + Content layout */}
      <div className="flex gap-4">
        {/* Tab rail */}
        <nav
          className={`flex-shrink-0 transition-all duration-300 ${
            tabsCollapsed ? 'w-[52px]' : 'w-52'
          }`}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-20">
            {/* Collapse toggle */}
            <button
              onClick={() => setTabsCollapsed(!tabsCollapsed)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700"
              title={tabsCollapsed ? 'Expandir abas' : 'Recolher abas'}
            >
              {tabsCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 mx-auto" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span className="text-xs font-medium">Recolher</span>
                </>
              )}
            </button>

            {/* Tab items */}
            <div className="p-1.5 space-y-0.5">
              {visibleTabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setSearchParams({ tab: tab.key }, { replace: true }); }}
                    title={tabsCollapsed ? tab.label : undefined}
                    className={`
                      relative w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200
                      ${tabsCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5'}
                      ${isActive
                        ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/15'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-primary dark:hover:text-white'
                      }
                    `}
                  >
                    <TabIcon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-brand-secondary' : ''}`} />
                    {!tabsCollapsed && (
                      <span className="truncate text-left flex-1 text-[13px]">{tab.shortLabel}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Tab title bar */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <currentTab.icon className="w-[18px] h-[18px] text-brand-primary dark:text-brand-secondary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-brand-primary dark:text-white truncate">
                  {currentTab.label}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate hidden sm:block">{currentTab.description}</p>
              </div>
            </div>

            {/* Panel content */}
            <div className="p-6">
              {activeTab === 'agendamentos' && <AppointmentsPage />}
              {activeTab === 'atendimentos' && <AttendancePage />}
              {activeTab === 'contatos'     && <ContactsPage />}
              {activeTab === 'matriculas'   && <EnrollmentsPage />}
              {activeTab === 'historico'    && <AttendanceHistoryPage />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
