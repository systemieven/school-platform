import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';
import {
  Save, Loader2, Check, PanelTop, Menu, PanelBottom, MousePointer,
  GripVertical, Trash2,
} from 'lucide-react';
import RoutePicker from '../../components/RoutePicker';
import TopBarIconPicker from '../../components/TopBarIconPicker';
import {
  InputField, SectionLabel, SectionDivider,
  ArrayItemCard, AddButton, RemoveButton, INPUT_CLS,
} from '../../components/FormField';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Types ────────────────────────────────────────────────────────────────────
interface LinkItem {
  label: string;
  route: string;
  /** key opcional do registry em src/shared/topBarIcons.ts (usado so no topbar) */
  icon?: string | null;
}

interface TopBarSettings {
  show_topbar: boolean;
  quick_links: LinkItem[];
}

interface NavbarItem {
  label: string;
  route: string | null;
  children?: LinkItem[];
}

interface NavbarSettings {
  items: NavbarItem[];
}

interface FooterColumn {
  title: string;
  links: LinkItem[];
}

interface FooterSettings {
  copyright_text: string;
  show_cnpj: boolean;
  columns: FooterColumn[];
  legal_links: LinkItem[];
}

interface CtaSettings {
  enrollment_label: string;
  enrollment_route: string;
  enrollment_pulse: boolean;
  hero_primary_label: string;
  hero_primary_route: string;
  hero_secondary_label: string;
  hero_secondary_route: string;
  band_label: string;
  band_route: string;
}

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_TOPBAR: TopBarSettings = {
  show_topbar: true,
  quick_links: [],
};

const DEFAULT_NAVBAR: NavbarSettings = {
  items: [],
};

const DEFAULT_FOOTER: FooterSettings = {
  copyright_text: '',
  show_cnpj: true,
  columns: [],
  legal_links: [],
};

const DEFAULT_CTA: CtaSettings = {
  enrollment_label: '',
  enrollment_route: '',
  enrollment_pulse: false,
  hero_primary_label: '',
  hero_primary_route: '',
  hero_secondary_label: '',
  hero_secondary_route: '',
  band_label: '',
  band_route: '',
};

// ── SortableQuickLink ─────────────────────────────────────────────────────────
interface SortableQuickLinkProps {
  id: string;
  index: number;
  link: LinkItem;
  onRemove: () => void;
  onChangeLabel: (v: string) => void;
  onChangeRoute: (v: string) => void;
  onChangeIcon: (v: string | null) => void;
}

