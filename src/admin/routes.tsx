import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ModuleGuard from './components/ModuleGuard';
import AdminLayout from './AdminLayout';
import { Loader2 } from 'lucide-react';

// Eager: auth pages (small, needed immediately)
import LoginPage from './pages/login/LoginPage';
import ForcePasswordChange from './pages/auth/ForcePasswordChange';

// Lazy: all admin pages
const DashboardPage        = lazy(() => import('./pages/dashboard/DashboardPage'));
const SettingsPage         = lazy(() => import('./pages/settings/SettingsPage'));
const AppointmentsPage     = lazy(() => import('./pages/appointments/AppointmentsPage'));
const EnrollmentsPage      = lazy(() => import('./pages/enrollments/EnrollmentsPage'));
const ContactsPage         = lazy(() => import('./pages/contacts/ContactsPage'));
const KanbanPage           = lazy(() => import('./pages/leads/KanbanPage'));
const ReportsPage          = lazy(() => import('./pages/reports/ReportsPage'));
const StudentsPage         = lazy(() => import('./pages/school/StudentsPage'));
const StudentImportPage    = lazy(() => import('./pages/school/StudentImportPage'));
const StudentDetailPage    = lazy(() => import('./pages/school/StudentDetailPage'));
const TeacherAreaPage      = lazy(() => import('./pages/teacher/TeacherAreaPage'));
const LibraryPage          = lazy(() => import('./pages/library/LibraryPage'));
const AnnouncementsPage    = lazy(() => import('./pages/announcements/AnnouncementsPage'));
const EventsPage           = lazy(() => import('./pages/events/EventsPage'));
const AttendancePage       = lazy(() => import('./pages/attendance/AttendancePage'));
const AttendanceHistoryPage = lazy(() => import('./pages/attendance/AttendanceHistoryPage'));
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
          <Route index element={<ModuleGuard moduleKey="dashboard"><LazyPage><DashboardPage /></LazyPage></ModuleGuard>} />

          <Route path="agendamentos" element={<ModuleGuard moduleKey="appointments"><LazyPage><AppointmentsPage /></LazyPage></ModuleGuard>} />
          <Route path="matriculas"   element={<ModuleGuard moduleKey="enrollments"><LazyPage><EnrollmentsPage /></LazyPage></ModuleGuard>} />
          <Route path="contatos"     element={<ModuleGuard moduleKey="contacts"><LazyPage><ContactsPage /></LazyPage></ModuleGuard>} />
          <Route path="atendimentos" element={<ModuleGuard moduleKey="attendance"><LazyPage><AttendancePage /></LazyPage></ModuleGuard>} />
          <Route path="historico-atendimentos" element={<ModuleGuard moduleKey="attendance"><LazyPage><AttendanceHistoryPage /></LazyPage></ModuleGuard>} />

          <Route path="leads/kanban" element={<ModuleGuard moduleKey="kanban"><LazyPage><KanbanPage /></LazyPage></ModuleGuard>} />
          <Route path="relatorios"   element={<ModuleGuard moduleKey="reports"><LazyPage><ReportsPage /></LazyPage></ModuleGuard>} />

          {/* School */}
          <Route path="segmentos"      element={<Navigate to="/admin/academico" replace />} />
          <Route path="alunos"         element={<ModuleGuard moduleKey="students"><LazyPage><StudentsPage /></LazyPage></ModuleGuard>} />
          <Route path="alunos/importar" element={<ModuleGuard moduleKey="students"><LazyPage><StudentImportPage /></LazyPage></ModuleGuard>} />
          <Route path="alunos/:studentId" element={<ModuleGuard moduleKey="students"><LazyPage><StudentDetailPage /></LazyPage></ModuleGuard>} />
          <Route path="area-professor" element={<ModuleGuard moduleKey="teacher-area"><LazyPage><TeacherAreaPage /></LazyPage></ModuleGuard>} />
          <Route path="biblioteca"     element={<ModuleGuard moduleKey="library"><LazyPage><LibraryPage /></LazyPage></ModuleGuard>} />
          <Route path="comunicados"    element={<ModuleGuard moduleKey="announcements"><LazyPage><AnnouncementsPage /></LazyPage></ModuleGuard>} />
          <Route path="eventos"        element={<ModuleGuard moduleKey="events"><LazyPage><EventsPage /></LazyPage></ModuleGuard>} />
          <Route path="depoimentos"   element={<ModuleGuard moduleKey="testimonials"><LazyPage><TestimonialsPage /></LazyPage></ModuleGuard>} />

          {/* Financial (single page with internal tab rail) */}
          <Route path="financeiro"  element={<ModuleGuard moduleKey="financial"><LazyPage><FinancialPage /></LazyPage></ModuleGuard>} />

          {/* Academic (single page with internal tab rail) */}
          <Route path="academico"   element={<ModuleGuard moduleKey="academico"><LazyPage><AcademicoPage /></LazyPage></ModuleGuard>} />

          {/* Fase 10 — Portal do Responsavel */}
          <Route path="ocorrencias"   element={<ModuleGuard moduleKey="occurrences"><LazyPage><OcorrenciasPage /></LazyPage></ModuleGuard>} />
          <Route path="autorizacoes"  element={<ModuleGuard moduleKey="activity-auth"><LazyPage><AutorizacoesPage /></LazyPage></ModuleGuard>} />
          <Route path="responsaveis"  element={<ModuleGuard moduleKey="guardian-portal"><LazyPage><ResponsaveisPage /></LazyPage></ModuleGuard>} />

          {/* Fase 10.P — Diario e Provas (leitura admin/coordenador) */}
          <Route path="diario"   element={<ModuleGuard moduleKey="teacher-portal-admin"><LazyPage><DiarioAdminPage /></LazyPage></ModuleGuard>} />
          <Route path="provas"   element={<ModuleGuard moduleKey="teacher-portal-admin"><LazyPage><ProvasAdminPage /></LazyPage></ModuleGuard>} />

          {/* System */}
          <Route path="configuracoes"  element={<ModuleGuard moduleKey="settings"><LazyPage><SettingsPage /></LazyPage></ModuleGuard>} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
