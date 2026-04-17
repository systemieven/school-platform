import ModuleImportWizard from '../../components/ModuleImportWizard';
import { SCHOOL_SERIES_IMPORT_CONFIG } from '../../lib/import-configs/school-series';

export default function SchoolSeriesImportPage() {
  return <ModuleImportWizard config={SCHOOL_SERIES_IMPORT_CONFIG} />;
}
