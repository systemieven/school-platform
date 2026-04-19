import ModuleImportWizard from '../../components/ModuleImportWizard';
import { STAFF_IMPORT_CONFIG } from '../../lib/import-configs/staff';

export default function StaffImportPage() {
  return <ModuleImportWizard config={STAFF_IMPORT_CONFIG} />;
}
