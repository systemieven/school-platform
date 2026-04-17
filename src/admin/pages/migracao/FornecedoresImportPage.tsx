import ModuleImportWizard from '../../components/ModuleImportWizard';
import { FORNECEDORES_IMPORT_CONFIG } from '../../lib/import-configs/fornecedores';

export default function FornecedoresImportPage() {
  return <ModuleImportWizard config={FORNECEDORES_IMPORT_CONFIG} />;
}
