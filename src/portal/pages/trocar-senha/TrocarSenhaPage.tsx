import { useStudentAuth } from '../../contexts/StudentAuthContext';
import PortalChangePasswordPage from '../../../shared/components/PortalChangePasswordPage';

export default function TrocarSenhaPage() {
  const { session, loading, signOut, clearMustChangePassword } = useStudentAuth();
  return (
    <PortalChangePasswordPage
      roleLabel="Portal do Aluno"
      redirectTo="/portal"
      loginPath="/portal/login"
      hasSession={!!session}
      loading={loading}
      onPasswordChanged={clearMustChangePassword}
      onSignOut={signOut}
    />
  );
}
