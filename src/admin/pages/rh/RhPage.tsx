/**
 * RhPage
 *
 * Pagina-mae do modulo RH. Agrega Dashboard, Colaboradores e Processo
 * seletivo como sub-tabs, cada uma gateada pela sua chave granular
 * (`rh-dashboard`, `rh-colaboradores`, `rh-seletivo`). A umbrella libera
 * o acesso a `/admin/rh` se o usuario tem view em pelo menos uma sub-tab
 * (mesmo padrao de FinancialPage / SecretariaPage / AcademicoPage).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, UserPlus,
  PanelLeftClose, PanelLeftOpen, Lock,
} from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
import RhDashboardPage from './RhDashboardPage';
import ColaboradoresPage from './ColaboradoresPage';
import SeletivoPage from './SeletivoPage';

interface TabDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  moduleKey: string;
}

const TABS: TabDef[] = [
  {
    key: 'dashboard',
    label: 'Visão Geral',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
    description: 'KPIs de pessoas, vagas e pipeline',
    moduleKey: 'rh-dashboard',
  },
  {
    key: 'colaboradores',
    label: 'Colaboradores',
    shortLabel: 'Colaboradores',
    icon: Briefcase,
    description: 'Cadastro de colaboradores, documentos e acessos',
    moduleKey: 'rh-colaboradores',
  },
  {
    key: 'seletivo',
    label: 'Processo seletivo',
    shortLabel: 'Seletivo',
    icon: UserPlus,
    description: 'Vagas, candidatos e pipeline de contratação',
    moduleKey: 'rh-seletivo',
  },
];

export default function RhPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView } = usePermissions();
  const [tabsCollapsed, setTabsCollapsed] = useState(false);

  const visibleTabs = useMemo(() => TABS.filter((t) => canView(t.moduleKey)), [canView]);

  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(() => {
    const found = requestedTab && visibleTabs.some((t) => t.key === requestedTab);
    return found ? (requestedTab as string) : (visibleTabs[0]?.key ?? 'dashboard');
  });

  useEffect(() => {
    if (!visibleTabs.find((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? '');
    }
  }, [visibleTabs, activeTab]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab && visibleTabs.some((t) => t.key === tab)) {
      setActiveTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const currentTab = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  if (!currentTab) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">RH</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestão de pessoas e processos seletivos
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700/40 flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">
            Nenhuma seção disponível
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md mx-auto">
            Você tem acesso ao módulo RH mas não a nenhuma sub-seção. Solicite
            ao administrador o acesso aos itens que você precisa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">RH</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestão de pessoas e processos seletivos
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <nav
          className={`flex-shrink-0 transition-all duration-300 ${
            tabsCollapsed ? 'w-[52px]' : 'w-52'
          }`}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-20">
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

        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
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

            <div className="p-6">
              {activeTab === 'dashboard' && <RhDashboardPage />}
              {activeTab === 'colaboradores' && <ColaboradoresPage />}
              {activeTab === 'seletivo' && <SeletivoPage />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
