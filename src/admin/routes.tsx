import { Routes, Route } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './AdminLayout';
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import UsersPage from './pages/users/UsersPage';
import SettingsPage from './pages/settings/SettingsPage';

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
          {/* Placeholder routes for future phases */}
          <Route path="agendamentos" element={<PlaceholderPage title="Agendamentos" />} />
          <Route path="matriculas" element={<PlaceholderPage title="Pré-Matrículas" />} />
          <Route path="contatos" element={<PlaceholderPage title="Contatos" />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}

// Temporary placeholder for future modules
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="text-center py-20">
      <h1 className="font-display text-3xl font-bold text-[#003876] mb-3">{title}</h1>
      <p className="text-gray-500">Este módulo será implementado nas próximas fases.</p>
    </div>
  );
}
