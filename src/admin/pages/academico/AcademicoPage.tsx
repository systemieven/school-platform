import { useEffect, useState } from 'react';
import {
  GraduationCap, BookOpen, CalendarClock, Calendar, FileText, Award, Bell, ScrollText,
  CalendarRange, PanelLeftClose, PanelLeftOpen, LayoutDashboard, UserCheck,
  BellRing, FileCheck2,
} from 'lucide-react';
import AcademicoDashboardPage from './AcademicoDashboardPage';
import StudentsPage from '../school/StudentsPage';
import SegmentsPage from '../school/SegmentsPage';
import DisciplinasPage from './DisciplinasPage';
import FaltasComunicacoesPage from '../school/FaltasComunicacoesPage';
import AutorizacoesSaidaAdminPage from '../school/AutorizacoesSaidaAdminPage';
import GradeHorariaPage from './GradeHorariaPage';
import CalendarioPage from './CalendarioPage';
import BoletimPage from './BoletimPage';
import ResultadoFinalPage from './ResultadoFinalPage';
import AlertasFrequenciaPage from './AlertasFrequenciaPage';
import HistoricoEscolarPage from './HistoricoEscolarPage';
import AnoLetivoPage from './AnoLetivoPage';

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
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
    description: 'KPIs, eventos da semana e gráficos personalizáveis',
  },
  {
    key: 'alunos',
    label: 'Alunos',
    shortLabel: 'Alunos',
    icon: UserCheck,
    description: 'Cadastro, busca e gestão de alunos',
  },
  {
    key: 'segmentos',
    label: 'Segmentos, Séries e Turmas',
    shortLabel: 'Segmentos',
    icon: GraduationCap,
    description: 'Gerencie a hierarquia acadêmica em três níveis',
  },
  {
    key: 'disciplinas',
    label: 'Disciplinas',
    shortLabel: 'Disciplinas',
    icon: BookOpen,
    description: 'Cadastro de disciplinas e atribuição por turma',
  },
  {
    key: 'grade-horaria',
    label: 'Grade Horária',
    shortLabel: 'Grade',
    icon: CalendarClock,
    description: 'Grade de horários por turma',
  },
  {
    key: 'calendario',
    label: 'Calendário Letivo',
    shortLabel: 'Calendário',
    icon: Calendar,
    description: 'Períodos, feriados e eventos do ano letivo',
  },
  {
    key: 'boletim',
    label: 'Boletim',
    shortLabel: 'Boletim',
    icon: FileText,
    description: 'Boletim formal — notas por turma, período e disciplina',
  },
  {
    key: 'resultado',
    label: 'Resultado Final',
    shortLabel: 'Resultado',
    icon: Award,
    description: 'Resultado final dos alunos por turma e ano letivo',
  },
  {
    key: 'alertas',
    label: 'Alertas de Frequência',
    shortLabel: 'Alertas',
    icon: Bell,
    description: 'Alunos em risco por baixa frequência',
  },
  {
    key: 'historico',
    label: 'Histórico Escolar',
    shortLabel: 'Histórico',
    icon: ScrollText,
    description: 'Histórico escolar e transcrições dos alunos',
  },
  {
    key: 'ano-letivo',
    label: 'Ano Letivo',
    shortLabel: 'Ano Letivo',
    icon: CalendarRange,
    description: 'Sugestões de progressão de série para o próximo ano letivo',
  },
  {
    key: 'faltas',
    label: 'Comunicação de Faltas',
    shortLabel: 'Faltas',
    icon: BellRing,
    description: 'Notifique responsáveis sobre faltas e ausências dos alunos',
  },
  {
    key: 'autorizacoes-saida',
    label: 'Autorizações de Saída',
    shortLabel: 'Autorizações',
    icon: FileCheck2,
    description: 'Gerencie autorizações de saída antecipada dos alunos',
  },
];

export default function AcademicoPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabsCollapsed, setTabsCollapsed] = useState(false);

  // Listen for "Ver calendário" link from AcademicoDashboardPage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setActiveTab(detail);
    };
    window.addEventListener('academico:switch-tab', handler);
    return () => window.removeEventListener('academico:switch-tab', handler);
  }, []);

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Acadêmico</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Disciplinas, grade horária, calendário letivo, boletim e resultados
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
              {activeTab === 'dashboard'    && <AcademicoDashboardPage />}
              {activeTab === 'alunos'       && <StudentsPage />}
              {activeTab === 'segmentos'    && <SegmentsPage />}
              {activeTab === 'disciplinas' && <DisciplinasPage />}
              {activeTab === 'grade-horaria' && <GradeHorariaPage />}
              {activeTab === 'calendario' && <CalendarioPage />}
              {activeTab === 'boletim' && <BoletimPage />}
              {activeTab === 'resultado' && <ResultadoFinalPage />}
              {activeTab === 'alertas' && <AlertasFrequenciaPage />}
              {activeTab === 'historico' && <HistoricoEscolarPage />}
              {activeTab === 'ano-letivo' && <AnoLetivoPage />}
              {activeTab === 'faltas' && <FaltasComunicacoesPage />}
              {activeTab === 'autorizacoes-saida' && <AutorizacoesSaidaAdminPage />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
