import { useGuardian } from '../../contexts/GuardianAuthContext';
import PortalChangePasswordPage from '../../../shared/components/PortalChangePasswordPage';

export default function TrocarSenhaPage() {
  const { session, loading, signOut, clearMustChangePassword } = useGuardian();
  return (
    <PortalChangePasswordPage
      roleLabel="Portal do Responsável"
      redirectTo="/responsavel"
      loginPath="/responsavel/login"
      hasSession={!!session}
      loading={loading}
      onPasswordChanged={clearMustChangePassword}
      onSignOut={signOut}
    />
  );
}
