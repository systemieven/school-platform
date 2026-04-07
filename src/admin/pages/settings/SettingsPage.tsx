import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { getProviders, setDefaultProvider } from '../../lib/whatsapp-api';
import type { WhatsAppProvider } from '../../lib/whatsapp-api';
import { useWhatsAppStatus } from '../../contexts/WhatsAppStatusContext';
import WhatsAppProviderDrawer from '../../components/WhatsAppProviderDrawer';
import TemplatesPage from '../whatsapp/TemplatesPage';
import MessageLogPage from '../whatsapp/MessageLogPage';
import type { SystemSetting } from '../../types/admin.types';
import {
  Settings, Save, Loader2, Check, Building2, MessageCircle,
  CalendarCheck, GraduationCap, MessageSquare, Bell, Palette,
  Eye, EyeOff, AlertCircle, Wifi, WifiOff,
  PanelLeftClose, PanelLeftOpen, Plus, Star, Pencil,
  LayoutTemplate, Send,
} from 'lucide-react';

// ── Tab definitions ──────────────────────────────────────────────────────────
interface TabDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  categories: string[];
  description: string;
}

const TABS: TabDef[] = [
  {
    key: 'institutional',
    label: 'Dados Institucionais',
    shortLabel: 'Institucional',
    icon: Building2,
    categories: ['general'],
    description: 'Informações principais da escola exibidas no site e documentos.',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: 'WhatsApp',
    icon: MessageCircle,
    categories: ['whatsapp'],
    description: 'Conexão com a API WhatsApp para envio de mensagens automáticas.',
  },
  {
    key: 'visits',
    label: 'Agendamento de Visitas',
    shortLabel: 'Visitas',
    icon: CalendarCheck,
    categories: ['visit'],
    description: 'Configure motivos, horários e regras para agendamento de visitas.',
  },
  {
    key: 'enrollment',
    label: 'Pré-Matrícula',
    shortLabel: 'Matrícula',
    icon: GraduationCap,
    categories: ['enrollment'],
    description: 'Defina campos obrigatórios, documentos exigidos e regras do formulário.',
  },
  {
    key: 'contact',
    label: 'Formulário de Contato',
    shortLabel: 'Contato',
    icon: MessageSquare,
    categories: ['contact'],
    description: 'Gerencie motivos de contato, campos obrigatórios e qualificação de leads.',
  },
  {
    key: 'notifications',
    label: 'Notificações',
    shortLabel: 'Notificações',
    icon: Bell,
    categories: ['notifications'],
    description: 'Configure alertas automáticos e templates de comunicação.',
  },
  {
    key: 'appearance',
    label: 'Aparência',
    shortLabel: 'Aparência',
    icon: Palette,
    categories: ['appearance'],
    description: 'Personalize textos do site, banners e elementos visuais.',
  },
];

// ── Field metadata ───────────────────────────────────────────────────────────
const KEY_META: Record<string, { label: string; placeholder?: string; secret?: boolean; multiline?: boolean }> = {
  // general
  school_name:    { label: 'Nome da Escola', placeholder: 'Ex: Colégio Batista em Caruaru' },
  cnpj:           { label: 'CNPJ', placeholder: '00.000.000/0000-00' },
  address:        { label: 'Endereço', placeholder: 'Rua, número, bairro, cidade/UF' },
  phone:          { label: 'Telefone', placeholder: '(00) 0000-0000' },
  whatsapp:       { label: 'WhatsApp', placeholder: '(00) 00000-0000' },
  email:          { label: 'E-mail', placeholder: 'contato@escola.com.br' },
  logo_url:       { label: 'URL do Logo', placeholder: 'https://...' },
  // whatsapp — rendered exclusively by WhatsAppConnectionPanel, but kept for fallback
  instance_url:   { label: 'URL da Instância', placeholder: 'https://sua-instancia.exemplo.com' },
  api_token:      { label: 'Token da API', placeholder: '••••••••', secret: true },
  connected:      { label: 'Status de Conexão', placeholder: 'true / false' },
  webhook_secret: { label: 'Chave Secreta do Webhook', placeholder: '(gerado automaticamente)', secret: true },
  webhook_url:    { label: 'URL do Webhook Registrado', placeholder: '(preenchido após registro)' },
  // enrollment
  min_age:        { label: 'Idade Mínima', placeholder: '2' },
  require_parents_data: { label: 'Exigir Dados dos Pais', placeholder: 'true / false' },
  require_documents:    { label: 'Exigir Documentos', placeholder: 'true / false' },
  required_docs_list:   { label: 'Lista de Documentos Obrigatórios', placeholder: '["RG", "CPF", ...]', multiline: true },
  // contact
  required_fields:  { label: 'Campos Obrigatórios', placeholder: '["nome", "celular"]', multiline: true },
  contact_reasons:  { label: 'Motivos de Contato', placeholder: '[{ "label": "...", "icon": "..." }]', multiline: true },
  // visit
  reasons:          { label: 'Motivos de Visita', placeholder: '[{ "key": "...", "label": "..." }]', multiline: true },
  blocked_weekdays: { label: 'Dias Bloqueados (0=Dom)', placeholder: '[0, 6]' },
  lunch_start:      { label: 'Início do Almoço', placeholder: '12:00' },
  lunch_end:        { label: 'Fim do Almoço', placeholder: '13:30' },
  // notifications
  admin_email_alerts:     { label: 'Alertas por E-mail (Admin)', placeholder: 'true / false' },
  auto_notify_on_contact: { label: 'Notificar ao Receber Contato', placeholder: 'true / false' },
  auto_notify_on_visit:   { label: 'Notificar ao Receber Agendamento', placeholder: 'true / false' },
  // appearance
  hero_title:              { label: 'Título do Hero', placeholder: 'Educação que Transforma Vidas' },
  hero_subtitle:           { label: 'Subtítulo do Hero', placeholder: 'Há mais de 20 anos...' },
  enrollment_banner_active:{ label: 'Banner de Matrículas Ativo', placeholder: 'true / false' },
  enrollment_banner_text:  { label: 'Texto do Banner', placeholder: 'Matrículas 2026 abertas' },
};

