import ModuleImportWizard from '../../components/ModuleImportWizard';
import { STORE_PRODUCTS_IMPORT_CONFIG } from '../../lib/import-configs/store-products';

export default function StoreProductsImportPage() {
  return <ModuleImportWizard config={STORE_PRODUCTS_IMPORT_CONFIG} />;
}
