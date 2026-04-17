import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ModuleGuard from './components/ModuleGuard';
import AdminLayout from './AdminLayout';
import { Loader2 } from 'lucide-react';
import {
  SETTINGS_SUBTAB_MODULE_KEYS,
  GESTAO_SUBTAB_MODULE_KEYS,
  ACADEMICO_SUBTAB_MODULE_KEYS,
  LOJA_SUBTAB_MODULE_KEYS,
  SECRETARIA_SUBTAB_MODULE_KEYS,
  FINANCIAL_SUBTAB_MODULE_KEYS,
} from './lib/umbrella-modules';

// Eager: auth pages (small, needed immediately)
import LoginPage from './pages/login/LoginPage';
import ForcePasswordChange from './pages/auth/ForcePasswordChange';

// Lazy: all admin pages
// DashboardRouter escolhe entre DashboardPage (super_admin) e
// SharedDashboard (demais roles, com blocos filtrados por permissão).
const DashboardRouter      = lazy(() => import('./pages/dashboard/DashboardRouter'));
const GestaoPage           = lazy(() => import('./pages/gestao/GestaoPage'));
const SettingsPage         = lazy(() => import('./pages/settings/SettingsPage'));
const KanbanPage           = lazy(() => import('./pages/leads/KanbanPage'));
const ReportsPage          = lazy(() => import('./pages/reports/ReportsPage'));
const StudentsPage         = lazy(() => import('./pages/school/StudentsPage'));
const StudentImportPage    = lazy(() => import('./pages/school/StudentImportPage'));
const StudentDetailPage    = lazy(() => import('./pages/school/StudentDetailPage'));
const TeacherAreaPage      = lazy(() => import('./pages/teacher/TeacherAreaPage'));
const LibraryPage          = lazy(() => import('./pages/library/LibraryPage'));
const AnnouncementsPage    = lazy(() => import('./pages/announcements/AnnouncementsPage'));
const EventsPage           = lazy(() => import('./pages/events/EventsPage'));
const TestimonialsPage     = lazy(() => import('./pages/testimonials/TestimonialsPage'));

// Financial (single page with internal tabs)
const FinancialPage            = lazy(() => import('./pages/financial/FinancialPage'));

// Academic (single page with internal tab rail)
const AcademicoPage            = lazy(() => import('./pages/academico/AcademicoPage'));

// Fase 10 — Portal do Responsavel (admin pages)
const OcorrenciasPage          = lazy(() => import('./pages/school/OcorrenciasPage'));
const AutorizacoesPage         = lazy(() => import('./pages/school/AutorizacoesPage'));
const ResponsaveisPage         = lazy(() => import('./pages/school/ResponsaveisPage'));

// Fase 10.P — Portal do Professor (admin read-only pages)
const DiarioAdminPage          = lazy(() => import('./pages/academico/DiarioAdminPage'));
const ProvasAdminPage          = lazy(() => import('./pages/academico/ProvasAdminPage'));

// Fase 11 — Secretaria Digital
const SecretariaPage           = lazy(() => import('./pages/secretaria/SecretariaPage'));

// Fase 11.B — Portaria, Comunicação de Faltas e Autorizações de Saída
const FaltasComunicacoesPage   = lazy(() => import('./pages/school/FaltasComunicacoesPage'));
const AutorizacoesSaidaAdminPage = lazy(() => import('./pages/school/AutorizacoesSaidaAdminPage'));
const PortariaPage             = lazy(() => import('./pages/school/PortariaPage'));

// Fase 15 — Achados e Perdidos Digital
const AchadosPerdidosPage      = lazy(() => import('./pages/school/AchadosPerdidosPage'));

