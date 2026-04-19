import type { ReactNode } from 'react';
import { Palette, Paintbrush, Navigation, FileEdit, Search, ShieldAlert } from 'lucide-react';
import AppearanceSettingsPanel from './AppearanceSettingsPanel';
import BrandingSettingsPanel from './BrandingSettingsPanel';
import NavigationSettingsPanel from './NavigationSettingsPanel';
import ContentSettingsPanel from './ContentSettingsPanel';
import SEOSettingsPanel from './SEOSettingsPanel';
import MaintenanceSettingsPanel from './MaintenanceSettingsPanel';

// ── Sub-tabs (exported for SettingsPage header) ────────────────────────────
export type SiteTab = 'appearance' | 'branding' | 'navigation' | 'content' | 'seo' | 'manutencao';

export const SITE_SUB_TABS: { key: SiteTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'appearance', label: 'Aparência',   icon: Palette },
  { key: 'branding',   label: 'Marca',       icon: Paintbrush },
  { key: 'navigation', label: 'Navegação',   icon: Navigation },
  { key: 'content',    label: 'Conteúdo',    icon: FileEdit },
  { key: 'seo',        label: 'SEO',         icon: Search },
  { key: 'manutencao', label: 'Manutenção',  icon: ShieldAlert },
];

// ── Panel ───────────────────────────────────────────────────────────────────
interface SiteSettingsPanelProps {
  activeTab: SiteTab;
  /**
   * Slot renderizado no canto direito da primeira linha (barra de tabs de
   * página, quando há) ou no topo do painel. Usado pra alojar os botões
   * "Salvar preset" / "Restaurar preset" que antes ficavam no header.
   */
  headerRight?: ReactNode;
}

export default function SiteSettingsPanel({ activeTab, headerRight }: SiteSettingsPanelProps) {
  // Salvar/Restaurar preset ficam travados no topo em TODAS as sub-abas de Site,
  // imediatamente acima da sub-tab bar interna (ou do primeiro card, quando não há).
  return (
    <div>
      {headerRight && (
        <div className="flex items-center justify-end gap-1 px-6 pt-6">{headerRight}</div>
      )}
      {activeTab === 'appearance' && <AppearanceSettingsPanel />}
      {activeTab === 'branding' && <BrandingSettingsPanel />}
      {activeTab === 'navigation' && <NavigationSettingsPanel />}
      {activeTab === 'content' && <ContentSettingsPanel />}
      {activeTab === 'seo' && <SEOSettingsPanel />}
      {activeTab === 'manutencao' && <MaintenanceSettingsPanel />}
    </div>
  );
}
