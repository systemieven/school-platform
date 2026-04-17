import ModuleImportWizard from '../../components/ModuleImportWizard';
import { FINANCIAL_RECEIVABLES_IMPORT_CONFIG } from '../../lib/import-configs/financial-receivables';

export default function FinancialReceivablesImportPage() {
  return <ModuleImportWizard config={FINANCIAL_RECEIVABLES_IMPORT_CONFIG} />;
}
