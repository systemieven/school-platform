import { Navigate, useLocation } from 'react-router-dom';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { Loader2 } from 'lucide-react';

export default function StudentProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, mustChangePassword } = useStudentAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 text-brand-primary dark:text-brand-secondary animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/portal/login" replace />;

  // Gate de troca obrigatória — bloqueia tudo até completar; a própria
  // página /portal/trocar-senha é roteada FORA do PortalLayout, então não
  // entra neste guard. O check de pathname é defensivo para o caso de
  // alguém aninhar a rota dentro do layout no futuro.
  if (mustChangePassword && !location.pathname.endsWith('/trocar-senha')) {
    return <Navigate to="/portal/trocar-senha" replace />;
  }

  return <>{children}</>;
}
