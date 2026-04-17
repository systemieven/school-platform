/**
 * FinancialPage
 *
 * Página-mãe do módulo Financeiro. Cada sub-tab é gateada pela sua
 * chave granular correspondente (`financial-plans`, `financial-cash`,
 * `payment-gateways` para o atalho de Configurações, etc.). O usuário
 * só vê (e só pode acessar via clique) as abas para as quais tem
 * `canView(moduleKey) === true`. A primeira aba visível é selecionada
 * automaticamente.
 *
 * Observação: as sub-páginas individuais já validam permissão via
 * `<PermissionGate>` nos botões CRUD; este gating cobre a camada de
 * navegação (rail) e o atalho cross-module para Configurações, que
 * antes vazavam todo o conteúdo independentemente da permissão.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, FileText, FileSignature, Receipt,
  Percent, GraduationCap, FileCode2,
  PanelLeftClose, PanelLeftOpen,
  Vault, TrendingUp, TrendingDown, BarChart3, Building2, Inbox,
  FileCheck2, Settings, Lock,
} from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
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
import NfeEmitidasPage from './NfeEmitidasPage';
import NfseEmitidas from './NfseEmitidas';
import NfseApuracaoPage from './NfseApuracaoPage';

interface TabDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  /**
   * Chave de módulo que controla a visibilidade desta aba.
   * `'financial'` = umbrella (qualquer um que entre na página vê).
   */
  moduleKey: string;
}

const TABS: TabDef[] = [
  {
    key: 'dashboard',
    label: 'Visão Geral',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Resumo financeiro da instituição',
    moduleKey: 'financial',
  },
  {
    key: 'plans',
    label: 'Planos de Mensalidade',
    shortLabel: 'Planos',
    icon: FileText,
    description: 'Gerencie planos e valores de mensalidade',
    moduleKey: 'financial-plans',
  },
  {
    key: 'contracts',
    label: 'Contratos',
    shortLabel: 'Contratos',
    icon: FileSignature,
    description: 'Contratos financeiros por aluno',
    moduleKey: 'financial-contracts',
  },
  {
    key: 'installments',
    label: 'Cobranças',
    shortLabel: 'Cobranças',
    icon: Receipt,
    description: 'Parcelas, pagamentos e baixas manuais',
    moduleKey: 'financial-installments',
  },
  {
    key: 'cash',
    label: 'Caixas',
    shortLabel: 'Caixas',
    icon: Vault,
    description: 'Controle de caixas, abertura/fechamento e movimentações',
    moduleKey: 'financial-cash',
  },
  {
    key: 'receivables',
    label: 'Contas a Receber',
    shortLabel: 'A Receber',
    icon: TrendingUp,
    description: 'Contas a receber gerais (taxas, eventos, matrículas)',
    moduleKey: 'financial-receivables',
  },
  {
    key: 'payables',
    label: 'Contas a Pagar',
    shortLabel: 'A Pagar',
    icon: TrendingDown,
    description: 'Contas a pagar (despesas fixas e variáveis)',
    moduleKey: 'financial-payables',
  },
  {
    key: 'reports',
    label: 'Relatórios',
    shortLabel: 'Relatórios',
    icon: BarChart3,
    description: 'Fluxo de caixa, DRE, inadimplência e previsão',
    moduleKey: 'financial-reports',
  },
  {
    key: 'discounts',
    label: 'Descontos',
    shortLabel: 'Descontos',
    icon: Percent,
    description: 'Descontos globais, por grupo ou por aluno',
    moduleKey: 'financial-account-categories', // gateado como item de configuração financeira
  },
  {
    key: 'scholarships',
    label: 'Bolsas',
    shortLabel: 'Bolsas',
    icon: GraduationCap,
    description: 'Bolsas de estudo com validade e aprovação',
    moduleKey: 'financial-account-categories',
  },
  {
    key: 'templates',
    label: 'Templates de Documentos',
    shortLabel: 'Templates',
    icon: FileCode2,
    description: 'Templates de contrato, recibo e boleto',
    moduleKey: 'financial-account-categories',
  },
  {
    key: 'nfse',
    label: 'NFS-e Emitidas',
    shortLabel: 'NFS-e',
    icon: FileCheck2,
    description: 'Notas Fiscais de Serviço emitidas e status de emissão',
    moduleKey: 'nfse-emitidas',
  },
  {
    key: 'nfse-apuracao',
    label: 'Apuração NFS-e',
    shortLabel: 'Apuração',
    icon: BarChart3,
    description: 'Resumo mensal de ISS, retenções federais e exportação CSV',
    moduleKey: 'nfse-apuracao',
  },
  {
    key: 'nfe-entrada',
    label: 'NF-e de Entrada',
    shortLabel: 'NF-e Entrada',
    icon: Inbox,
    description: 'Importação de XML de NF-e de entrada e vinculação com fornecedores',
    moduleKey: 'fornecedores', // sem chave própria; usa fornecedores como proxy
  },
  {
    key: 'nfe-emitidas',
    label: 'NF-e Emitidas (Devolução)',
    shortLabel: 'NF-e Saída',
    icon: FileSignature,
    description: 'NF-e modelo 55 de devolução emitidas a fornecedores',
    moduleKey: 'fornecedores',
  },
  {
    key: 'fornecedores',
    label: 'Fornecedores',
    shortLabel: 'Fornecedores',
    icon: Building2,
    description: 'Cadastro e gestão de fornecedores integrado a NF-e e contas a pagar',
    moduleKey: 'fornecedores',
  },
];

