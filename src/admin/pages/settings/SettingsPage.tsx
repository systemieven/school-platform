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
  LayoutTemplate, Send, X,
  // panels
  BookOpen, BookMarked, Calendar, ClipboardList, PenLine, Briefcase, Heart,
  Phone, Mail, Home, HelpCircle, Award, UserCheck, Handshake, Baby, Bus,
  Users, User, FileText, Trash2,
  Hash, CalendarX2, Clock, ChevronDown, ChevronUp,
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
    label: 'Agendamentos de Visitas',
    shortLabel: 'Agendamentos',
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
const KEY_META: Record<string, { label: string; placeholder?: string; secret?: boolean; multiline?: boolean; type?: 'text' | 'boolean' | 'number' | 'time' | 'color' }> = {
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
  min_age:        { label: 'Idade Mínima', placeholder: '2', type: 'number' },
  require_parents_data: { label: 'Exigir Dados dos Pais', type: 'boolean' },
  require_documents:    { label: 'Exigir Documentos', type: 'boolean' },
  required_docs_list:   { label: 'Lista de Documentos Obrigatórios', placeholder: '["RG", "CPF", ...]', multiline: true },
  // contact
  required_fields:  { label: 'Campos Obrigatórios', placeholder: '["nome", "celular"]', multiline: true },
  contact_reasons:  { label: 'Motivos de Contato', placeholder: '[{ "label": "...", "icon": "..." }]', multiline: true },
  // visit
  reasons:          { label: 'Motivos de Visita', placeholder: '[{ "key": "...", "label": "..." }]', multiline: true },
  blocked_weekdays: { label: 'Dias Bloqueados (0=Dom)', placeholder: '[0, 6]' },
  lunch_start:      { label: 'Início do Almoço', placeholder: '12:00', type: 'time' },
  lunch_end:        { label: 'Fim do Almoço', placeholder: '13:30', type: 'time' },
  slot_duration:    { label: 'Duração do Slot (minutos)', placeholder: '30', type: 'number' },
  max_per_slot:     { label: 'Máx. Visitas por Slot', placeholder: '2', type: 'number' },
  start_hour:       { label: 'Horário de Início', placeholder: '08:00', type: 'time' },
  end_hour:         { label: 'Horário de Término', placeholder: '17:00', type: 'time' },
  // enrollment (extra)
  segments_available: { label: 'Segmentos Disponíveis para Matrícula', placeholder: '["Educação Infantil", ...]', multiline: true },
  // contact (extra)
  auto_qualify_as_lead: { label: 'Qualificar Contato como Lead Automaticamente', type: 'boolean' },
  sla_hours:            { label: 'SLA de Resposta (horas)', placeholder: '48', type: 'number' },
  // notifications
  notify_wa_connection:    { label: 'Alertas de conexão WhatsApp', type: 'boolean' },
  admin_email_alerts:      { label: 'Alertas por E-mail (Admin)', type: 'boolean' },
  auto_notify_on_contact:  { label: 'Notificar ao Receber Contato', type: 'boolean' },
  auto_notify_on_visit:    { label: 'Notificar ao Receber Agendamento', type: 'boolean' },
  auto_notify_on_enrollment: { label: 'Notificar ao Receber Matrícula', type: 'boolean' },
  reminder_hours_before:   { label: 'Lembrete Antes da Visita (horas)', placeholder: '24', type: 'number' },
  // appearance
  hero_title:              { label: 'Título do Hero', placeholder: 'Educação que Transforma Vidas' },
  hero_subtitle:           { label: 'Subtítulo do Hero', placeholder: 'Há mais de 20 anos...' },
  enrollment_banner_active:{ label: 'Banner de Matrículas Ativo', type: 'boolean' },
  enrollment_banner_text:  { label: 'Texto do Banner', placeholder: 'Matrículas 2026 abertas' },
  primary_color:           { label: 'Cor Primária', placeholder: '#003876', type: 'color' },
  accent_color:            { label: 'Cor de Destaque', placeholder: '#ffd700', type: 'color' },
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

              {/* Save button — only for generic tabs; custom panels have their own saves */}
              {!['whatsapp', 'visits', 'enrollment', 'contact'].includes(activeTab) && (
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
            <div className={['whatsapp', 'visits', 'enrollment', 'contact'].includes(activeTab) ? '' : 'p-6'}>
              {activeTab === 'whatsapp' ? (
                <WhatsAppSettingsPanel />
              ) : activeTab === 'visits' ? (
                <AppointmentsSettingsPanel />
              ) : activeTab === 'enrollment' ? (
                <EnrollmentSettingsPanel />
              ) : activeTab === 'contact' ? (
                <ContactSettingsPanel />
              ) : tabSettings.length === 0 ? (
                <EmptyTabState tab={currentTab} />
              ) : (
                <SettingsFieldGroup
                  settings={activeTab === 'notifications'
                    ? tabSettings.filter((s) => s.key !== 'reminder_hours_before')
                    : tabSettings}
                  editValues={editValues}
                  toStr={toStr}
                  onChange={(id, val) =>
                    setEditValues((prev) => ({ ...prev, [id]: val }))
                  }
                />
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
  meta: { label: string; placeholder?: string; secret?: boolean; multiline?: boolean; type?: string };
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

  const fieldLabel = (
    <div className="flex items-center gap-2 mb-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{meta.label}</label>
      {isChanged && (
        <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
          Alterado
        </span>
      )}
    </div>
  );

  const fieldDesc = item.description ? (
    <p className="text-xs text-gray-400 mb-2">{item.description}</p>
  ) : null;

  // Boolean toggle
  if (meta.type === 'boolean') {
    const isOn = value === 'true';
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{meta.label}</p>
          {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isChanged && (
            <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
              Alterado
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange(isOn ? 'false' : 'true')}
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/50 ${
              isOn ? 'bg-[#003876] dark:bg-[#ffd700]' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${
              isOn ? 'translate-x-6' : 'translate-x-0'
            }`}>
              {isOn && <Check className="w-3 h-3 text-[#003876] dark:text-[#003876]" strokeWidth={3} />}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Color picker
  if (meta.type === 'color') {
    return (
      <div>
        {fieldLabel}
        {fieldDesc}
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={value || meta.placeholder || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={meta.placeholder}
            className={`${inputBase} flex-1`}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {fieldLabel}
      {fieldDesc}

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
          type={meta.type === 'number' ? 'number' : meta.type === 'time' ? 'time' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={meta.placeholder}
          className={inputBase}
        />
      )}
    </div>
  );
}

// ── Settings field group (separates booleans from other fields) ──────────────
function SettingsFieldGroup({ settings, editValues, toStr, onChange }: {
  settings: SystemSetting[];
  editValues: Record<string, string>;
  toStr: (v: unknown) => string;
  onChange: (id: string, val: string) => void;
}) {
  const booleanFields = settings.filter((s) => (KEY_META[s.key] || {}).type === 'boolean');
  const otherFields = settings.filter((s) => (KEY_META[s.key] || {}).type !== 'boolean');

  return (
    <div className="space-y-6">
      {otherFields.map((item) => {
        const meta = KEY_META[item.key] || { label: item.key };
        const isChanged = editValues[item.id] !== toStr(item.value);
        return (
          <SettingField
            key={item.id} item={item} meta={meta}
            value={editValues[item.id] || ''} isChanged={isChanged}
            onChange={(val) => onChange(item.id, val)}
          />
        );
      })}

      {booleanFields.length > 0 && otherFields.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-gray-400 mb-3">Opções</p>
        </div>
      )}

      {booleanFields.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4 space-y-3">
          {booleanFields.map((item) => {
            const meta = KEY_META[item.key] || { label: item.key };
            const isChanged = editValues[item.id] !== toStr(item.value);
            return (
              <SettingField
                key={item.id} item={item} meta={meta}
                value={editValues[item.id] || ''} isChanged={isChanged}
                onChange={(val) => onChange(item.id, val)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Reminder Chain Section ─────────────────────────────────────────────────
interface ReminderEntry { minutes_before: number }

const REMINDER_PRESETS = [
  { label: '24h',   minutes: 1440 },
  { label: '2h',    minutes: 120  },
  { label: '1h',    minutes: 60   },
  { label: '30min', minutes: 30   },
  { label: '15min', minutes: 15   },
];

function formatMinutes(m: number): string {
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440}d antes`;
  if (m >= 60   && m % 60   === 0) return `${m / 60}h antes`;
  return `${m}min antes`;
}

function ReminderChainSection() {
  const [reminders, setReminders] = useState<ReminderEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [customMin, setCustomMin] = useState('');
  const [settingId, setSettingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('id, value')
      .eq('category', 'visit')
      .eq('key', 'reminder_schedule')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettingId(data.id);
          try {
            const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            setReminders(Array.isArray(parsed) ? parsed : []);
          } catch { setReminders([]); }
        } else {
          setReminders([{ minutes_before: 1440 }, { minutes_before: 60 }]);
        }
        setLoading(false);
      });
  }, []);

  async function save(updated: ReminderEntry[]) {
    setSaving(true);
    const sorted = [...updated].sort((a, b) => b.minutes_before - a.minutes_before);
    if (settingId) {
      await supabase.from('system_settings').update({ value: JSON.stringify(sorted) }).eq('id', settingId);
    } else {
      const { data } = await supabase.from('system_settings')
        .upsert({ category: 'visit', key: 'reminder_schedule', value: JSON.stringify(sorted) })
        .select('id').single();
      if (data) setSettingId(data.id);
    }
    setReminders(sorted);
    setSaving(false);
  }

  function addPreset(minutes: number) {
    if (reminders.some((r) => r.minutes_before === minutes)) return;
    save([...reminders, { minutes_before: minutes }]);
  }

  function addCustom() {
    const m = parseInt(customMin);
    if (!m || m <= 0) return;
    if (reminders.some((r) => r.minutes_before === m)) { setCustomMin(''); return; }
    save([...reminders, { minutes_before: m }]);
    setCustomMin('');
  }

  function remove(minutes: number) {
    save(reminders.filter((r) => r.minutes_before !== minutes));
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Lembretes Automáticos</h4>
          <p className="text-xs text-gray-400 mt-0.5">Cadeia de lembretes enviada antes da visita (requer template com trigger <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">on_reminder</code>).</p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-[#003876]" />}
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* Active reminders */}
          <div className="space-y-2 mb-4">
            {reminders.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhum lembrete configurado.</p>
            )}
            {reminders.map((r) => (
              <div key={r.minutes_before} className="flex items-center gap-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                <Bell className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{formatMinutes(r.minutes_before)}</span>
                <span className="text-xs text-gray-400">{r.minutes_before} min antes</span>
                <button onClick={() => remove(r.minutes_before)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Preset quick-add */}
          <div className="flex flex-wrap gap-2 mb-3">
            {REMINDER_PRESETS.map(({ label, minutes }) => (
              <button
                key={minutes}
                onClick={() => addPreset(minutes)}
                disabled={reminders.some((r) => r.minutes_before === minutes)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                + {label}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              placeholder="Minutos personalizados..."
              className="flex-1 text-xs px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none focus:border-amber-400"
            />
            <button
              onClick={addCustom}
              disabled={!customMin}
              className="text-xs px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              Adicionar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── REASON_ICON_OPTIONS ─────────────────────────────────────────────────────
const REASON_ICON_OPTIONS: { key: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'Building2',      label: 'Estrutura',      Icon: Building2      },
  { key: 'Users',          label: 'Grupo',          Icon: Users          },
  { key: 'User',           label: 'Pessoa',         Icon: User           },
  { key: 'FileText',       label: 'Documento',      Icon: FileText       },
  { key: 'BookOpen',       label: 'Livro',          Icon: BookOpen       },
  { key: 'BookMarked',     label: 'Caderneta',      Icon: BookMarked     },
  { key: 'GraduationCap',  label: 'Matrícula',      Icon: GraduationCap  },
  { key: 'MessageCircle',  label: 'Conversa',       Icon: MessageCircle  },
  { key: 'MessageSquare',  label: 'Mensagem',       Icon: MessageSquare  },
  { key: 'Calendar',       label: 'Agenda',         Icon: Calendar       },
  { key: 'ClipboardList',  label: 'Checklist',      Icon: ClipboardList  },
  { key: 'PenLine',        label: 'Assinatura',     Icon: PenLine        },
  { key: 'Briefcase',      label: 'Administrativo', Icon: Briefcase      },
  { key: 'Heart',          label: 'Cuidado',        Icon: Heart          },
  { key: 'Star',           label: 'Destaque',       Icon: Star           },
  { key: 'Phone',          label: 'Telefone',       Icon: Phone          },
  { key: 'Mail',           label: 'E-mail',         Icon: Mail           },
  { key: 'Home',           label: 'Escola',         Icon: Home           },
  { key: 'HelpCircle',     label: 'Suporte',        Icon: HelpCircle     },
  { key: 'Award',          label: 'Premiação',      Icon: Award          },
  { key: 'UserCheck',      label: 'Aprovação',      Icon: UserCheck      },
  { key: 'Handshake',      label: 'Parceria',       Icon: Handshake      },
  { key: 'Baby',           label: 'Infantil',       Icon: Baby           },
  { key: 'Bus',            label: 'Transporte',     Icon: Bus            },
];

// ── TimeRangeSlider ──────────────────────────────────────────────────────────
function TimeRangeSlider({ workStart, workEnd, lunchStart, lunchEnd, valueStart, valueEnd, stepMin = 30, onChange }: {
  workStart: string; workEnd: string;
  lunchStart: string; lunchEnd: string;
  valueStart: string; valueEnd: string;
  stepMin?: number;
  onChange: (start: string, end: string) => void;
}) {
  const toMin = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + (m || 0); };
  const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const wMin = toMin(workStart);
  const wMax = toMin(workEnd);
  const lMin = toMin(lunchStart);
  const lMax = toMin(lunchEnd);
  const vS   = Math.max(Math.min(toMin(valueStart || workStart), wMax - stepMin), wMin);
  const vE   = Math.max(Math.min(toMin(valueEnd   || workEnd),   wMax),            vS + stepMin);
  const total = wMax - wMin || 1;

  const pct = (v: number) => `${((v - wMin) / total) * 100}%`;
  const thumbCls = [
    'absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none',
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto',
    '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full',
    '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#003876]',
    '[&::-webkit-slider-thumb]:shadow-[0_0_0_2px_white,0_2px_6px_rgba(0,0,0,0.20)] [&::-webkit-slider-thumb]:cursor-grab',
    '[&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:active:scale-110',
    '[&::-webkit-slider-thumb]:transition-transform',
  ].join(' ');

  return (
    <div className="space-y-2 pt-1">
      <div className="flex justify-between text-xs font-semibold text-[#003876] dark:text-[#ffd700]">
        <span>{toTime(vS)}</span>
        <span>{toTime(vE)}</span>
      </div>
      <div className="relative h-4 flex items-center">
        <div className="absolute inset-x-0 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div
          className="absolute h-2 rounded-full bg-gradient-to-r from-[#003876] to-blue-500"
          style={{ left: pct(vS), right: `${((wMax - vE) / total) * 100}%` }}
        />
        {lMax > lMin && (
          <div
            className="absolute h-2 bg-amber-400/70 dark:bg-amber-500/60"
            style={{ left: pct(Math.max(lMin, wMin)), width: `${((Math.min(lMax, wMax) - Math.max(lMin, wMin)) / total) * 100}%` }}
          />
        )}
        <input
          type="range" min={wMin} max={wMax} step={stepMin} value={vS}
          onChange={e => onChange(toTime(Math.min(Number(e.target.value), vE - stepMin)), toTime(vE))}
          className={`${thumbCls} z-20`}
        />
        <input
          type="range" min={wMin} max={wMax} step={stepMin} value={vE}
          onChange={e => onChange(toTime(vS), toTime(Math.max(Number(e.target.value), vS + stepMin)))}
          className={`${thumbCls} z-20`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{workStart}</span>
        {lMax > lMin && <span className="text-amber-500">☕ {lunchStart}–{lunchEnd}</span>}
        <span>{workEnd}</span>
      </div>
    </div>
  );
}

// ── SLASlider ────────────────────────────────────────────────────────────────
function SLASlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const MIN = 1, MAX = 120;
  const pct = ((Math.min(Math.max(value, MIN), MAX) - MIN) / (MAX - MIN)) * 100;
  const fmt = (h: number) => h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
  const PRESETS = [4, 8, 24, 48, 72];
  return (
    <div className="space-y-3">
      <div className="text-2xl font-bold text-[#003876] dark:text-white">{fmt(value)}</div>
      <div className="relative h-6 flex items-center">
        <div className="absolute w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full" />
        <div className="absolute h-1.5 bg-[#003876] rounded-full pointer-events-none" style={{ width: `${pct}%` }} />
        <input
          type="range" min={MIN} max={MAX} step={1} value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute w-full appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]"
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 px-1">
        <span>1h</span><span>24h</span><span>48h</span><span>72h</span><span>120h</span>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {PRESETS.map((h) => (
          <button
            key={h}
            onClick={() => onChange(h)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              value === h
                ? 'bg-[#003876] text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {fmt(h)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Appointments Settings Panel ──────────────────────────────────────────────
interface VisitSettings {
  start_hour: string;
  end_hour: string;
  lunch_start: string;
  lunch_end: string;
  slot_duration: number;
  blocked_weekdays: number[];
  reasons: {
    key: string;
    label: string;
    icon: string;
    duration_minutes: number;
    buffer_minutes: number;
    max_per_slot: number;
    max_daily: number;
    availability_enabled: boolean;
    availability_start: string;
    availability_end: string;
    lead_integrated: boolean;
  }[];
}

const DEFAULT_VISIT: VisitSettings = {
  start_hour: '08:00',
  end_hour: '17:00',
  lunch_start: '12:00',
  lunch_end: '13:30',
  slot_duration: 30,
  blocked_weekdays: [0, 6],
  reasons: [],
};

const SLOT_OPTIONS = [15, 20, 30, 45, 60];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function AppointmentsSettingsPanel() {
  const [data, setData]         = useState<VisitSettings>(DEFAULT_VISIT);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [original, setOriginal] = useState<string>('');
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [drawerIsNew, setDrawerIsNew] = useState(false);
  const [drawerDraft, setDrawerDraft] = useState<VisitSettings['reasons'][0] | null>(null);
  const [ids, setIds] = useState<Record<string, string>>({});

  // Dias Fechados (from visit_blocked_dates table)
  const [blockedDates, setBlockedDates]       = useState<{id: string; blocked_date: string; reason: string | null}[]>([]);
  const [newBlockedDay,    setNewBlockedDay]   = useState('');
  const [newBlockedMonth,  setNewBlockedMonth] = useState('');
  const [newBlockedYear,   setNewBlockedYear]  = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');

  // Feriados (from system_settings key='holidays')
  const [holidays, setHolidays]               = useState<{name: string; month: number; day: number}[]>([]);
  const [holidaySettingId, setHolidaySettingId] = useState<string | null>(null);
  const [newHolidayName,   setNewHolidayName]  = useState('');
  const [newHolidayDay,    setNewHolidayDay]   = useState('');
  const [newHolidayMonth,  setNewHolidayMonth] = useState('');

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('id, key, value')
      .eq('category', 'visit')
      .in('key', ['start_hour', 'end_hour', 'lunch_start', 'lunch_end', 'slot_duration', 'blocked_weekdays', 'reasons'])
      .then(({ data: rows }) => {
        if (!rows) { setLoading(false); return; }
        const merged = { ...DEFAULT_VISIT };
        const newIds: Record<string, string> = {};
        rows.forEach((r) => {
          newIds[r.key] = r.id;
          const v = r.value;
          if (r.key === 'start_hour' || r.key === 'end_hour' || r.key === 'lunch_start' || r.key === 'lunch_end') {
            merged[r.key] = typeof v === 'string' ? v : String(v);
          } else if (r.key === 'slot_duration') {
            merged[r.key] = typeof v === 'number' ? v : parseInt(String(v)) || 0;
          } else if (r.key === 'blocked_weekdays') {
            try { merged[r.key] = typeof v === 'string' ? JSON.parse(v) : v; } catch { /* keep default */ }
          } else if (r.key === 'reasons') {
            try {
              const raw: { key: string; label: string; duration_minutes?: number; buffer_minutes?: number; max_per_slot?: number }[] =
                typeof v === 'string' ? JSON.parse(v) : v;
              merged[r.key] = raw.map((item) => ({
                icon: 'FileText',
                duration_minutes: 30,
                buffer_minutes: 0,
                max_per_slot: 1,
                max_daily: 0,
                availability_enabled: false,
                availability_start: '',
                availability_end: '',
                lead_integrated: false,
                ...item,
              }));
            } catch { /* keep default */ }
          }
        });
        setData(merged);
        setIds(newIds);
        setOriginal(JSON.stringify(merged));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    supabase.from('visit_blocked_dates').select('id, blocked_date, reason').order('blocked_date').then(({ data: rows }) => {
      if (rows) setBlockedDates(rows);
    });
  }, []);

  useEffect(() => {
    supabase.from('system_settings').select('id, value').eq('category', 'visit').eq('key', 'holidays').maybeSingle().then(({ data: row }) => {
      if (row) {
        setHolidaySettingId(row.id);
        try {
          const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          setHolidays(Array.isArray(parsed) ? parsed : []);
        } catch { setHolidays([]); }
      }
    });
  }, []);

  async function addBlockedDate() {
    if (!newBlockedDay || !newBlockedMonth || !newBlockedYear) return;
    const dateStr = `${newBlockedYear}-${String(newBlockedMonth).padStart(2, '0')}-${String(newBlockedDay).padStart(2, '0')}`;
    const { data: inserted } = await supabase.from('visit_blocked_dates')
      .insert({ blocked_date: dateStr, reason: newBlockedReason || null })
      .select('id, blocked_date, reason').single();
    if (inserted) {
      setBlockedDates((prev) => [...prev, inserted].sort((a, b) => a.blocked_date.localeCompare(b.blocked_date)));
    }
    setNewBlockedDay(''); setNewBlockedMonth(''); setNewBlockedYear(''); setNewBlockedReason('');
  }

  async function removeBlockedDate(id: string) {
    await supabase.from('visit_blocked_dates').delete().eq('id', id);
    setBlockedDates((prev) => prev.filter((d) => d.id !== id));
  }

  async function saveHolidays(list: typeof holidays) {
    if (holidaySettingId) {
      await supabase.from('system_settings').update({ value: list }).eq('id', holidaySettingId);
    } else {
      const { data: row } = await supabase.from('system_settings')
        .insert({ category: 'visit', key: 'holidays', value: list }).select('id').single();
      if (row) setHolidaySettingId(row.id);
    }
    setHolidays(list);
  }

  async function addHoliday() {
    const month = parseInt(newHolidayMonth);
    const day   = parseInt(newHolidayDay);
    if (!newHolidayName.trim() || !month || !day) return;
    const updated = [...holidays, { name: newHolidayName.trim(), month, day }]
      .sort((a, b) => a.month !== b.month ? a.month - b.month : a.day - b.day);
    await saveHolidays(updated);
    setNewHolidayName(''); setNewHolidayDay(''); setNewHolidayMonth('');
  }

  async function removeHoliday(idx: number) {
    await saveHolidays(holidays.filter((_, i) => i !== idx));
  }

  const hasChanges = JSON.stringify(data) !== original;

  async function handleSave() {
    setSaving(true);
    const rows = [
      { key: 'start_hour',       value: data.start_hour },
      { key: 'end_hour',         value: data.end_hour },
      { key: 'lunch_start',      value: data.lunch_start },
      { key: 'lunch_end',        value: data.lunch_end },
      { key: 'slot_duration',    value: String(data.slot_duration) },
      { key: 'blocked_weekdays', value: JSON.stringify(data.blocked_weekdays) },
      { key: 'reasons',          value: JSON.stringify(data.reasons) },
    ];
    await Promise.all(
      rows.map((r) =>
        ids[r.key]
          ? supabase.from('system_settings').update({ value: r.value }).eq('id', ids[r.key])
          : supabase.from('system_settings').insert({ category: 'visit', key: r.key, value: r.value })
              .select('id').single().then(({ data: row }) => {
                if (row) setIds((prev) => ({ ...prev, [r.key]: row.id }));
              }),
      ),
    );
    setOriginal(JSON.stringify(data));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleWeekday(day: number) {
    setData((prev) => ({
      ...prev,
      blocked_weekdays: prev.blocked_weekdays.includes(day)
        ? prev.blocked_weekdays.filter((d) => d !== day)
        : [...prev.blocked_weekdays, day],
    }));
  }

  function openDrawer(key: string | null) {
    if (key === null) {
      setDrawerDraft({ key: '', label: '', icon: 'FileText', duration_minutes: 30, buffer_minutes: 0, max_per_slot: 1, max_daily: 0, availability_enabled: false, availability_start: '', availability_end: '', lead_integrated: false });
      setDrawerIsNew(true);
    } else {
      const found = data.reasons.find((r) => r.key === key);
      if (!found) return;
      setDrawerDraft({ ...found });
      setDrawerIsNew(false);
    }
    setDrawerOpen(true);
  }

  function closeDrawer() { setDrawerOpen(false); setDrawerDraft(null); }

  function saveDrawer() {
    if (!drawerDraft || !drawerDraft.label.trim()) return;
    if (drawerIsNew) {
      const label = drawerDraft.label.trim();
      const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `reason_${Date.now()}`;
      if (data.reasons.some((r) => r.key === key)) return;
      setData((prev) => ({ ...prev, reasons: [...prev.reasons, { ...drawerDraft, key, label }] }));
    } else {
      setData((prev) => ({
        ...prev,
        reasons: prev.reasons.map((r) => r.key === drawerDraft.key ? { ...drawerDraft } : r),
      }));
    }
    closeDrawer();
  }

  function removeReason(key: string) {
    setData((prev) => ({ ...prev, reasons: prev.reasons.filter((r) => r.key !== key) }));
  }

  const sectionCard  = 'bg-gray-50 dark:bg-gray-900/30 rounded-2xl p-5 space-y-4';
  const sectionTitle = 'text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 mb-4';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Horário de Atendimento */}
      <div className={sectionCard}>
        <p className={sectionTitle}>
          <Clock className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          Horário de Atendimento
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Início</label>
            <input type="time" value={data.start_hour} onChange={(e) => setData((p) => ({ ...p, start_hour: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Término</label>
            <input type="time" value={data.end_hour} onChange={(e) => setData((p) => ({ ...p, end_hour: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20" />
          </div>
        </div>
        <p className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 pt-2">Intervalo de Almoço</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Início</label>
            <input type="time" value={data.lunch_start} onChange={(e) => setData((p) => ({ ...p, lunch_start: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Término</label>
            <input type="time" value={data.lunch_end} onChange={(e) => setData((p) => ({ ...p, lunch_end: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20" />
          </div>
        </div>
      </div>

      {/* Duração do Slot */}
      <div className={sectionCard}>
        <p className={sectionTitle}>
          <Hash className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          Duração do Slot
        </p>
        <div className="flex flex-wrap gap-2">
          {SLOT_OPTIONS.map((min) => (
            <button
              key={min}
              onClick={() => setData((p) => ({ ...p, slot_duration: min }))}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                data.slot_duration === min
                  ? 'bg-[#003876] text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#003876]/50'
              }`}
            >
              {min} min
            </button>
          ))}
        </div>
      </div>

      {/* Dias Bloqueados */}
      <div className={sectionCard}>
        <p className={sectionTitle}>Dias Bloqueados</p>
        <p className="text-xs text-gray-400 -mt-2 mb-3">Dias marcados em azul não aceitam agendamentos.</p>
        <div className="flex gap-2 flex-wrap">
          {WEEKDAYS.map((name, idx) => {
            const isBlocked = data.blocked_weekdays.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleWeekday(idx)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                  isBlocked
                    ? 'bg-[#003876] text-white shadow-md'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#003876]/50'
                }`}
              >
                {isBlocked && <X className="w-3 h-3" />}
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Motivos de Visita */}
      <div className={sectionCard}>
        <div className="flex items-center justify-between mb-3">
          <p className={sectionTitle}>
            <FileText className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
            Motivos de Visita
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{data.reasons.length}/10</span>
            {data.reasons.length < 10 && (
              <button
                onClick={() => openDrawer(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003876] text-white text-xs font-medium hover:bg-[#002855] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            )}
          </div>
        </div>
        {data.reasons.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Nenhum motivo cadastrado.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {data.reasons.map((r) => {
              const iconOpt = REASON_ICON_OPTIONS.find((o) => o.key === (r.icon || 'FileText'));
              const IconComp = iconOpt?.Icon ?? FileText;
              return (
                <button
                  key={r.key}
                  onClick={() => openDrawer(r.key)}
                  className="flex items-center gap-3 px-3 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-[#003876]/50 hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#003876]/8 dark:bg-[#003876]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#003876]/15 transition-colors">
                    <IconComp className="w-[18px] h-[18px] text-[#003876] dark:text-[#ffd700]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight">{r.label}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-400">{r.duration_minutes}min</span>
                      {(r.buffer_minutes ?? 0) > 0 && <span className="text-[10px] text-gray-400">+{r.buffer_minutes}buf</span>}
                      <span className="text-[10px] text-gray-400">×{r.max_per_slot ?? 1}</span>
                      {(r.lead_integrated ?? false) && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#003876]/10 text-[#003876] dark:text-[#ffd700]">Lead</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Dias Fechados */}
      <div className={sectionCard}>
        <p className={sectionTitle}>
          <CalendarX2 className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          Dias Fechados
        </p>
        <div className="space-y-2">
          {blockedDates.length === 0 && (
            <p className="text-xs text-gray-400 italic">Nenhum dia fechado cadastrado.</p>
          )}
          {blockedDates.map((d) => {
            const [year, month, day] = d.blocked_date.split('-');
            const formatted = `${day}/${month}/${year}`;
            return (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800/40 rounded-xl">
                <CalendarX2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{formatted}</span>
                {d.reason && <span className="text-xs text-gray-400 truncate max-w-[120px]">{d.reason}</span>}
                <button onClick={() => removeBlockedDate(d.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-1 flex-wrap items-center">
          <select value={newBlockedDay} onChange={(e) => setNewBlockedDay(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20">
            <option value="">Dia</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
            ))}
          </select>
          <select value={newBlockedMonth} onChange={(e) => setNewBlockedMonth(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20">
            <option value="">Mês</option>
            {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={newBlockedYear} onChange={(e) => setNewBlockedYear(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20">
            <option value="">Ano</option>
            {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <input type="text" value={newBlockedReason} onChange={(e) => setNewBlockedReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBlockedDate()} placeholder="Motivo (opcional)" className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20 placeholder:text-gray-400" />
          <button onClick={addBlockedDate} disabled={!newBlockedDay || !newBlockedMonth || !newBlockedYear} className="px-4 py-2 rounded-xl bg-[#003876] text-white text-sm font-medium hover:bg-[#002855] disabled:opacity-40 transition-all">
            Adicionar
          </button>
        </div>
      </div>

      {/* Feriados */}
      <div className={sectionCard}>
        <div className="mb-1">
          <p className={sectionTitle}>
            <Calendar className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
            Feriados
          </p>
          <p className="text-xs text-gray-400 -mt-3">Datas fixas recorrentes (dia/mês). Feriados variáveis use Dias Fechados.</p>
        </div>
        <div className="space-y-2">
          {holidays.length === 0 && (
            <p className="text-xs text-gray-400 italic">Nenhum feriado cadastrado.</p>
          )}
          {holidays.map((h, idx) => {
            const dd = String(h.day).padStart(2, '0');
            const mm = String(h.month).padStart(2, '0');
            return (
              <div key={idx} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{h.name}</span>
                <span className="text-xs text-gray-400">{dd}/{mm}</span>
                <button onClick={() => removeHoliday(idx)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-1 flex-wrap items-center">
          <select value={newHolidayDay} onChange={(e) => setNewHolidayDay(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20">
            <option value="">Dia</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
            ))}
          </select>
          <select value={newHolidayMonth} onChange={(e) => setNewHolidayMonth(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20">
            <option value="">Mês</option>
            {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <input type="text" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addHoliday()} placeholder="Nome do feriado" className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20 placeholder:text-gray-400" />
          <button onClick={addHoliday} disabled={!newHolidayDay || !newHolidayMonth || !newHolidayName.trim()} className="px-4 py-2 rounded-xl bg-[#003876] text-white text-sm font-medium hover:bg-[#002855] disabled:opacity-40 transition-all">
            Adicionar
          </button>
        </div>
      </div>

      {/* Lembretes Automáticos */}
      <div className={sectionCard}>
        <div className="mb-1">
          <p className={sectionTitle}>
            <Bell className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
            Lembretes Automáticos
          </p>
          <p className="text-xs text-gray-400 -mt-3">Cadeia de lembretes enviada antes da visita. Requer template com trigger <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-[10px]">on_reminder</code>.</p>
        </div>
        <ReminderChainSection />
      </div>

      {/* Floating save */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-[#003876] text-white hover:bg-[#002855] shadow-[#003876]/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* Reason Drawer */}
      {drawerOpen && drawerDraft && (() => {
        const d = drawerDraft;
        const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90];
        const BUFFER_OPTIONS   = [0, 5, 10, 15, 30];
        return (
          <>
            <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40" onClick={closeDrawer} />
            <div className="fixed right-0 top-0 h-full w-[400px] max-w-full bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                  {drawerIsNew ? 'Novo motivo' : 'Editar motivo'}
                </h3>
                <div className="flex items-center gap-1">
                  {!drawerIsNew && (
                    <button
                      onClick={() => { removeReason(d.key); closeDrawer(); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Excluir motivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={closeDrawer} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Nome</label>
                  <input type="text" value={d.label} onChange={(e) => setDrawerDraft((prev) => prev ? { ...prev, label: e.target.value } : prev)} placeholder="Nome do motivo" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Ícone</p>
                  <div className="grid grid-cols-8 gap-1.5">
                    {REASON_ICON_OPTIONS.map(({ key: iconKey, label: iconLabel, Icon: IconComp }) => {
                      const isSelected = (d.icon || 'FileText') === iconKey;
                      return (
                        <button
                          key={iconKey}
                          onClick={() => setDrawerDraft((prev) => prev ? { ...prev, icon: iconKey } : prev)}
                          title={iconLabel}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-[#003876] text-white shadow-sm ring-2 ring-[#003876]/30'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-[#003876]/10 hover:text-[#003876] dark:hover:text-[#ffd700]'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Duração</p>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((min) => (
                      <button key={min} onClick={() => setDrawerDraft((prev) => prev ? { ...prev, duration_minutes: min } : prev)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${d.duration_minutes === min ? 'bg-[#003876] text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                        {min} min
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Intervalo após</p>
                  <p className="text-xs text-gray-400 mb-2">Tempo de preparação entre atendimentos</p>
                  <div className="flex flex-wrap gap-2">
                    {BUFFER_OPTIONS.map((min) => (
                      <button key={min} onClick={() => setDrawerDraft((prev) => prev ? { ...prev, buffer_minutes: min } : prev)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${d.buffer_minutes === min ? 'bg-[#003876] text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                        {min === 0 ? 'Nenhum' : `${min} min`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Máx. simultâneos</p>
                    <p className="text-xs text-gray-400 mt-0.5">Agendamentos no mesmo horário</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setDrawerDraft((prev) => prev ? { ...prev, max_per_slot: Math.max(1, (prev.max_per_slot ?? 1) - 1) } : prev)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronDown className="w-4 h-4" /></button>
                    <span className="w-8 text-center text-lg font-bold text-gray-800 dark:text-white">{d.max_per_slot ?? 1}</span>
                    <button onClick={() => setDrawerDraft((prev) => prev ? { ...prev, max_per_slot: Math.min(10, (prev.max_per_slot ?? 1) + 1) } : prev)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronUp className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Máx. diário</p>
                    <p className="text-xs text-gray-400 mt-0.5">0 = ilimitado</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setDrawerDraft((prev) => prev ? { ...prev, max_daily: Math.max(0, (prev.max_daily ?? 0) - 1) } : prev)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronDown className="w-4 h-4" /></button>
                    <span className="w-8 text-center text-lg font-bold text-gray-800 dark:text-white">{d.max_daily ?? 0}</span>
                    <button onClick={() => setDrawerDraft((prev) => prev ? { ...prev, max_daily: Math.min(50, (prev.max_daily ?? 0) + 1) } : prev)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronUp className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Disponibilidade específica</p>
                      <p className="text-xs text-gray-400 mt-0.5">Restringe horários para este motivo</p>
                    </div>
                    <button
                      onClick={() => setDrawerDraft((prev) => {
                        if (!prev) return prev;
                        return { ...prev, availability_enabled: !prev.availability_enabled, availability_start: prev.availability_start || data.start_hour, availability_end: prev.availability_end || data.end_hour };
                      })}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/50 ${d.availability_enabled ? 'bg-[#003876]' : 'bg-gray-200 dark:bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${d.availability_enabled ? 'translate-x-6' : 'translate-x-0'}`}>
                        {d.availability_enabled && <Check className="w-3 h-3 text-[#003876]" strokeWidth={3} />}
                      </span>
                    </button>
                  </div>
                  {d.availability_enabled && (
                    <TimeRangeSlider
                      workStart={data.start_hour} workEnd={data.end_hour}
                      lunchStart={data.lunch_start} lunchEnd={data.lunch_end}
                      valueStart={d.availability_start || data.start_hour}
                      valueEnd={d.availability_end || data.end_hour}
                      stepMin={data.slot_duration || 30}
                      onChange={(start, end) => setDrawerDraft((prev) => prev ? { ...prev, availability_start: start, availability_end: end } : prev)}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Integrar com Gestão de Leads</p>
                    <p className="text-xs text-gray-400 mt-0.5">Cria um lead automaticamente ao agendar</p>
                  </div>
                  <button
                    onClick={() => setDrawerDraft((prev) => prev ? { ...prev, lead_integrated: !prev.lead_integrated } : prev)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/50 ${d.lead_integrated ? 'bg-[#003876]' : 'bg-gray-200 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${d.lead_integrated ? 'translate-x-6' : 'translate-x-0'}`}>
                      {d.lead_integrated && <Check className="w-3 h-3 text-[#003876]" strokeWidth={3} />}
                    </span>
                  </button>
                </div>
              </div>
              <div className="px-5 py-4 pb-8 border-t border-gray-100 dark:border-gray-700">
                <button onClick={saveDrawer} disabled={!d.label.trim()} className="w-full py-2.5 rounded-xl bg-[#003876] text-white text-sm font-semibold hover:bg-[#002855] disabled:opacity-40 transition-all">
                  {drawerIsNew ? 'Adicionar motivo' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ── Enrollment Settings Panel ─────────────────────────────────────────────────
interface EnrollmentSettings {
  min_age: number;
  segments_available: string[];
  required_docs_list: string[];
  require_parents_data: boolean;
  require_documents: boolean;
}

const DEFAULT_ENROLLMENT: EnrollmentSettings = {
  min_age: 3,
  segments_available: [],
  required_docs_list: [],
  require_parents_data: true,
  require_documents: true,
};

const SEGMENT_OPTIONS: { label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Educação Infantil',     Icon: Baby          },
  { label: 'Ensino Fundamental I',  Icon: BookOpen      },
  { label: 'Ensino Fundamental II', Icon: BookMarked    },
  { label: 'Ensino Médio',          Icon: GraduationCap },
];

const DOC_SUGGESTIONS: { label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'RG',                      Icon: User        },
  { label: 'CPF',                     Icon: FileText    },
  { label: 'Certidão de Nascimento',  Icon: Baby        },
  { label: 'Comprovante de Residência', Icon: Home      },
  { label: 'Histórico Escolar',       Icon: BookOpen    },
  { label: 'Carteira de Vacinação',   Icon: Heart       },
  { label: 'Foto 3x4',               Icon: UserCheck   },
];

function EnrollmentSettingsPanel() {
  const [data, setData]         = useState<EnrollmentSettings>(DEFAULT_ENROLLMENT);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [original, setOriginal] = useState<string>('');
  const [newDoc, setNewDoc]     = useState('');
  const [ids, setIds]           = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('id, key, value')
      .eq('category', 'enrollment')
      .in('key', ['min_age', 'segments_available', 'required_docs_list', 'require_parents_data', 'require_documents'])
      .then(({ data: rows }) => {
        if (!rows) { setLoading(false); return; }
        const merged = { ...DEFAULT_ENROLLMENT };
        const newIds: Record<string, string> = {};
        rows.forEach((r) => {
          newIds[r.key] = r.id;
          const v = r.value;
          if (r.key === 'min_age') {
            merged.min_age = typeof v === 'number' ? v : parseInt(String(v)) || 0;
          } else if (r.key === 'require_parents_data' || r.key === 'require_documents') {
            merged[r.key] = v === true || v === 'true';
          } else if (r.key === 'segments_available' || r.key === 'required_docs_list') {
            try { merged[r.key] = typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : []); } catch { /* keep default */ }
          }
        });
        setData(merged);
        setIds(newIds);
        setOriginal(JSON.stringify(merged));
        setLoading(false);
      });
  }, []);

  const hasChanges = JSON.stringify(data) !== original;

  async function handleSave() {
    setSaving(true);
    const rows = [
      { key: 'min_age',              value: String(data.min_age) },
      { key: 'segments_available',   value: JSON.stringify(data.segments_available) },
      { key: 'required_docs_list',   value: JSON.stringify(data.required_docs_list) },
      { key: 'require_parents_data', value: String(data.require_parents_data) },
      { key: 'require_documents',    value: String(data.require_documents) },
    ];
    await Promise.all(
      rows.map((r) =>
        ids[r.key]
          ? supabase.from('system_settings').update({ value: r.value }).eq('id', ids[r.key])
          : supabase.from('system_settings').insert({ category: 'enrollment', key: r.key, value: r.value })
              .select('id').single().then(({ data: row }) => {
                if (row) setIds((prev) => ({ ...prev, [r.key]: row.id }));
              }),
      ),
    );
    setOriginal(JSON.stringify(data));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleSegment(label: string) {
    setData((prev) => ({
      ...prev,
      segments_available: prev.segments_available.includes(label)
        ? prev.segments_available.filter((s) => s !== label)
        : [...prev.segments_available, label],
    }));
  }

  function addDoc(label: string) {
    const doc = label.trim();
    if (!doc || data.required_docs_list.includes(doc)) return;
    setData((prev) => ({ ...prev, required_docs_list: [...prev.required_docs_list, doc] }));
    setNewDoc('');
  }

  function removeDoc(doc: string) {
    setData((prev) => ({ ...prev, required_docs_list: prev.required_docs_list.filter((d) => d !== doc) }));
  }

  const sectionCard  = 'bg-gray-50 dark:bg-gray-900/30 rounded-2xl p-5 space-y-4';
  const sectionTitle = 'text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 mb-4';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Idade Mínima */}
      <div className={sectionCard}>
        <p className={sectionTitle}>Idade Mínima</p>
        <div className="flex items-center gap-4">
          <button onClick={() => setData((p) => ({ ...p, min_age: Math.max(0, p.min_age - 1) }))} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronDown className="w-4 h-4" /></button>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#003876] dark:text-white">{data.min_age}</span>
            <span className="text-sm text-gray-400">anos</span>
          </div>
          <button onClick={() => setData((p) => ({ ...p, min_age: Math.min(18, p.min_age + 1) }))} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronUp className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Segmentos Disponíveis */}
      <div className={sectionCard}>
        <p className={sectionTitle}>
          <GraduationCap className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          Segmentos Disponíveis
        </p>
        <div className="flex flex-wrap gap-2">
          {SEGMENT_OPTIONS.map(({ label: seg, Icon: SegIcon }) => {
            const selected = data.segments_available.includes(seg);
            return (
              <button
                key={seg}
                onClick={() => toggleSegment(seg)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  selected
                    ? 'bg-[#003876] border-[#003876] text-white shadow-sm shadow-[#003876]/20'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#003876]/40 hover:text-[#003876] dark:hover:text-[#ffd700]'
                }`}
              >
                <SegIcon className="w-4 h-4 flex-shrink-0" />
                {seg}
              </button>
            );
          })}
        </div>
      </div>

      {/* Documentos Obrigatórios */}
      <div className={sectionCard}>
        <p className={sectionTitle}>
          <FileText className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          Documentos Obrigatórios
        </p>
        {/* Sugestões rápidas em grid 2 colunas */}
        <div className="grid grid-cols-2 gap-1.5">
          {DOC_SUGGESTIONS.map(({ label: s, Icon: DocIcon }) => {
            const added = data.required_docs_list.includes(s);
            return (
              <button
                key={s}
                onClick={() => added ? removeDoc(s) : addDoc(s)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${
                  added
                    ? 'bg-[#003876] border-[#003876] text-white shadow-sm shadow-[#003876]/20'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#003876]/40 hover:text-[#003876] dark:hover:text-[#ffd700]'
                }`}
              >
                <DocIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{s}</span>
              </button>
            );
          })}
        </div>
        {/* Documentos customizados (fora das sugestões) */}
        {data.required_docs_list.filter((d) => !DOC_SUGGESTIONS.some((s) => s.label === d)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.required_docs_list.filter((d) => !DOC_SUGGESTIONS.some((s) => s.label === d)).map((doc) => (
              <span key={doc} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-[#003876] border-[#003876] text-white text-sm font-medium shadow-sm shadow-[#003876]/20">
                <FileText className="w-4 h-4 flex-shrink-0" />
                {doc}
                <button onClick={() => removeDoc(doc)} className="opacity-70 hover:opacity-100 transition-opacity"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input type="text" value={newDoc} onChange={(e) => setNewDoc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDoc(newDoc)} placeholder="Outro documento..." className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20 placeholder:text-gray-400" />
          <button onClick={() => addDoc(newDoc)} disabled={!newDoc.trim()} className="px-4 py-2 rounded-xl bg-[#003876] text-white text-sm font-medium hover:bg-[#002855] disabled:opacity-40 transition-all">Adicionar</button>
        </div>
      </div>

      {/* Opções booleanas */}
      <div className={sectionCard}>
        <p className={sectionTitle}>
          <UserCheck className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          Opções
        </p>
        <div className="space-y-3">
          {(
            [
              { key: 'require_parents_data', label: 'Exigir Dados dos Pais', desc: 'Solicita nome, CPF e contato dos responsáveis no formulário.' },
              { key: 'require_documents',    label: 'Exigir Documentos',     desc: 'Exige o envio dos documentos listados acima na pré-matrícula.' },
            ] as const
          ).map(({ key, label, desc }) => {
            const isOn = data[key];
            return (
              <div key={key} className="flex items-center justify-between gap-4 py-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setData((p) => ({ ...p, [key]: !p[key] }))}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/50 ${isOn ? 'bg-[#003876]' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${isOn ? 'translate-x-6' : 'translate-x-0'}`}>
                    {isOn && <Check className="w-3 h-3 text-[#003876]" strokeWidth={3} />}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating save */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-[#003876] text-white hover:bg-[#002855] shadow-[#003876]/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ── Contact Settings Panel ───────────────────────────────────────────────────
interface ContactSettings {
  sla_hours: number;
  required_fields: string[];
  reasons: {
    key: string;
    label: string;
    icon: string;
    lead_integrated: boolean;
    require_message: boolean;
  }[];
}

const DEFAULT_CONTACT: ContactSettings = {
  sla_hours: 48,
  required_fields: ['nome', 'celular'],
  reasons: [],
};

const REQUIRED_FIELD_OPTIONS: { key: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'nome',     label: 'Nome',     Icon: User          },
  { key: 'email',    label: 'E-mail',   Icon: Mail          },
  { key: 'celular',  label: 'Celular',  Icon: Phone         },
  { key: 'mensagem', label: 'Mensagem', Icon: MessageSquare },
];

function ContactSettingsPanel() {
  const [data, setData]         = useState<ContactSettings>(DEFAULT_CONTACT);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [original, setOriginal] = useState<string>('');
  const [ids, setIds]           = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [drawerIsNew, setDrawerIsNew] = useState(false);
  const [drawerDraft, setDrawerDraft] = useState<ContactSettings['reasons'][0] | null>(null);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('id, key, value')
      .eq('category', 'contact')
      .in('key', ['sla_hours', 'required_fields', 'contact_reasons'])
      .then(({ data: rows }) => {
        if (!rows) { setLoading(false); return; }
        const merged = { ...DEFAULT_CONTACT };
        const newIds: Record<string, string> = {};
        rows.forEach((r) => {
          newIds[r.key] = r.id;
          const v = r.value;
          if (r.key === 'sla_hours') {
            merged.sla_hours = typeof v === 'number' ? v : parseInt(String(v)) || 48;
          } else if (r.key === 'required_fields') {
            try { merged.required_fields = typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : []); } catch { /* keep */ }
          } else if (r.key === 'contact_reasons') {
            try {
              const raw = typeof v === 'string' ? JSON.parse(v) : v;
              if (Array.isArray(raw)) {
                merged.reasons = raw.map((item: Record<string, unknown>) => ({
                  icon: 'MessageSquare',
                  lead_integrated: false,
                  require_message: false,
                  key: (item.key || item.value || String(item.label || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')) as string,
                  label: String(item.label || ''),
                  ...item,
                }));
              }
            } catch { /* keep */ }
          }
        });
        setData(merged);
        setIds(newIds);
        setOriginal(JSON.stringify(merged));
        setLoading(false);
      });
  }, []);

  const hasChanges = JSON.stringify(data) !== original;

  async function handleSave() {
    setSaving(true);
    const rows = [
      { key: 'sla_hours',       value: String(data.sla_hours) },
      { key: 'required_fields', value: JSON.stringify(data.required_fields) },
      { key: 'contact_reasons', value: JSON.stringify(data.reasons) },
    ];
    await Promise.all(
      rows.map((r) =>
        ids[r.key]
          ? supabase.from('system_settings').update({ value: r.value }).eq('id', ids[r.key])
          : supabase.from('system_settings').insert({ category: 'contact', key: r.key, value: r.value })
              .select('id').single().then(({ data: row }) => {
                if (row) setIds((prev) => ({ ...prev, [r.key]: row.id }));
              }),
      ),
    );
    setOriginal(JSON.stringify(data));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleField(key: string) {
    setData((prev) => ({
      ...prev,
      required_fields: prev.required_fields.includes(key)
        ? prev.required_fields.filter((f) => f !== key)
        : [...prev.required_fields, key],
    }));
  }

  function openDrawer(key: string | null) {
    if (key === null) {
      setDrawerDraft({ key: '', label: '', icon: 'MessageSquare', lead_integrated: false, require_message: false });
      setDrawerIsNew(true);
    } else {
      const found = data.reasons.find((r) => r.key === key);
      if (!found) return;
      setDrawerDraft({ ...found });
      setDrawerIsNew(false);
    }
    setDrawerOpen(true);
  }

  function closeDrawer() { setDrawerOpen(false); setDrawerDraft(null); }

  function saveDrawer() {
    if (!drawerDraft || !drawerDraft.label.trim()) return;
    if (drawerIsNew) {
      const label = drawerDraft.label.trim();
      const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `reason_${Date.now()}`;
      if (data.reasons.some((r) => r.key === key)) return;
      setData((prev) => ({ ...prev, reasons: [...prev.reasons, { ...drawerDraft, key, label }] }));
    } else {
      setData((prev) => ({
        ...prev,
        reasons: prev.reasons.map((r) => r.key === drawerDraft.key ? { ...drawerDraft } : r),
      }));
    }
    closeDrawer();
  }

  function removeReason(key: string) {
    setData((prev) => ({ ...prev, reasons: prev.reasons.filter((r) => r.key !== key) }));
  }

  const sectionCard  = 'bg-gray-50 dark:bg-gray-900/30 rounded-2xl p-5 space-y-4';
  const sectionTitle = 'text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 mb-4';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* SLA de Resposta */}
      <div className={sectionCard}>
        <p className={sectionTitle}>
          <Clock className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          SLA de Resposta
        </p>
        <p className="text-xs text-gray-400 -mt-2 mb-3">Prazo máximo esperado para responder a um contato recebido.</p>
        <SLASlider value={data.sla_hours} onChange={(v) => setData((p) => ({ ...p, sla_hours: v }))} />
      </div>

      {/* Campos Obrigatórios */}
      <div className={sectionCard}>
        <p className={sectionTitle}>
          <FileText className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          Campos Obrigatórios
        </p>
        <p className="text-xs text-gray-400 -mt-2 mb-3">Campos que o visitante precisa preencher no formulário.</p>
        <div className="flex flex-wrap gap-2">
          {REQUIRED_FIELD_OPTIONS.map(({ key, label, Icon }) => {
            const active = data.required_fields.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleField(key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  active
                    ? 'bg-[#003876] border-[#003876] text-white shadow-sm shadow-[#003876]/20'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#003876]/40 hover:text-[#003876] dark:hover:text-[#ffd700]'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Motivos de Contato */}
      <div className={sectionCard}>
        <div className="flex items-center justify-between mb-3">
          <p className={sectionTitle}>
            <MessageSquare className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
            Motivos de Contato
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{data.reasons.length}/12</span>
            {data.reasons.length < 12 && (
              <button onClick={() => openDrawer(null)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003876] text-white text-xs font-medium hover:bg-[#002855] transition-all">
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            )}
          </div>
        </div>
        {data.reasons.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Nenhum motivo cadastrado.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {data.reasons.map((r) => {
              const iconOpt = REASON_ICON_OPTIONS.find((o) => o.key === (r.icon || 'MessageSquare'));
              const IconComp = iconOpt?.Icon ?? MessageSquare;
              return (
                <button key={r.key} onClick={() => openDrawer(r.key)} className="flex items-center gap-3 px-3 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-[#003876]/50 hover:shadow-sm transition-all text-left group">
                  <div className="w-9 h-9 rounded-xl bg-[#003876]/8 dark:bg-[#003876]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#003876]/15 transition-colors">
                    <IconComp className="w-[18px] h-[18px] text-[#003876] dark:text-[#ffd700]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight">{r.label}</p>
                    {r.lead_integrated && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#003876]/10 text-[#003876] dark:text-[#ffd700] mt-1 inline-block">Lead</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating save */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-[#003876] text-white hover:bg-[#002855] shadow-[#003876]/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* Reason Drawer */}
      {drawerOpen && drawerDraft && (() => {
        const d = drawerDraft;
        return (
          <>
            <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40" onClick={closeDrawer} />
            <div className="fixed right-0 top-0 h-full w-[400px] max-w-full bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                  {drawerIsNew ? 'Novo motivo' : 'Editar motivo'}
                </h3>
                <div className="flex items-center gap-1">
                  {!drawerIsNew && (
                    <button onClick={() => { removeReason(d.key); closeDrawer(); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Excluir motivo">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={closeDrawer} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Nome</label>
                  <input type="text" value={d.label} onChange={(e) => setDrawerDraft((prev) => prev ? { ...prev, label: e.target.value } : prev)} placeholder="Nome do motivo" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Ícone</p>
                  <div className="grid grid-cols-8 gap-1.5">
                    {REASON_ICON_OPTIONS.map(({ key: iconKey, label: iconLabel, Icon: IconComp }) => {
                      const isSelected = (d.icon || 'MessageSquare') === iconKey;
                      return (
                        <button key={iconKey} onClick={() => setDrawerDraft((prev) => prev ? { ...prev, icon: iconKey } : prev)} title={iconLabel} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-[#003876] text-white shadow-sm ring-2 ring-[#003876]/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-[#003876]/10 hover:text-[#003876] dark:hover:text-[#ffd700]'}`}>
                          <IconComp className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Detalhe obrigatório</p>
                    <p className="text-xs text-gray-400 mt-0.5">Exige preenchimento do campo de mensagem</p>
                  </div>
                  <button
                    onClick={() => setDrawerDraft((prev) => prev ? { ...prev, require_message: !prev.require_message } : prev)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/50 ${d.require_message ? 'bg-[#003876]' : 'bg-gray-200 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${d.require_message ? 'translate-x-6' : 'translate-x-0'}`}>
                      {d.require_message && <Check className="w-3 h-3 text-[#003876]" strokeWidth={3} />}
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Integrar com Gestão de Leads</p>
                    <p className="text-xs text-gray-400 mt-0.5">Cria um lead automaticamente ao receber este contato</p>
                  </div>
                  <button
                    onClick={() => setDrawerDraft((prev) => prev ? { ...prev, lead_integrated: !prev.lead_integrated } : prev)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/50 ${d.lead_integrated ? 'bg-[#003876]' : 'bg-gray-200 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${d.lead_integrated ? 'translate-x-6' : 'translate-x-0'}`}>
                      {d.lead_integrated && <Check className="w-3 h-3 text-[#003876]" strokeWidth={3} />}
                    </span>
                  </button>
                </div>
              </div>
              <div className="px-5 py-4 pb-8 border-t border-gray-100 dark:border-gray-700">
                <button onClick={saveDrawer} disabled={!d.label.trim()} className="w-full py-2.5 rounded-xl bg-[#003876] text-white text-sm font-semibold hover:bg-[#002855] disabled:opacity-40 transition-all">
                  {drawerIsNew ? 'Adicionar motivo' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </>
        );
      })()}
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
