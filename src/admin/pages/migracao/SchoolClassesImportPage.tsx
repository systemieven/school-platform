import ModuleImportWizard from '../../components/ModuleImportWizard';
import { SCHOOL_CLASSES_IMPORT_CONFIG } from '../../lib/import-configs/school-classes';

export default function SchoolClassesImportPage() {
  return <ModuleImportWizard config={SCHOOL_CLASSES_IMPORT_CONFIG} />;
}
