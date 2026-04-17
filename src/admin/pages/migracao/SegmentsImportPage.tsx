import ModuleImportWizard from '../../components/ModuleImportWizard';
import { SEGMENTS_IMPORT_CONFIG } from '../../lib/import-configs/segments';

export default function SegmentsImportPage() {
  return <ModuleImportWizard config={SEGMENTS_IMPORT_CONFIG} />;
}
