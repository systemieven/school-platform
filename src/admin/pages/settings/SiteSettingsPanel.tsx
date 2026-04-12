import { Palette, Paintbrush, Navigation, FileEdit } from 'lucide-react';
import AppearanceSettingsPanel from './AppearanceSettingsPanel';
import BrandingSettingsPanel from './BrandingSettingsPanel';
import NavigationSettingsPanel from './NavigationSettingsPanel';
import ContentSettingsPanel from './ContentSettingsPanel';

// ── Sub-tabs (exported for SettingsPage header) ────────────────────────────
export type SiteTab = 'appearance' | 'branding' | 'navigation' | 'content';

export const SITE_SUB_TABS: { key: SiteTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'appearance', label: 'Aparência',  icon: Palette },
  { key: 'branding',   label: 'Marca',      icon: Paintbrush },
  { key: 'navigation', label: 'Navegação',  icon: Navigation },
  { key: 'content',    label: 'Conteúdo',   icon: FileEdit },
];

// ── Panel ───────────────────────────────────────────────────────────────────
interface SiteSettingsPanelProps {
  activeTab: SiteTab;
}

export default function SiteSettingsPanel({ activeTab }: SiteSettingsPanelProps) {
  return (
    <div>
      {activeTab === 'appearance' && <AppearanceSettingsPanel />}
      {activeTab === 'branding' && <BrandingSettingsPanel />}
      {activeTab === 'navigation' && <NavigationSettingsPanel />}
      {activeTab === 'content' && <ContentSettingsPanel />}
    </div>
  );
}
