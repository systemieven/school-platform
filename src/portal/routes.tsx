import { Routes, Route, Navigate } from 'react-router-dom';
import { StudentAuthProvider } from './contexts/StudentAuthContext';
import PortalLayout from './PortalLayout';
import LoginPage      from './pages/login/LoginPage';
import DashboardPage  from './pages/dashboard/DashboardPage';
import ActivitiesPage from './pages/activities/ActivitiesPage';
import GradesPage     from './pages/grades/GradesPage';
import GradePage      from './pages/grade/GradePage';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage';
import LibraryPage    from './pages/library/LibraryPage';
import EventsPage     from './pages/events/EventsPage';
import FinanceiroPage from './pages/financeiro/FinanceiroPage';
import ProfilePage    from './pages/profile/ProfilePage';
import AchadosPerdidosPage from './pages/achados-perdidos/AchadosPerdidosPage';
import TrocarSenhaPage from './pages/trocar-senha/TrocarSenhaPage';

export default function PortalRoutes() {
  return (
    <StudentAuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="trocar-senha" element={<TrocarSenhaPage />} />

        <Route element={<PortalLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="atividades"  element={<ActivitiesPage />} />
          <Route path="notas"       element={<GradesPage />} />
          <Route path="grade"       element={<GradePage />} />
          <Route path="comunicados" element={<AnnouncementsPage />} />
          <Route path="biblioteca"  element={<LibraryPage />} />
          <Route path="eventos"     element={<EventsPage />} />
          <Route path="financeiro"  element={<FinanceiroPage />} />
          <Route path="perfil"           element={<ProfilePage />} />
          <Route path="achados-perdidos" element={<AchadosPerdidosPage />} />
          <Route path="*"                element={<Navigate to="/portal" replace />} />
        </Route>
      </Routes>
    </StudentAuthProvider>
  );
}
