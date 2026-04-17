import ModuleImportWizard from '../../components/ModuleImportWizard';
import { FINANCIAL_CASH_IMPORT_CONFIG } from '../../lib/import-configs/financial-cash';

export default function FinancialCashImportPage() {
  return <ModuleImportWizard config={FINANCIAL_CASH_IMPORT_CONFIG} />;
}
