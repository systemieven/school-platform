import ModuleImportWizard from '../../components/ModuleImportWizard';
import { USERS_IMPORT_CONFIG } from '../../lib/import-configs/users';

export default function UsersImportPage() {
  return <ModuleImportWizard config={USERS_IMPORT_CONFIG} />;
}
