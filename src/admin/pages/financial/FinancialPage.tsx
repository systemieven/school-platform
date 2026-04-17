import { useState } from 'react';
import {
  LayoutDashboard, FileText, FileSignature, Receipt,
  Percent, GraduationCap, FileCode2,
  PanelLeftClose, PanelLeftOpen,
  Vault, TrendingUp, TrendingDown, BarChart3, Building2, Inbox,
} from 'lucide-react';
import FinancialDashboardPage from './FinancialDashboardPage';
import FinancialPlansPage from './FinancialPlansPage';
import FinancialContractsPage from './FinancialContractsPage';
import FinancialInstallmentsPage from './FinancialInstallmentsPage';
import FinancialCashPage from './FinancialCashPage';
import FinancialReceivablesPage from './FinancialReceivablesPage';
import FinancialPayablesPage from './FinancialPayablesPage';
import FinancialReportsPage from './FinancialReportsPage';
import FinancialDiscountsPage from './FinancialDiscountsPage';
import FinancialScholarshipsPage from './FinancialScholarshipsPage';
import FinancialTemplatesPage from './FinancialTemplatesPage';
import FornecedoresPage from './FornecedoresPage';
import NfeEntradasPage from './NfeEntradasPage';

interface TabDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabDef[] = [
  {
    key: 'dashboard',
    label: 'Visão Geral',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Resumo financeiro da instituição',
  },
  {
    key: 'plans',
    label: 'Planos de Mensalidade',
    shortLabel: 'Planos',
    icon: FileText,
    description: 'Gerencie planos e valores de mensalidade',
  },
  {
    key: 'contracts',
    label: 'Contratos',
    shortLabel: 'Contratos',
    icon: FileSignature,
    description: 'Contratos financeiros por aluno',
  },
  {
    key: 'installments',
    label: 'Cobranças',
    shortLabel: 'Cobranças',
    icon: Receipt,
    description: 'Parcelas, pagamentos e baixas manuais',
  },
  {
    key: 'cash',
    label: 'Caixas',
    shortLabel: 'Caixas',
    icon: Vault,
    description: 'Controle de caixas, abertura/fechamento e movimentações',
  },
  {
    key: 'receivables',
    label: 'Contas a Receber',
    shortLabel: 'A Receber',
    icon: TrendingUp,
    description: 'Contas a receber gerais (taxas, eventos, matrículas)',
  },
  {
    key: 'payables',
    label: 'Contas a Pagar',
    shortLabel: 'A Pagar',
    icon: TrendingDown,
    description: 'Contas a pagar (despesas fixas e variáveis)',
  },
  {
    key: 'reports',
    label: 'Relatórios',
    shortLabel: 'Relatórios',
    icon: BarChart3,
    description: 'Fluxo de caixa, DRE, inadimplência e previsão',
  },
  {
    key: 'discounts',
    label: 'Descontos',
    shortLabel: 'Descontos',
    icon: Percent,
    description: 'Descontos globais, por grupo ou por aluno',
  },
  {
    key: 'scholarships',
    label: 'Bolsas',
    shortLabel: 'Bolsas',
    icon: GraduationCap,
    description: 'Bolsas de estudo com validade e aprovação',
  },
  {
    key: 'templates',
    label: 'Templates de Documentos',
    shortLabel: 'Templates',
    icon: FileCode2,
    description: 'Templates de contrato, recibo e boleto',
  },
  {
    key: 'nfe-entrada',
    label: 'NF-e de Entrada',
    shortLabel: 'NF-e Entrada',
    icon: Inbox,
    description: 'Importação de XML de NF-e de entrada e vinculação com fornecedores',
  },
  {
    key: 'fornecedores',
    label: 'Fornecedores',
    shortLabel: 'Fornecedores',
    icon: Building2,
    description: 'Cadastro e gestão de fornecedores integrado a NF-e e contas a pagar',
  },
];

export default function FinancialPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabsCollapsed, setTabsCollapsed] = useState(false);

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Financeiro</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gerencie planos, contratos e cobranças da instituição
        </p>
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
              {TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
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
              {activeTab === 'dashboard' && <FinancialDashboardPage />}
              {activeTab === 'plans' && <FinancialPlansPage />}
              {activeTab === 'contracts' && <FinancialContractsPage />}
              {activeTab === 'installments' && <FinancialInstallmentsPage />}
              {activeTab === 'cash' && <FinancialCashPage />}
              {activeTab === 'receivables' && <FinancialReceivablesPage />}
              {activeTab === 'payables' && <FinancialPayablesPage />}
              {activeTab === 'reports' && <FinancialReportsPage />}
              {activeTab === 'discounts' && <FinancialDiscountsPage />}
              {activeTab === 'scholarships' && <FinancialScholarshipsPage />}
              {activeTab === 'templates' && <FinancialTemplatesPage />}
              {activeTab === 'nfe-entrada' && <NfeEntradasPage />}
              {activeTab === 'fornecedores' && <FornecedoresPage />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
