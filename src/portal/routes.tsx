import { Routes, Route, Navigate } from 'react-router-dom';
import { StudentAuthProvider } from './contexts/StudentAuthContext';
import PortalLayout from './PortalLayout';
import LoginPage      from './pages/login/LoginPage';
import DashboardPage  from './pages/dashboard/DashboardPage';
import ActivitiesPage from './pages/activities/ActivitiesPage';
import GradesPage     from './pages/grades/GradesPage';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
import LibraryPage    from './pages/library/LibraryPage';
import ProfilePage    from './pages/profile/ProfilePage';

export default function PortalRoutes() {
  return (
    <StudentAuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />

        <Route element={<PortalLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="atividades"  element={<ActivitiesPage />} />
          <Route path="notas"       element={<GradesPage />} />
          <Route path="comunicados" element={<AnnouncementsPage />} />
          <Route path="biblioteca"  element={<LibraryPage />} />
          <Route path="perfil"      element={<ProfilePage />} />
          <Route path="*"           element={<Navigate to="/portal" replace />} />
        </Route>
      </Routes>
    </StudentAuthProvider>
  );
}
