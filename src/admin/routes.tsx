import { Routes, Route } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ModuleGuard from './components/ModuleGuard';
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
import AttendanceHistoryPage from './pages/attendance/AttendanceHistoryPage';
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

        {/* All protected admin routes share the AdminLayout (which provides PermissionsProvider) */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ModuleGuard moduleKey="dashboard"><DashboardPage /></ModuleGuard>} />

          <Route path="agendamentos" element={<ModuleGuard moduleKey="appointments"><AppointmentsPage /></ModuleGuard>} />
          <Route path="matriculas"   element={<ModuleGuard moduleKey="enrollments"><EnrollmentsPage /></ModuleGuard>} />
          <Route path="contatos"     element={<ModuleGuard moduleKey="contacts"><ContactsPage /></ModuleGuard>} />
          <Route path="atendimentos" element={<ModuleGuard moduleKey="attendance"><AttendancePage /></ModuleGuard>} />
          <Route path="historico-atendimentos" element={<ModuleGuard moduleKey="attendance"><AttendanceHistoryPage /></ModuleGuard>} />

          <Route path="leads/kanban" element={<ModuleGuard moduleKey="kanban"><KanbanPage /></ModuleGuard>} />
          <Route path="relatorios"   element={<ModuleGuard moduleKey="reports"><ReportsPage /></ModuleGuard>} />

          {/* School */}
          <Route path="segmentos"      element={<ModuleGuard moduleKey="segments"><SegmentsPage /></ModuleGuard>} />
          <Route path="alunos"         element={<ModuleGuard moduleKey="students"><StudentsPage /></ModuleGuard>} />
          <Route path="area-professor" element={<ModuleGuard moduleKey="teacher-area"><TeacherAreaPage /></ModuleGuard>} />
          <Route path="biblioteca"     element={<ModuleGuard moduleKey="library"><LibraryPage /></ModuleGuard>} />
          <Route path="comunicados"    element={<ModuleGuard moduleKey="announcements"><AnnouncementsPage /></ModuleGuard>} />
          <Route path="eventos"        element={<ModuleGuard moduleKey="events"><EventsPage /></ModuleGuard>} />

          {/* System */}
          <Route path="auditoria"      element={<ModuleGuard moduleKey="audit"><AuditLogsPage /></ModuleGuard>} />
          <Route path="permissoes"     element={<ModuleGuard moduleKey="permissions"><PermissionsPage /></ModuleGuard>} />
          <Route path="usuarios"       element={<ModuleGuard moduleKey="users"><UsersPage /></ModuleGuard>} />
          <Route path="configuracoes"  element={<ModuleGuard moduleKey="settings"><SettingsPage /></ModuleGuard>} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