// Fase 14 — Loja, PDV e Estoque
const LojaPage       = lazy(() => import('./pages/loja/LojaPage'));
const PDVPage        = lazy(() => import('./pages/loja/PDVPage'));
const OrderDetailPage = lazy(() => import('./pages/loja/OrderDetailPage'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          path="alterar-senha"
          element={
            <ProtectedRoute>
              <ForcePasswordChange />
            </ProtectedRoute>
          }
        />

        {/* All protected admin routes share the AdminLayout (which provides PermissionsProvider) */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ModuleGuard moduleKey="dashboard"><LazyPage><DashboardRouter /></LazyPage></ModuleGuard>} />

          {/* Gestão (tab rail: Agendamentos, Atendimentos, Contatos, Matrícula).
              Umbrella: liberado quando o usuário tem `view` em pelo menos uma
              sub-tab. As próprias tabs filtram-se internamente em GestaoPage. */}
          <Route path="gestao" element={<ModuleGuard anyModuleKeys={GESTAO_SUBTAB_MODULE_KEYS}><LazyPage><GestaoPage /></LazyPage></ModuleGuard>} />
          {/* Redirects de rotas legadas → /admin/gestao */}
          <Route path="agendamentos"           element={<Navigate to="/admin/gestao" replace />} />
          <Route path="matriculas"             element={<Navigate to="/admin/gestao?tab=matriculas" replace />} />
          <Route path="contatos"               element={<Navigate to="/admin/gestao?tab=contatos" replace />} />
          <Route path="atendimentos"           element={<Navigate to="/admin/gestao?tab=atendimentos" replace />} />
          <Route path="historico-atendimentos" element={<Navigate to="/admin/gestao?tab=historico" replace />} />

          <Route path="leads/kanban" element={<ModuleGuard moduleKey="kanban"><LazyPage><KanbanPage /></LazyPage></ModuleGuard>} />
          <Route path="relatorios"   element={<ModuleGuard moduleKey="reports"><LazyPage><ReportsPage /></LazyPage></ModuleGuard>} />

          {/* School */}
          <Route path="segmentos"      element={<Navigate to="/admin/academico" replace />} />
          <Route path="alunos"         element={<ModuleGuard moduleKey="students"><LazyPage><StudentsPage /></LazyPage></ModuleGuard>} />
          <Route path="alunos/importar" element={<ModuleGuard moduleKey="students" requiredAction="import"><LazyPage><StudentImportPage /></LazyPage></ModuleGuard>} />
          <Route path="alunos/:studentId" element={<ModuleGuard moduleKey="students"><LazyPage><StudentDetailPage /></LazyPage></ModuleGuard>} />
          <Route path="area-professor" element={<ModuleGuard moduleKey="teacher-area"><LazyPage><TeacherAreaPage /></LazyPage></ModuleGuard>} />
          <Route path="biblioteca"     element={<ModuleGuard moduleKey="library"><LazyPage><LibraryPage /></LazyPage></ModuleGuard>} />
          <Route path="comunicados"    element={<ModuleGuard moduleKey="announcements"><LazyPage><AnnouncementsPage /></LazyPage></ModuleGuard>} />
          <Route path="eventos"        element={<ModuleGuard moduleKey="events"><LazyPage><EventsPage /></LazyPage></ModuleGuard>} />
          <Route path="depoimentos"   element={<ModuleGuard moduleKey="testimonials"><LazyPage><TestimonialsPage /></LazyPage></ModuleGuard>} />

          {/* Financial (single page with internal tab rail).
              Umbrella: liberado quando o usuário tem `view` em pelo menos uma
              sub-tab do Financeiro (mesma semântica de /admin/academico,
              /admin/loja, /admin/secretaria e /admin/configuracoes).
              A página filtra as próprias tabs internamente. */}
          <Route path="financeiro"  element={<ModuleGuard anyModuleKeys={FINANCIAL_SUBTAB_MODULE_KEYS}><LazyPage><FinancialPage /></LazyPage></ModuleGuard>} />

          {/* Academic (single page with internal tab rail).
              Umbrella: liberado quando o usuário tem `view` em pelo menos uma
              sub-tab (academico, students, segments, absence-communications,
              exit-authorizations). AcademicoPage filtra suas próprias tabs. */}
          <Route path="academico"   element={<ModuleGuard anyModuleKeys={ACADEMICO_SUBTAB_MODULE_KEYS}><LazyPage><AcademicoPage /></LazyPage></ModuleGuard>} />

          {/* Fase 10 — Portal do Responsavel */}
          <Route path="ocorrencias"   element={<ModuleGuard moduleKey="occurrences"><LazyPage><OcorrenciasPage /></LazyPage></ModuleGuard>} />
          <Route path="autorizacoes"  element={<ModuleGuard moduleKey="activity-auth"><LazyPage><AutorizacoesPage /></LazyPage></ModuleGuard>} />
          <Route path="responsaveis"  element={<ModuleGuard moduleKey="guardian-portal"><LazyPage><ResponsaveisPage /></LazyPage></ModuleGuard>} />

          {/* Fase 10.P — Diario e Provas (leitura admin/coordenador).
              Cada rota guarda no seu próprio módulo granular (teacher-diary
              e teacher-exams) para que perfis com apenas uma das duas
              permissões não acessem indevidamente a outra. */}
          <Route path="diario"   element={<ModuleGuard moduleKey="teacher-diary"><LazyPage><DiarioAdminPage /></LazyPage></ModuleGuard>} />
          <Route path="provas"   element={<ModuleGuard moduleKey="teacher-exams"><LazyPage><ProvasAdminPage /></LazyPage></ModuleGuard>} />

          {/* Fase 11 — Secretaria Digital.
              Umbrella: liberado quando o usuário tem `view` em pelo menos uma
              sub-tab (declarações, saúde, rematrícula, transferências). */}
          <Route path="secretaria" element={<ModuleGuard anyModuleKeys={SECRETARIA_SUBTAB_MODULE_KEYS}><LazyPage><SecretariaPage /></LazyPage></ModuleGuard>} />

          {/* Fase 11.B — Portaria, Comunicação de Faltas e Autorizações de Saída */}
          <Route path="faltas" element={<ModuleGuard moduleKey="absence-communications"><LazyPage><FaltasComunicacoesPage /></LazyPage></ModuleGuard>} />
          <Route path="autorizacoes-saida" element={<ModuleGuard moduleKey="exit-authorizations"><LazyPage><AutorizacoesSaidaAdminPage /></LazyPage></ModuleGuard>} />
          <Route path="portaria" element={<ModuleGuard moduleKey="portaria"><LazyPage><PortariaPage /></LazyPage></ModuleGuard>} />

          {/* Fase 15 — Achados e Perdidos Digital */}
          <Route path="achados-perdidos" element={<ModuleGuard moduleKey="lost-found"><LazyPage><AchadosPerdidosPage /></LazyPage></ModuleGuard>} />

          {/* Fase 14 — Loja, PDV e Estoque.
              Umbrella: liberado quando o usuário tem `view` em pelo menos uma
              sub-tab da loja (loja, store-products, store-orders, store-pdv,
              store-reports). LojaPage filtra suas próprias tabs. */}
          <Route path="loja"                element={<ModuleGuard anyModuleKeys={LOJA_SUBTAB_MODULE_KEYS}><LazyPage><LojaPage /></LazyPage></ModuleGuard>} />
          <Route path="loja/pdv"            element={<ModuleGuard moduleKey="store-pdv"><LazyPage><PDVPage /></LazyPage></ModuleGuard>} />
          <Route path="loja/pedidos/:orderId" element={<ModuleGuard moduleKey="store-orders"><LazyPage><OrderDetailPage /></LazyPage></ModuleGuard>} />

          {/* System — Configurações.
              Umbrella: liberado quando o usuário tem `view` em pelo menos uma
              sub-tab. SettingsPage filtra suas próprias tabs por permissão. */}
          <Route path="configuracoes"  element={<ModuleGuard anyModuleKeys={SETTINGS_SUBTAB_MODULE_KEYS}><LazyPage><SettingsPage /></LazyPage></ModuleGuard>} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
