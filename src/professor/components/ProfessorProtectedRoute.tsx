import { Navigate } from 'react-router-dom';
import { useProfessor } from '../contexts/ProfessorAuthContext';
import { Loader2 } from 'lucide-react';

export default function ProfessorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useProfessor();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 text-brand-primary dark:text-brand-secondary animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/professor/login" replace />;

  return <>{children}</>;
}
