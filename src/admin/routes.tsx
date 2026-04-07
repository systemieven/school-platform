import { Routes, Route } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './AdminLayout';
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import UsersPage from './pages/users/UsersPage';
import SettingsPage from './pages/settings/SettingsPage';
import AppointmentsPage from './pages/appointments/AppointmentsPage';
import EnrollmentsPage from './pages/enrollments/EnrollmentsPage';
import ContactsPage from './pages/contacts/ContactsPage';
import KanbanPage from './pages/leads/KanbanPage';
import ReportsPage from './pages/reports/ReportsPage';

export default function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />

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

          {/* Leads */}
          <Route path="leads/kanban" element={<KanbanPage />} />

          <Route path="relatorios" element={<ReportsPage />} />

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
