import { useProfessor } from '../../contexts/ProfessorAuthContext';
import PortalChangePasswordPage from '../../../shared/components/PortalChangePasswordPage';

export default function TrocarSenhaPage() {
  const { session, loading, signOut, clearMustChangePassword } = useProfessor();
  return (
    <PortalChangePasswordPage
      roleLabel="Portal do Professor"
      redirectTo="/professor"
      loginPath="/professor/login"
      hasSession={!!session}
      loading={loading}
      onPasswordChanged={clearMustChangePassword}
      onSignOut={signOut}
    />
  );
}
