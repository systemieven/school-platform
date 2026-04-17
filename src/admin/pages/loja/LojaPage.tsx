import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, ClipboardList, Monitor, BarChart3,
  PanelLeftClose, PanelLeftOpen, ShieldOff,
} from 'lucide-react';
import LojaDashboardTab   from './tabs/LojaDashboardTab';
import ProdutosTab        from './tabs/ProdutosTab';
import PedidosTab         from './tabs/PedidosTab';
import PDVTab             from './tabs/PDVTab';
import RelatoriosLojaTab  from './tabs/RelatoriosLojaTab';
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
  { key: 'dashboard',  label: 'Dashboard',       shortLabel: 'Dashboard',  icon: LayoutDashboard, description: 'Visão geral da loja',                       moduleKey: 'loja' },
  { key: 'produtos',   label: 'Produtos',         shortLabel: 'Produtos',   icon: ShoppingBag,     description: 'Gerencie produtos, variantes e categorias', moduleKey: 'store-products' },
  { key: 'pedidos',    label: 'Pedidos',          shortLabel: 'Pedidos',    icon: ClipboardList,   description: 'Pipeline de pedidos e status de entrega',  moduleKey: 'store-orders' },
  { key: 'pdv',        label: 'PDV',              shortLabel: 'PDV',        icon: Monitor,         description: 'Ponto de venda e caixa',                    moduleKey: 'store-pdv' },
  { key: 'relatorios', label: 'Relatórios',       shortLabel: 'Relatórios', icon: BarChart3,       description: 'Relatórios e análises da loja',             moduleKey: 'store-reports' },
];

export default function LojaPage() {
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

  // Bounce when active tab loses visibility.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(firstVisibleKey);
    }
  }, [activeTab, visibleTabs, firstVisibleKey]);

  const currentTab = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  if (visibleTabs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Loja</h1>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <ShieldOff className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Você não tem permissão para visualizar nenhum módulo da loja.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Loja</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gerencie produtos, pedidos e ponto de venda da instituição
        </p>
      </div>

      <div className="flex gap-4">
        {/* Tab rail */}
        <nav className={`flex-shrink-0 transition-all duration-300 ${tabsCollapsed ? 'w-[52px]' : 'w-52'}`}>
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

        {/* Tab content */}
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
              {activeTab === 'dashboard'  && <LojaDashboardTab />}
              {activeTab === 'produtos'   && <ProdutosTab />}
              {activeTab === 'pedidos'    && <PedidosTab />}
              {activeTab === 'pdv'        && <PDVTab />}
              {activeTab === 'relatorios' && <RelatoriosLojaTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