const TABS_STORAGE_KEY = 'settings_tabs_collapsed';

// ── Component ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [tabsCollapsed, setTabsCollapsed] = useState(() => {
    try { return localStorage.getItem(TABS_STORAGE_KEY) === 'true'; } catch { return false; }
  });

  const toggleTabs = () => {
    setTabsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(TABS_STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('category')
      .order('key');

    if (!error && data) {
      const s = data as SystemSetting[];
      setSettings(s);
      const values: Record<string, string> = {};
      s.forEach((item) => {
        values[item.id] = typeof item.value === 'string' ? item.value : JSON.stringify(item.value, null, 2);
      });
      setEditValues(values);
    }
    setLoading(false);
  }

  const toStr = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));

  // Current tab info
  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];
  const tabSettings = useMemo(
    () => settings.filter((s) => currentTab.categories.includes(s.category)),
    [settings, currentTab],
  );
  const tabHasChanges = tabSettings.some((s) => editValues[s.id] !== toStr(s.value));

  // Count changes per tab for badges
  const changeCountByTab = useMemo(() => {
    const counts: Record<string, number> = {};
    TABS.forEach((tab) => {
      counts[tab.key] = settings
        .filter((s) => tab.categories.includes(s.category))
        .filter((s) => editValues[s.id] !== toStr(s.value))
        .length;
    });
    return counts;
  }, [settings, editValues]);

  const totalChanges = Object.values(changeCountByTab).reduce((a, b) => a + b, 0);

  async function handleSave() {
    setSaving(true);
    const updates = tabSettings
      .filter((s) => editValues[s.id] !== toStr(s.value))
      .map((s) =>
        supabase
          .from('system_settings')
          .update({ value: editValues[s.id] })
          .eq('id', s.id),
      );

    if (updates.length > 0) {
      await Promise.all(updates);
      await fetchSettings();
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // Tabs that have settings in the DB
  const availableTabs = TABS.filter(
    (tab) => settings.some((s) => tab.categories.includes(s.category)),
  );

  // Tabs without settings yet (show as "coming soon")
  const emptyTabs = TABS.filter(
    (tab) => !settings.some((s) => tab.categories.includes(s.category)),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
      </div>
    );
  }

  // ── WhatsApp connection test panel ────────────────────────────────────────

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <Settings className="w-8 h-8" />
            Configurações
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gerencie as configurações do sistema por módulo.
          </p>
        </div>

        {/* Unsaved changes indicator */}
        {totalChanges > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2">
            <AlertCircle className="w-4 h-4" />
            <span>
              {totalChanges} {totalChanges === 1 ? 'alteração não salva' : 'alterações não salvas'}
            </span>
          </div>
        )}
      </div>

      {/* ── Tabs + Content layout ── */}
      <div className="flex gap-4">

        {/* ── Tab rail ── */}
        <nav
          className={`flex-shrink-0 transition-all duration-300 ${
            tabsCollapsed ? 'w-[52px]' : 'w-52'
          }`}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-20">
            {/* Collapse toggle */}
            <button
              onClick={toggleTabs}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700"
              title={tabsCollapsed ? 'Expandir abas' : 'Recolher abas'}
            >
              {tabsCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 mx-auto" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span className="text-xs font-medium">Recolher</span>
                </>
              )}
            </button>

            {/* Tab items */}
            <div className="p-1.5 space-y-0.5">
              {[...availableTabs, ...emptyTabs].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;
                const isEmpty = emptyTabs.includes(tab);
                const changes = changeCountByTab[tab.key] || 0;

                return (
                  <button
                    key={tab.key}
                    onClick={() => !isEmpty && setActiveTab(tab.key)}
                    disabled={isEmpty}
                    title={tabsCollapsed ? tab.label : undefined}
                    className={`
                      relative w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200
                      ${tabsCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5'}
                      ${isActive
                        ? 'bg-[#003876] text-white shadow-md shadow-[#003876]/15'
                        : isEmpty
                          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#003876] dark:hover:text-white'
                      }
                    `}
                  >
                    <TabIcon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#ffd700]' : ''}`} />

                    {!tabsCollapsed && (
                      <>
                        <span className="truncate text-left flex-1 text-[13px]">{tab.shortLabel}</span>
                        {changes > 0 && !isActive && (
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0" />
                        )}
                        {isEmpty && (
                          <span className="text-[9px] tracking-wide uppercase opacity-50">Breve</span>
                        )}
                      </>
                    )}

                    {/* Collapsed: change dot */}
                    {tabsCollapsed && changes > 0 && !isActive && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* ── Tab content ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Tab title bar */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-[#003876]/10 dark:bg-[#003876]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <currentTab.icon className="w-[18px] h-[18px] text-[#003876] dark:text-[#ffd700]" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-[#003876] dark:text-white truncate">
                    {currentTab.label}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 truncate hidden sm:block">{currentTab.description}</p>
                </div>
              </div>

              {/* Save button — hidden for the whatsapp tab (the panel has its own saves) */}
              {activeTab !== 'whatsapp' && (
                <button
                  onClick={handleSave}
                  disabled={!tabHasChanges || saving}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                    transition-all duration-300 flex-shrink-0
                    ${saved
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : tabHasChanges
                        ? 'bg-[#003876] text-white hover:bg-[#002855] hover:shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
                  </span>
                </button>
              )}
            </div>

            {/* Fields */}
            <div className={activeTab === 'whatsapp' ? '' : 'p-6'}>
              {/* WhatsApp tab: sub-tabbed panel */}
              {activeTab === 'whatsapp' ? (
                <WhatsAppSettingsPanel />
              ) : tabSettings.length === 0 ? (
                <EmptyTabState tab={currentTab} />
              ) : (
                <div className="space-y-6">
                  {tabSettings.map((item) => {
                    const meta = KEY_META[item.key] || { label: item.key };
                    const isChanged = editValues[item.id] !== toStr(item.value);

                    return (
                      <SettingField
                        key={item.id}
                        item={item}
                        meta={meta}
                        value={editValues[item.id] || ''}
                        isChanged={isChanged}
                        onChange={(val) =>
                          setEditValues((prev) => ({ ...prev, [item.id]: val }))
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── WhatsApp Settings Panel (sub-tabbed) ─────────────────────────────────────

type WaSubTab = 'apis' | 'templates' | 'historico';

const WA_SUB_TABS: { key: WaSubTab; label: string; icon: React.ElementType }[] = [
  { key: 'apis',      label: 'APIs',      icon: Wifi          },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'historico', label: 'Histórico', icon: Send           },
];

function WhatsAppSettingsPanel() {
  const [sub, setSub] = useState<WaSubTab>('apis');

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex border-b border-gray-100 dark:border-gray-700 px-6">
        {WA_SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              sub === key
                ? 'border-[#003876] dark:border-[#ffd700] text-[#003876] dark:text-[#ffd700]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="p-6">
        {sub === 'apis'      && <WhatsAppProvidersPanel />}
        {sub === 'templates' && <TemplatesPage embedded />}
        {sub === 'historico' && <MessageLogPage embedded />}
      </div>
    </div>
  );
}

// ── WhatsApp Providers Panel ──────────────────────────────────────────────────
function WhatsAppProvidersPanel() {
  const { state: waState, instanceData, refresh: refreshWa } = useWhatsAppStatus();
  const waPhone = instanceData?.phone || '';
  const [providers,      setProviders]      = useState<WhatsAppProvider[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [editingProvider,setEditingProvider]= useState<WhatsAppProvider | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  const fetchProviders = async () => {
    setLoading(true);
    const { data } = await getProviders();
    setProviders(data);
    setLoading(false);
  };

  useEffect(() => { fetchProviders(); }, []);

  const handleEdit = (p: WhatsAppProvider) => { setEditingProvider(p); setDrawerOpen(true); };
  const handleAddNew = ()                    => { setEditingProvider(null); setDrawerOpen(true); };
  const handleDrawerClose = ()               => { setDrawerOpen(false); setEditingProvider(null); };

  // When credentials of the default provider change in the drawer, re-check status
  const handleDrawerSaved = () => { fetchProviders(); refreshWa(); };

  const handleSetDefault = async (id: string) => {
    setSettingDefault(id);
    await setDefaultProvider(id);
    setSettingDefault(null);
    // Credentials in system_settings just changed — immediately re-check connection
    await fetchProviders();
    refreshWa();
  };

  return (
    <>
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando provedores…
          </div>
        ) : (
          <>
            {providers.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum provedor cadastrado ainda.</p>
                <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">Cadastre uma API WhatsApp para começar a enviar mensagens.</p>
              </div>
            )}

            <div className="space-y-3">
              {providers.map((p) => {
                const isDefault = p.is_default;
                const isSettingThis = settingDefault === p.id;
                return (
                  <button key={p.id}
                    onClick={() => handleEdit(p)}
                    className={`w-full rounded-2xl border p-4 flex items-center gap-4 transition-all text-left group ${
                      isDefault
                        ? 'bg-[#003876]/5 dark:bg-[#003876]/10 border-[#003876]/20 dark:border-[#003876]/30 hover:border-[#003876]/40 dark:hover:border-[#003876]/50'
                        : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}>
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      isDefault
                        ? waState === 'connected'    ? 'bg-emerald-400'
                          : waState === 'connecting' ? 'bg-amber-400 animate-pulse'
                          : 'bg-red-400'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{p.name}</span>
                        {isDefault && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase text-[#003876] dark:text-[#ffd700] bg-[#003876]/10 dark:bg-[#ffd700]/10 px-2 py-0.5 rounded-full">
                            <Star className="w-2.5 h-2.5" /> Padrão
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {isDefault
                          ? waState === 'connected'    ? `Conectado · +${waPhone}`
                            : waState === 'connecting' ? 'Conectando…'
                            : waState === 'unknown'    ? 'Verificando…'
                            : 'Desconectado'
                          : p.instance_url || 'Sem URL configurada'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isDefault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetDefault(p.id); }}
                          disabled={isSettingThis}
                          title="Definir como provedor padrão"
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:border-[#ffd700] dark:hover:text-[#ffd700] disabled:opacity-50 transition-colors">
                          {isSettingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                          Definir padrão
                        </button>
                      )}
                      <Pencil className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-[#003876] dark:group-hover:text-[#ffd700] transition-colors flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:border-[#ffd700] dark:hover:text-[#ffd700] transition-colors w-full justify-center">
              <Plus className="w-4 h-4" /> Cadastrar nova API
            </button>
          </>
        )}
      </div>

      {drawerOpen && (
        <WhatsAppProviderDrawer
          provider={editingProvider}
          onClose={handleDrawerClose}
          onSaved={handleDrawerSaved}
        />
      )}
    </>
  );
}

// ── Setting Field ────────────────────────────────────────────────────────────
interface SettingFieldProps {
  item: SystemSetting;
  meta: { label: string; placeholder?: string; secret?: boolean; multiline?: boolean };
  value: string;
  isChanged: boolean;
  onChange: (val: string) => void;
}

function SettingField({ item, meta, value, isChanged, onChange }: SettingFieldProps) {
  const [showSecret, setShowSecret] = useState(false);

  // Connection status special rendering
  if (item.key === 'connected') {
    const isConnected = value === 'true';
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{meta.label}</label>
        <div className={`
          inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
          ${isConnected
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
          }
        `}>
          {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isConnected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>
    );
  }

  const inputBase = `
    w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm
    bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
    placeholder:text-gray-400 dark:placeholder:text-gray-500
    ${isChanged
      ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10 focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20'
      : 'border-gray-200 dark:border-gray-600 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 dark:focus:ring-[#ffd700]/20'
    }
  `;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{meta.label}</label>
        {isChanged && (
          <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
            Alterado
          </span>
        )}
      </div>
      {item.description && (
        <p className="text-xs text-gray-400 mb-2">{item.description}</p>
      )}

      {meta.multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={meta.placeholder}
          rows={4}
          className={`${inputBase} resize-y font-mono text-xs`}
        />
      ) : meta.secret ? (
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={meta.placeholder}
            className={`${inputBase} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={meta.placeholder}
          className={inputBase}
        />
      )}
    </div>
  );
}

// ── Empty tab state ──────────────────────────────────────────────────────────
function EmptyTabState({ tab }: { tab: TabDef }) {
  const TabIcon = tab.icon;
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <TabIcon className="w-8 h-8 text-gray-300 dark:text-gray-500" />
      </div>
      <h3 className="font-display text-lg font-bold text-gray-400 dark:text-gray-500 mb-2">
        Nenhuma configuração cadastrada
      </h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
        As configurações de <strong>{tab.label.toLowerCase()}</strong> serão adicionadas
        conforme os módulos forem implementados.
      </p>
    </div>
  );
}