export default function FinancialPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView } = usePermissions();
  const [tabsCollapsed, setTabsCollapsed] = useState(false);

  // Filtra as abas em runtime: o usuário só vê aquilo que pode visualizar.
  const visibleTabs = useMemo(() => TABS.filter((t) => canView(t.moduleKey)), [canView]);

  // Prioriza ?tab= da URL (links diretos, breadcrumb); cai na primeira
  // aba visível se o tab pedido não existir ou não tiver permissão.
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(
    () => {
      const found = requestedTab && visibleTabs.some((t) => t.key === requestedTab);
      return found ? requestedTab : (visibleTabs[0]?.key ?? 'dashboard');
    },
  );

  // Se a permissão muda no meio da sessão (ex.: super_admin alterou perms
  // do usuário), garante que `activeTab` continua valendo.
  useEffect(() => {
    if (!visibleTabs.find((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? '');
    }
  }, [visibleTabs, activeTab]);

  const currentTab = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  // Botão "Configurações" só faz sentido para quem pode entrar lá:
  // gateamos pela chave granular `settings-financial` (migration 148).
  const canSeeSettingsShortcut = canView('settings-financial');

  // Empty-state: usuário tem `financial.can_view` (passou no ModuleGuard
  // da rota) mas perdeu todas as sub-permissões — caso raro mas possível.
  if (!currentTab) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Financeiro</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gerencie planos, contratos e cobranças da instituição
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700/40 flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">
            Nenhuma seção disponível
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md mx-auto">
            Você tem acesso ao módulo Financeiro mas não a nenhuma sub-seção.
            Solicite ao administrador o acesso aos itens que você precisa
            (Planos, Cobranças, Relatórios, etc.).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Financeiro</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie planos, contratos e cobranças da instituição
          </p>
        </div>
        {canSeeSettingsShortcut && (
          <Link
            to="/admin/configuracoes?tab=financial"
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

            {/* Tab items — só as visíveis */}
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
              {activeTab === 'nfse' && <NfseEmitidas />}
              {activeTab === 'nfse-apuracao' && <NfseApuracaoPage />}
              {activeTab === 'nfe-entrada' && <NfeEntradasPage />}
              {activeTab === 'nfe-emitidas' && <NfeEmitidasPage />}
              {activeTab === 'fornecedores' && <FornecedoresPage />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
