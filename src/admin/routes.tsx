import { Routes, Route } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './AdminLayout';
import LoginPage from './pages/login/LoginPage';
import ForcePasswordChange from './pages/auth/ForcePasswordChange';
import DashboardPage from './pages/dashboard/DashboardPage';
import UsersPage from './pages/users/UsersPage';
import SettingsPage from './pages/settings/SettingsPage';
import AppointmentsPage from './pages/appointments/AppointmentsPage';
import EnrollmentsPage from './pages/enrollments/EnrollmentsPage';
import ContactsPage from './pages/contacts/ContactsPage';
import KanbanPage from './pages/leads/KanbanPage';
import ReportsPage from './pages/reports/ReportsPage';
import SegmentsPage from './pages/school/SegmentsPage';
import StudentsPage from './pages/school/StudentsPage';
import TeacherAreaPage from './pages/teacher/TeacherAreaPage';
import LibraryPage from './pages/library/LibraryPage';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
import EventsPage from './pages/events/EventsPage';
import AttendancePage from './pages/attendance/AttendancePage';
import PermissionsPage from './pages/permissions/PermissionsPage';
import AuditLogsPage from './pages/audit/AuditLogsPage';

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

        {/* All protected admin routes share the AdminLayout */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />

          <Route path="agendamentos" element={<AppointmentsPage />} />
          <Route path="matriculas"   element={<EnrollmentsPage />} />
          <Route path="contatos"     element={<ContactsPage />} />
          <Route path="atendimentos" element={<AttendancePage />} />

          {/* Leads */}
          <Route path="leads/kanban" element={<KanbanPage />} />

          <Route path="relatorios" element={<ReportsPage />} />

          {/* School */}
          <Route path="segmentos" element={<SegmentsPage />} />
          <Route path="alunos"    element={<StudentsPage />} />
          <Route
            path="area-professor"
            element={
              <ProtectedRoute roles={['super_admin', 'admin', 'coordinator', 'teacher']}>
                <TeacherAreaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="biblioteca"
            element={
              <ProtectedRoute roles={['super_admin', 'admin', 'coordinator', 'teacher']}>
                <LibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="comunicados"
            element={
              <ProtectedRoute roles={['super_admin', 'admin', 'coordinator', 'teacher']}>
                <AnnouncementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="eventos"
            element={
              <ProtectedRoute roles={['super_admin', 'admin', 'coordinator', 'teacher']}>
                <EventsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="auditoria"
            element={
              <ProtectedRoute roles={['super_admin', 'admin']}>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="permissoes"
            element={
              <ProtectedRoute roles={['super_admin', 'admin']}>
                <PermissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute roles={['super_admin', 'admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="configuracoes"
            element={
              <ProtectedRoute roles={['super_admin', 'admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
