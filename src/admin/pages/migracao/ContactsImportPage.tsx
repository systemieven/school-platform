import ModuleImportWizard from '../../components/ModuleImportWizard';
import { CONTACTS_IMPORT_CONFIG } from '../../lib/import-configs/contacts';

export default function ContactsImportPage() {
  return <ModuleImportWizard config={CONTACTS_IMPORT_CONFIG} />;
}