function SortableQuickLink({ id, index, link, onRemove, onChangeLabel, onChangeRoute, onChangeIcon }: SortableQuickLinkProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-10 opacity-80' : ''}>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/30 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700/40">
          <button
            type="button"
            className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
            title="Arrastar para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-brand-primary/10 text-brand-primary text-[10px] font-bold">
            {index}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
            title="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InputField
              label="Label"
              value={link.label}
              placeholder="Ex: Fale Conosco"
              onChange={(e) => onChangeLabel(e.target.value)}
            />
            <RoutePicker
              label="Rota"
              value={link.route}
              onChange={onChangeRoute}
            />
            <TopBarIconPicker
              label="Icone (opcional)"
              value={link.icon ?? null}
              onChange={onChangeIcon}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────
export default function NavigationSettingsPanel() {
  const [topbar, setTopbar] = useState<TopBarSettings>(DEFAULT_TOPBAR);
  const [navbar, setNavbar] = useState<NavbarSettings>(DEFAULT_NAVBAR);
  const [footer, setFooter] = useState<FooterSettings>(DEFAULT_FOOTER);
  const [cta, setCta] = useState<CtaSettings>(DEFAULT_CTA);

  const [originalTopbar, setOriginalTopbar] = useState<TopBarSettings>(DEFAULT_TOPBAR);
  const [originalNavbar, setOriginalNavbar] = useState<NavbarSettings>(DEFAULT_NAVBAR);
  const [originalFooter, setOriginalFooter] = useState<FooterSettings>(DEFAULT_FOOTER);
  const [originalCta, setOriginalCta] = useState<CtaSettings>(DEFAULT_CTA);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleQuickLinkDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTopbar((p) => ({
      ...p,
      quick_links: arrayMove(p.quick_links, Number(active.id), Number(over.id)),
    }));
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'navigation')
      .then(({ data }) => {
        if (data) {
          for (const row of data) {
            const val = row.value as Record<string, unknown>;
            if (row.key === 'topbar') {
              const loaded = { ...DEFAULT_TOPBAR, ...val } as TopBarSettings;
              setTopbar(loaded);
              setOriginalTopbar(loaded);
            } else if (row.key === 'navbar') {
              const loaded = { ...DEFAULT_NAVBAR, ...val } as NavbarSettings;
              setNavbar(loaded);
              setOriginalNavbar(loaded);
            } else if (row.key === 'footer') {
              const loaded = { ...DEFAULT_FOOTER, ...val } as FooterSettings;
              setFooter(loaded);
              setOriginalFooter(loaded);
            } else if (row.key === 'cta') {
              const loaded = { ...DEFAULT_CTA, ...val } as CtaSettings;
              setCta(loaded);
              setOriginalCta(loaded);
            }
          }
        }
        setLoading(false);
      });
  }, []);

  // ── Change detection ───────────────────────────────────────────────────────
  const hasChanges =
    JSON.stringify(topbar) !== JSON.stringify(originalTopbar) ||
    JSON.stringify(navbar) !== JSON.stringify(originalNavbar) ||
    JSON.stringify(footer) !== JSON.stringify(originalFooter) ||
    JSON.stringify(cta) !== JSON.stringify(originalCta);

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);

    const upserts = [
      { category: 'navigation', key: 'topbar', value: topbar as unknown as Record<string, unknown> },
      { category: 'navigation', key: 'navbar', value: navbar as unknown as Record<string, unknown> },
      { category: 'navigation', key: 'footer', value: footer as unknown as Record<string, unknown> },
      { category: 'navigation', key: 'cta', value: cta as unknown as Record<string, unknown> },
    ];

    const { error } = await supabase
      .from('system_settings')
      .upsert(upserts, { onConflict: 'category,key' });

    setSaving(false);

    if (!error) {
      setOriginalTopbar(topbar);
      setOriginalNavbar(navbar);
      setOriginalFooter(footer);
      setOriginalCta(cta);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);

      logAudit({
        action: 'update',
        module: 'navigation_settings',
        description: 'Configuracoes de navegacao atualizadas',
      });
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* ═══════════════════════════════════ Barra Superior (TopBar) */}
      <SettingsCard collapseId="nav-topbar" title="Barra Superior (TopBar)" icon={PanelTop}>
        {/* show_topbar */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">Exibir barra superior</span>
          <Toggle
            checked={topbar.show_topbar}
            onChange={(v) => setTopbar((p) => ({ ...p, show_topbar: v }))}
          />
        </div>

        <SectionDivider />

        {/* Quick links */}
        <div>
          <SectionLabel>Links Rápidos</SectionLabel>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleQuickLinkDragEnd}>
            <SortableContext
              items={topbar.quick_links.map((_, i) => String(i))}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3 mt-3">
                {topbar.quick_links.map((link, i) => (
                  <SortableQuickLink
                    key={i}
                    id={String(i)}
                    index={i + 1}
                    link={link}
                    onRemove={() => {
                      const updated = topbar.quick_links.filter((_, idx) => idx !== i);
                      setTopbar((p) => ({ ...p, quick_links: updated }));
                    }}
                    onChangeLabel={(v) => {
                      const updated = [...topbar.quick_links];
                      updated[i] = { ...updated[i], label: v };
                      setTopbar((p) => ({ ...p, quick_links: updated }));
                    }}
                    onChangeRoute={(v) => {
                      const updated = [...topbar.quick_links];
                      updated[i] = { ...updated[i], route: v };
                      setTopbar((p) => ({ ...p, quick_links: updated }));
                    }}
                    onChangeIcon={(v) => {
                      const updated = [...topbar.quick_links];
                      updated[i] = { ...updated[i], icon: v };
                      setTopbar((p) => ({ ...p, quick_links: updated }));
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="mt-3">
            <AddButton label="Adicionar link" onClick={() => {
              setTopbar((p) => ({ ...p, quick_links: [...p.quick_links, { label: '', route: '' }] }));
            }} />
          </div>
        </div>

        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">Redes sociais e WhatsApp são configurados em Dados Institucionais.</p>
      </SettingsCard>

      {/* ═══════════════════════════════════ Menu Principal (Navbar) */}
      <SettingsCard collapseId="nav-navbar" title="Menu Principal (Navbar)" icon={Menu}
        description="Logos são configurados em Marca e Identidade">
        <div>
          <SectionLabel>Itens do Menu</SectionLabel>
          <div className="space-y-3 mt-3">
            {navbar.items.map((item, i) => (
              <ArrayItemCard key={i} index={i + 1} onRemove={() => {
                const updated = navbar.items.filter((_, idx) => idx !== i);
                setNavbar((p) => ({ ...p, items: updated }));
              }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Label"
                    value={item.label}
                    placeholder="Ex: Sobre"
                    onChange={(e) => {
                      const updated = [...navbar.items];
                      updated[i] = { ...updated[i], label: e.target.value };
                      setNavbar((p) => ({ ...p, items: updated }));
                    }}
                  />
                  <RoutePicker
                    label="Rota"
                    value={item.route ?? ''}
                    allowNull
                    onChange={(v) => {
                      const updated = [...navbar.items];
                      updated[i] = { ...updated[i], route: v || null };
                      setNavbar((p) => ({ ...p, items: updated }));
                    }}
                  />
                </div>

                {/* Children (sub-items) */}
                {item.children && item.children.length > 0 && (
                  <div className="ml-4 space-y-2 border-l-2 border-gray-100 dark:border-gray-700/40 pl-3">
                    {item.children.map((child, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            className={INPUT_CLS}
                            placeholder="Label"
                            value={child.label}
                            onChange={(e) => {
                              const updated = [...navbar.items];
                              const children = [...(updated[i].children ?? [])];
                              children[j] = { ...children[j], label: e.target.value };
                              updated[i] = { ...updated[i], children };
                              setNavbar((p) => ({ ...p, items: updated }));
                            }}
                          />
                          <RoutePicker
                            value={child.route}
                            onChange={(v) => {
                              const updated = [...navbar.items];
                              const children = [...(updated[i].children ?? [])];
                              children[j] = { ...children[j], route: v };
                              updated[i] = { ...updated[i], children };
                              setNavbar((p) => ({ ...p, items: updated }));
                            }}
                          />
                        </div>
                        <RemoveButton onClick={() => {
                          const updated = [...navbar.items];
                          const children = (updated[i].children ?? []).filter((_, idx) => idx !== j);
                          updated[i] = { ...updated[i], children: children.length > 0 ? children : undefined };
                          setNavbar((p) => ({ ...p, items: updated }));
                        }} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="ml-4">
                  <AddButton label="Adicionar sub-item" onClick={() => {
                    const updated = [...navbar.items];
                    const children = [...(updated[i].children ?? []), { label: '', route: '' }];
                    updated[i] = { ...updated[i], children };
                    setNavbar((p) => ({ ...p, items: updated }));
                  }} />
                </div>
              </ArrayItemCard>
            ))}
          </div>
          <div className="mt-3">
            <AddButton label="Adicionar item" onClick={() => {
              setNavbar((p) => ({ ...p, items: [...p.items, { label: '', route: '' }] }));
            }} />
          </div>
        </div>
      </SettingsCard>

      {/* ═══════════════════════════════════ Rodapé (Footer) */}
      <SettingsCard collapseId="nav-footer" title="Rodapé (Footer)" icon={PanelBottom}>
        {/* Copyright & CNPJ */}
        <div className="space-y-3">
          <InputField
            label="Texto de copyright"
            value={footer.copyright_text}
            placeholder="Todos os direitos reservados."
            onChange={(e) => setFooter((p) => ({ ...p, copyright_text: e.target.value }))}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Exibir CNPJ no rodapé</span>
            <Toggle
              checked={footer.show_cnpj}
              onChange={(v) => setFooter((p) => ({ ...p, show_cnpj: v }))}
            />
          </div>
        </div>

        <SectionDivider />

        {/* Columns */}
        <div>
          <SectionLabel>Colunas</SectionLabel>
          <div className="space-y-4 mt-3">
            {footer.columns.map((col, ci) => (
              <ArrayItemCard key={ci} index={ci + 1} onRemove={() => {
                const updated = footer.columns.filter((_, idx) => idx !== ci);
                setFooter((p) => ({ ...p, columns: updated }));
              }}>
                <InputField
                  label="Título da coluna"
                  value={col.title}
                  placeholder="Ex: Institucional"
                  onChange={(e) => {
                    const updated = [...footer.columns];
                    updated[ci] = { ...updated[ci], title: e.target.value };
                    setFooter((p) => ({ ...p, columns: updated }));
                  }}
                />

                {/* Column links */}
                <div className="ml-3 space-y-2 border-l-2 border-gray-100 dark:border-gray-700/40 pl-3">
                  {col.links.map((link, li) => (
                    <div key={li} className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          className={INPUT_CLS}
                          placeholder="Label"
                          value={link.label}
                          onChange={(e) => {
                            const updated = [...footer.columns];
                            const links = [...updated[ci].links];
                            links[li] = { ...links[li], label: e.target.value };
                            updated[ci] = { ...updated[ci], links };
                            setFooter((p) => ({ ...p, columns: updated }));
                          }}
                        />
                        <RoutePicker
                          value={link.route}
                          onChange={(v) => {
                            const updated = [...footer.columns];
                            const links = [...updated[ci].links];
                            links[li] = { ...links[li], route: v };
                            updated[ci] = { ...updated[ci], links };
                            setFooter((p) => ({ ...p, columns: updated }));
                          }}
                        />
                      </div>
                      <RemoveButton onClick={() => {
                        const updated = [...footer.columns];
                        const links = updated[ci].links.filter((_, idx) => idx !== li);
                        updated[ci] = { ...updated[ci], links };
                        setFooter((p) => ({ ...p, columns: updated }));
                      }} />
                    </div>
                  ))}
                  <AddButton label="Adicionar link" onClick={() => {
                    const updated = [...footer.columns];
                    updated[ci] = { ...updated[ci], links: [...updated[ci].links, { label: '', route: '' }] };
                    setFooter((p) => ({ ...p, columns: updated }));
                  }} />
                </div>
              </ArrayItemCard>
            ))}
          </div>
          <div className="mt-3">
            <AddButton label="Adicionar coluna" onClick={() => {
              setFooter((p) => ({ ...p, columns: [...p.columns, { title: '', links: [] }] }));
            }} />
          </div>
        </div>

        <SectionDivider />

        {/* Legal links */}
        <div>
          <SectionLabel>Links Legais</SectionLabel>
          <div className="space-y-3 mt-3">
            {footer.legal_links.map((link, i) => (
              <ArrayItemCard key={i} index={i + 1} onRemove={() => {
                const updated = footer.legal_links.filter((_, idx) => idx !== i);
                setFooter((p) => ({ ...p, legal_links: updated }));
              }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Label"
                    value={link.label}
                    placeholder="Ex: Política de Privacidade"
                    onChange={(e) => {
                      const updated = [...footer.legal_links];
                      updated[i] = { ...updated[i], label: e.target.value };
                      setFooter((p) => ({ ...p, legal_links: updated }));
                    }}
                  />
                  <RoutePicker
                    label="Rota"
                    value={link.route}
                    onChange={(v) => {
                      const updated = [...footer.legal_links];
                      updated[i] = { ...updated[i], route: v };
                      setFooter((p) => ({ ...p, legal_links: updated }));
                    }}
                  />
                </div>
              </ArrayItemCard>
            ))}
          </div>
          <div className="mt-3">
            <AddButton label="Adicionar link legal" onClick={() => {
              setFooter((p) => ({ ...p, legal_links: [...p.legal_links, { label: '', route: '' }] }));
            }} />
          </div>
        </div>
      </SettingsCard>

      {/* ═══════════════════════════════════ CTAs */}
      <SettingsCard collapseId="navigation-cta" title="CTAs" icon={MousePointer}
        description="Botões de ação exibidos na navbar, hero e faixa promocional do site.">

        <SectionLabel>Matrícula</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Label"
            value={cta.enrollment_label}
            onChange={(e) => setCta((s) => ({ ...s, enrollment_label: e.target.value }))}
            placeholder="Ex: Matricule-se"
          />
          <RoutePicker
            label="Rota"
            value={cta.enrollment_route}
            onChange={(v) => setCta((s) => ({ ...s, enrollment_route: v }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">Efeito pulse</span>
          <Toggle
            checked={cta.enrollment_pulse}
            onChange={(v) => setCta((s) => ({ ...s, enrollment_pulse: v }))}
          />
        </div>

        <SectionDivider />

        <SectionLabel>Hero</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Botão primário — label"
            value={cta.hero_primary_label}
            onChange={(e) => setCta((s) => ({ ...s, hero_primary_label: e.target.value }))}
            placeholder="Ex: Agendar Visita"
          />
          <RoutePicker
            label="Botão primário — rota"
            value={cta.hero_primary_route}
            onChange={(v) => setCta((s) => ({ ...s, hero_primary_route: v }))}
          />
          <InputField
            label="Botão secundário — label"
            value={cta.hero_secondary_label}
            onChange={(e) => setCta((s) => ({ ...s, hero_secondary_label: e.target.value }))}
            placeholder="Ex: Conhecer mais"
          />
          <RoutePicker
            label="Botão secundário — rota"
            value={cta.hero_secondary_route}
            onChange={(v) => setCta((s) => ({ ...s, hero_secondary_route: v }))}
          />
        </div>

        <SectionDivider />

        <SectionLabel>Faixa (Band)</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Label"
            value={cta.band_label}
            onChange={(e) => setCta((s) => ({ ...s, band_label: e.target.value }))}
            placeholder="Ex: Garanta sua vaga"
          />
          <RoutePicker
            label="Rota"
            value={cta.band_route}
            onChange={(v) => setCta((s) => ({ ...s, band_route: v }))}
          />
        </div>
      </SettingsCard>

      {/* ═══════════════════════════════════ Floating save */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
