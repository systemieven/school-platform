import ModuleImportWizard from '../../components/ModuleImportWizard';
import { FINANCIAL_PAYABLES_IMPORT_CONFIG } from '../../lib/import-configs/financial-payables';

export default function FinancialPayablesImportPage() {
  return <ModuleImportWizard config={FINANCIAL_PAYABLES_IMPORT_CONFIG} />;
}
