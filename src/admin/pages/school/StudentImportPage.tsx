import ModuleImportWizard from '../../components/ModuleImportWizard';
import { STUDENT_IMPORT_CONFIG } from '../../lib/import-configs/students';

export default function StudentImportPage() {
  return <ModuleImportWizard config={STUDENT_IMPORT_CONFIG} />;
}
