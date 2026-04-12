import { Palette, Paintbrush, Navigation, FileEdit, Search } from 'lucide-react';
import AppearanceSettingsPanel from './AppearanceSettingsPanel';
import BrandingSettingsPanel from './BrandingSettingsPanel';
import NavigationSettingsPanel from './NavigationSettingsPanel';
import ContentSettingsPanel from './ContentSettingsPanel';
import SEOSettingsPanel from './SEOSettingsPanel';

// ── Sub-tabs (exported for SettingsPage header) ────────────────────────────
export type SiteTab = 'appearance' | 'branding' | 'navigation' | 'content' | 'seo';

export const SITE_SUB_TABS: { key: SiteTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'appearance', label: 'Aparência',  icon: Palette },
  { key: 'branding',   label: 'Marca',      icon: Paintbrush },
  { key: 'navigation', label: 'Navegação',  icon: Navigation },
  { key: 'content',    label: 'Conteúdo',   icon: FileEdit },
  { key: 'seo',        label: 'SEO',        icon: Search },
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
      {activeTab === 'seo' && <SEOSettingsPanel />}
    </div>
  );
}
