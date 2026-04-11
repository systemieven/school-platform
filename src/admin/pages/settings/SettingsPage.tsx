import { useEffect, useState, useMemo } from 'react';
import AppearanceSettingsPanel from './AppearanceSettingsPanel';
import AttendanceSettingsPanel from './AttendanceSettingsPanel';
import GeolocationField from '../../components/GeolocationField';
import { SettingsCard } from '../../components/SettingsCard';
import { supabase } from '../../../lib/supabase';
import { getProviders, setDefaultProvider, registerWebhook, WEBHOOK_FUNCTION_BASE } from '../../lib/whatsapp-api';
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
  PanelLeftClose, PanelLeftOpen, Plus, Star, Pencil, Plug,
  LayoutTemplate, Send, X, MapPin, Search,
  // panels
  BookOpen, BookMarked, Calendar, ClipboardList, PenLine, Briefcase, Heart,
  Phone, Mail, Home, HelpCircle, Award, UserCheck, Handshake, Baby, Bus,
  Users, User, FileText, Trash2,
  CalendarX2, Clock, ChevronDown, ChevronUp,
  Shield, CheckCircle2, TriangleAlert, Share2, Ticket, Instagram,
} from 'lucide-react';
import SecuritySettingsPanel from './SecuritySettingsPanel';

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
    key: 'attendance',
    label: 'Atendimentos',
    shortLabel: 'Atendimentos',
    icon: Ticket,
    categories: ['attendance'],
    description: 'Regras de elegibilidade, formato de senha, sons, tela do cliente e feedback.',
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
  {
    key: 'security',
    label: 'Segurança',
    shortLabel: 'Segurança',
    icon: Shield,
    categories: ['security'],
    description: 'Defina critérios de senhas, tempo de vida e reutilização.',
  },
];

// ── Field metadata ───────────────────────────────────────────────────────────
const KEY_META: Record<string, { label: string; placeholder?: string; secret?: boolean; multiline?: boolean; type?: 'text' | 'boolean' | 'number' | 'time' | 'color' }> = {
  // general
  school_name:    { label: 'Nome da Instituição', placeholder: 'Ex: Colégio Batista em Caruaru' },
  cnpj:           { label: 'CNPJ', placeholder: '00.000.000/0000-00' },
  // address is rendered by AddressField — kept here as fallback only
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
  max_per_slot:     { label: 'Máx. Visitas por Slot', placeholder: '2', type: 'number' },
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

  // Tabs with their own custom panel never depend on the generic settings array
  const CUSTOM_PANEL_TABS = ['whatsapp', 'visits', 'enrollment', 'contact', 'appearance', 'security', 'institutional', 'attendance'];

  // Tabs that have settings in the DB OR have a custom panel
  const availableTabs = TABS.filter(
    (tab) =>
      CUSTOM_PANEL_TABS.includes(tab.key) ||
      settings.some((s) => tab.categories.includes(s.category)),
  );

  // Tabs without settings yet (show as "coming soon")
  const emptyTabs = TABS.filter(
    (tab) =>
      !CUSTOM_PANEL_TABS.includes(tab.key) &&
      !settings.some((s) => tab.categories.includes(s.category)),
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

              {/* Save button removed from header — generic tabs now use floating save below */}
            </div>

            {/* Fields */}
            <div className={['whatsapp', 'visits', 'enrollment', 'contact', 'appearance', 'institutional', 'security', 'attendance', 'notifications'].includes(activeTab) ? '' : 'p-6'}>
              {activeTab === 'whatsapp' ? (
                <WhatsAppSettingsPanel />
              ) : activeTab === 'visits' ? (
                <AppointmentsSettingsPanel />
              ) : activeTab === 'attendance' ? (
                <AttendanceSettingsPanel />
              ) : activeTab === 'enrollment' ? (
                <EnrollmentSettingsPanel />
              ) : activeTab === 'contact' ? (
                <ContactSettingsPanel />
              ) : activeTab === 'appearance' ? (
                <AppearanceSettingsPanel />
              ) : activeTab === 'security' ? (
                <SecuritySettingsPanel />
              ) : activeTab === 'institutional' ? (
                <InstitutionalSettingsPanel
                  settings={tabSettings}
                  editValues={editValues}
                  toStr={toStr}
                  onChange={(id, val) => setEditValues((prev) => ({ ...prev, [id]: val }))}
                  onSave={handleSave}
                  saving={saving}
                  saved={saved}
                  hasChanges={tabHasChanges}
                />
              ) : activeTab === 'notifications' ? (
                <NotificationsPanel
                  settings={tabSettings.filter((s) => s.key !== 'reminder_hours_before')}
                  editValues={editValues}
                  toStr={toStr}
                  onChange={(id, val) => setEditValues((prev) => ({ ...prev, [id]: val }))}
                />
              ) : tabSettings.length === 0 ? (
                <EmptyTabState tab={currentTab} />
              ) : (
                <SettingsFieldGroup
                  settings={tabSettings}
                  editValues={editValues}
                  toStr={toStr}
                  onChange={(id, val) =>
                    setEditValues((prev) => ({ ...prev, [id]: val }))
                  }
                />
              )}
            </div>
          </div>

          {/* Floating save — generic tabs (notifications, etc.) */}
          {!['whatsapp', 'visits', 'enrollment', 'contact', 'appearance', 'security', 'institutional', 'attendance'].includes(activeTab) && (
            <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
              tabHasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
            }`}>
              <button
                onClick={handleSave}
                disabled={!tabHasChanges || saving}
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
          )}
        </div>
      </div>
    </div>
  );
}


// ── Address field ─────────────────────────────────────────────────────────────

interface AddressData {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const EMPTY_ADDR: AddressData = { cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '' };

function parseAddressValue(v: string): AddressData {
  try {
    const obj = JSON.parse(v);
    if (obj && typeof obj === 'object' && ('rua' in obj || 'cep' in obj)) {
      return { ...EMPTY_ADDR, ...obj };
    }
  } catch { /* not JSON */ }
  // Legacy plain string — put it all in rua
  return { ...EMPTY_ADDR, rua: v };
}

function AddressField({
  value,
  savedValue,
  onChange,
}: {
  value: string;
  savedValue: string;
  onChange: (v: string) => void;
}) {
  const [addr, setAddr] = useState<AddressData>(() => parseAddressValue(value));
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError,   setCepError]   = useState<string | null>(null);

  // Re-sync when parent resets (e.g. after save)
  useEffect(() => {
    setAddr(parseAddressValue(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedValue]);

  function update(field: keyof AddressData, val: string) {
    const next = { ...addr, [field]: val };
    setAddr(next);
    onChange(JSON.stringify(next));
  }

  async function lookupCep(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError(null);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as Record<string, string>;
      if (data.erro) { setCepError('CEP não encontrado'); return; }
      const next: AddressData = {
        ...addr,
        cep:    raw,
        rua:    data.logradouro || addr.rua,
        bairro: data.bairro     || addr.bairro,
        cidade: data.localidade || addr.cidade,
        estado: data.uf         || addr.estado,
      };
      setAddr(next);
      onChange(JSON.stringify(next));
    } catch {
      setCepError('Erro ao consultar CEP. Tente novamente.');
    } finally {
      setCepLoading(false);
    }
  }

  const inputCls = (field: keyof AddressData) => {
    const saved = parseAddressValue(savedValue);
    const changed = addr[field] !== saved[field];
    return `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all
      bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
      placeholder:text-gray-400 dark:placeholder:text-gray-500
      ${changed
        ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10 focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20'
        : 'border-gray-200 dark:border-gray-600 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 dark:focus:ring-[#ffd700]/20'
      }`;
  };

  return (
    <div className="space-y-3">
      {/* CEP */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">CEP</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={addr.cep}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 8);
              const formatted = v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v;
              update('cep', formatted);
              if (v.length === 8) lookupCep(formatted);
            }}
            placeholder="00000-000"
            maxLength={9}
            className={inputCls('cep')}
          />
          <button
            type="button"
            onClick={() => lookupCep(addr.cep)}
            disabled={cepLoading || addr.cep.replace(/\D/g,'').length !== 8}
            title="Consultar CEP"
            className="flex-shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:border-[#003876] dark:hover:border-[#ffd700] transition-colors disabled:opacity-40"
          >
            {cepLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />}
          </button>
        </div>
        {cepError && <p className="text-xs text-red-500 mt-1">{cepError}</p>}
      </div>

      {/* Rua + Número */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Rua / Logradouro</label>
          <input
            type="text"
            value={addr.rua}
            onChange={(e) => update('rua', e.target.value)}
            placeholder="Ex: Rua Marcílio Dias"
            className={inputCls('rua')}
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Número</label>
          <input
            type="text"
            value={addr.numero}
            onChange={(e) => update('numero', e.target.value)}
            placeholder="Ex: 99"
            className={inputCls('numero')}
          />
        </div>
      </div>

      {/* Bairro + Cidade + Estado */}
      <div className="grid grid-cols-[1fr_1fr_80px] gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bairro</label>
          <input
            type="text"
            value={addr.bairro}
            onChange={(e) => update('bairro', e.target.value)}
            placeholder="Ex: São Francisco"
            className={inputCls('bairro')}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cidade</label>
          <input
            type="text"
            value={addr.cidade}
            onChange={(e) => update('cidade', e.target.value)}
            placeholder="Ex: Caruaru"
            className={inputCls('cidade')}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estado</label>
          <input
            type="text"
            value={addr.estado}
            onChange={(e) => update('estado', e.target.value.toUpperCase().slice(0, 2))}
            placeholder="PE"
            maxLength={2}
            className={inputCls('estado')}
          />
        </div>
      </div>

      {/* Preview */}
      {(addr.rua || addr.cidade) && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5 pt-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {[
            addr.rua,
            addr.numero && `, ${addr.numero}`,
            addr.bairro && ` - ${addr.bairro}`,
            addr.cidade && `, ${addr.cidade}`,
            addr.estado && `/${addr.estado}`,
          ].filter(Boolean).join('')}
        </p>
      )}
    </div>
  );
}

// ── Business Hours Field ──────────────────────────────────────────────────────
// Suporta 1 ou 2 intervalos por dia. Quando há 2 intervalos, o espaço entre eles
// é, por consequência, o intervalo de almoço (ou qualquer outra pausa).
// Fonte de verdade única para horário da instituição — o módulo de agendamentos
// passou a derivar tudo daqui (start/end/almoço por dia) ao invés de manter
// uma cópia separada em visit.start_hour/etc.
const WEEKDAYS_BH = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface BHInterval { start: string; end: string }
export interface DaySchedule { open: boolean; intervals: BHInterval[] }
export type BusinessHoursData = Record<string, DaySchedule>;

const DEFAULT_INTERVAL: BHInterval = { start: '07:00', end: '17:00' };
const DEFAULT_DAY: DaySchedule = { open: false, intervals: [{ ...DEFAULT_INTERVAL }] };
const MAX_BH_INTERVALS = 2;

/** Aceita tanto o shape novo (`intervals`) quanto o legado (`start`/`end`). */
export function parseBusinessHours(v: string | unknown): BusinessHoursData {
  let obj: unknown = v;
  if (typeof v === 'string') {
    try { obj = JSON.parse(v); } catch { obj = null; }
  }
  const result: BusinessHoursData = {};
  if (obj && typeof obj === 'object') {
    const rec = obj as Record<string, unknown>;
    for (let i = 0; i < 7; i++) {
      const d = rec[String(i)];
      if (d && typeof d === 'object') {
        const day = d as { open?: boolean; intervals?: unknown; start?: string; end?: string };
        let intervals: BHInterval[] = [];
        if (Array.isArray(day.intervals)) {
          intervals = (day.intervals as Array<Record<string, unknown>>)
            .filter((it) => typeof it.start === 'string' && typeof it.end === 'string')
            .slice(0, MAX_BH_INTERVALS)
            .map((it) => ({ start: String(it.start), end: String(it.end) }));
        }
        if (intervals.length === 0 && typeof day.start === 'string' && typeof day.end === 'string') {
          // Legacy single-interval shape.
          intervals = [{ start: day.start, end: day.end }];
        }
        if (intervals.length === 0) intervals = [{ ...DEFAULT_INTERVAL }];
        result[String(i)] = { open: Boolean(day.open), intervals };
      } else {
        result[String(i)] = { ...DEFAULT_DAY, intervals: [{ ...DEFAULT_INTERVAL }] };
      }
    }
    return result;
  }
  for (let i = 0; i < 7; i++) {
    result[String(i)] = { open: i >= 1 && i <= 5, intervals: [{ ...DEFAULT_INTERVAL }] };
  }
  return result;
}

/** True se os dois intervalos se sobrepõem. */
function bhIntervalsOverlap(a: BHInterval, b: BHInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

// Faixa fixa do trilho do slider de horários (rail). Cobre o espectro útil
// para qualquer instituição (madrugada → noite) sem deixar a UI cheia demais.
const BH_RAIL_START = '05:00';
const BH_RAIL_END   = '23:00';
const BH_STEP_MIN   = 15;

function BusinessHoursField({ value, savedValue, onChange }: {
  value: string;
  savedValue: string;
  onChange: (v: string) => void;
}) {
  const [hours, setHours] = useState<BusinessHoursData>(() => parseBusinessHours(value));

  useEffect(() => {
    setHours(parseBusinessHours(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedValue]);

  function commit(next: BusinessHoursData) {
    setHours(next);
    onChange(JSON.stringify(next));
  }

  function updateDay(idx: number, patch: Partial<DaySchedule>) {
    commit({ ...hours, [String(idx)]: { ...hours[String(idx)], ...patch } });
  }

  // Atualiza ambos os campos (start, end) de uma vez — formato exigido pelo
  // TimeRangeSlider — rejeitando sobreposição com o outro intervalo do dia.
  function updateIntervalRange(dayIdx: number, intervalIdx: number, start: string, end: string) {
    const day = hours[String(dayIdx)];
    if (!day) return;
    if (start >= end) return;
    const candidate: BHInterval = { start, end };
    const others = day.intervals.filter((_, i) => i !== intervalIdx);
    if (others.some((o) => bhIntervalsOverlap(candidate, o))) return;
    const nextIntervals = day.intervals.map((it, i) => (i === intervalIdx ? candidate : it));
    updateDay(dayIdx, { intervals: nextIntervals });
  }

  function addInterval(dayIdx: number) {
    const day = hours[String(dayIdx)];
    if (!day || day.intervals.length >= MAX_BH_INTERVALS) return;
    const existing = day.intervals[0];
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const existEndMin = toMin(existing.end);
    const existStartMin = toMin(existing.start);
    const railEndMin = toMin(BH_RAIL_END);
    const railStartMin = toMin(BH_RAIL_START);
    // Tenta criar um intervalo confortável depois do existente; se não couber,
    // tenta antes; em último caso, usa um fallback fixo.
    let candidate: BHInterval;
    if (existEndMin + 90 <= railEndMin) {
      candidate = { start: toTime(existEndMin + 90), end: toTime(Math.min(existEndMin + 90 + 180, railEndMin)) };
    } else if (existStartMin - 90 >= railStartMin) {
      candidate = { start: toTime(Math.max(existStartMin - 180, railStartMin)), end: toTime(existStartMin - 90) };
    } else {
      candidate = { start: '13:30', end: '17:00' };
    }
    if (bhIntervalsOverlap(candidate, existing)) return;
    const next = [...day.intervals, candidate].sort((a, b) => a.start.localeCompare(b.start));
    updateDay(dayIdx, { intervals: next });
  }

  function removeInterval(dayIdx: number, intervalIdx: number) {
    const day = hours[String(dayIdx)];
    if (!day || day.intervals.length <= 1) return;
    updateDay(dayIdx, { intervals: day.intervals.filter((_, i) => i !== intervalIdx) });
  }

  const savedHours = parseBusinessHours(savedValue);

  function intervalChanged(dayIdx: number, intervalIdx: number): boolean {
    const cur = hours[String(dayIdx)]?.intervals?.[intervalIdx];
    const sav = savedHours[String(dayIdx)]?.intervals?.[intervalIdx];
    if (!cur || !sav) return Boolean(cur) !== Boolean(sav);
    return cur.start !== sav.start || cur.end !== sav.end;
  }

  return (
    <div className="space-y-4">
      {/* Day toggle pills */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Dias abertos</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS_BH.map((name, idx) => {
            const isOpen = hours[String(idx)]?.open;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => updateDay(idx, { open: !isOpen })}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                  isOpen
                    ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#003876]/40 hover:text-[#003876]'
                }`}
              >
                {isOpen && <Check className="w-3 h-3" />}
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Intervalos por dia aberto — slider com até 2 intervalos */}
      {Array.from({ length: 7 }, (_, idx) => {
        const day = hours[String(idx)];
        if (!day?.open) return null;
        const canAdd = day.intervals.length < MAX_BH_INTERVALS;
        return (
          <div key={idx} className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#003876] dark:text-[#ffd700]">
                  {WEEKDAYS_BH[idx]}
                </span>
                <span className="text-[10px] text-gray-400">
                  {day.intervals.length}/{MAX_BH_INTERVALS} intervalo{day.intervals.length > 1 ? 's' : ''}
                </span>
              </div>
              {canAdd && (
                <button
                  type="button"
                  onClick={() => addInterval(idx)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#003876] text-white text-[11px] font-semibold hover:bg-[#002855] transition-all"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar
                </button>
              )}
            </div>
            <div className="space-y-3">
              {day.intervals.map((it, iidx) => {
                const changed = intervalChanged(idx, iidx);
                return (
                  <div
                    key={iidx}
                    className={`rounded-xl border p-3 transition-all ${
                      changed
                        ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10'
                        : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Intervalo {iidx + 1}
                      </span>
                      {day.intervals.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInterval(idx, iidx)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Remover intervalo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <TimeRangeSlider
                      workStart={BH_RAIL_START}
                      workEnd={BH_RAIL_END}
                      lunchStart="00:00"
                      lunchEnd="00:00"
                      valueStart={it.start}
                      valueEnd={it.end}
                      stepMin={BH_STEP_MIN}
                      onChange={(start, end) => updateIntervalRange(idx, iidx, start, end)}
                    />
                  </div>
                );
              })}
            </div>
            {day.intervals.length === MAX_BH_INTERVALS && (
              <p className="text-[10px] text-gray-400 mt-2">
                O espaço entre os dois intervalos funciona como pausa (almoço).
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Social Networks Field ─────────────────────────────────────────────────────
type NetworkKey = 'instagram' | 'facebook' | 'whatsapp' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';

interface SocialEntry { id: number; network: string; handle: string; message?: string }

const NETWORK_CONFIGS: Record<NetworkKey, { label: string; color: string; placeholder: string; handleLabel: string; icon: (props: { size?: number; className?: string }) => React.ReactNode }> = {
  instagram: { label: 'Instagram', color: '#E1306C', placeholder: 'colegiobatista',   handleLabel: 'Perfil (sem @)',
    icon: ({ size = 16, className }) => <Instagram size={size} className={className} /> },
  facebook:  { label: 'Facebook',  color: '#1877F2', placeholder: 'colegiobatista',   handleLabel: 'Página ou perfil',
    icon: ({ size = 16, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  whatsapp:  { label: 'WhatsApp',  color: '#25D366', placeholder: '5581991398203',    handleLabel: 'Número (com DDI, sem +)',
    icon: ({ size = 16, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> },
  twitter:   { label: 'Twitter/X', color: '#000000', placeholder: 'colegiobatista',   handleLabel: 'Perfil (sem @)',
    icon: ({ size = 16, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', placeholder: 'colegio-batista',  handleLabel: 'Empresa (slug)',
    icon: ({ size = 16, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  youtube:   { label: 'YouTube',   color: '#FF0000', placeholder: 'colegiobatista',   handleLabel: 'Canal (sem @)',
    icon: ({ size = 16, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
  tiktok:    { label: 'TikTok',    color: '#010101', placeholder: 'colegiobatista',   handleLabel: 'Perfil (sem @)',
    icon: ({ size = 16, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg> },
};

const ALL_NETWORKS = Object.keys(NETWORK_CONFIGS) as NetworkKey[];

function parseSocialNetworks(v: string): SocialEntry[] {
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr)) return arr as SocialEntry[];
  } catch { /* not JSON */ }
  return [];
}

function NetworkBadge({ network }: { network: string }) {
  const cfg = NETWORK_CONFIGS[network as NetworkKey];
  if (!cfg) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-400 text-white text-[10px] font-bold">?</span>;
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white flex-shrink-0"
      style={{ backgroundColor: cfg.color }}
    >
      {cfg.icon({ size: 14, className: 'text-white' })}
    </span>
  );
}

function SocialNetworksField({ value, savedValue, onChange }: {
  value: string;
  savedValue: string;
  onChange: (v: string) => void;
}) {
  const [entries,   setEntries]   = useState<SocialEntry[]>(() => parseSocialNetworks(value));
  const [adding,    setAdding]    = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ network: NetworkKey; handle: string; message: string }>({
    network: 'instagram', handle: '', message: '',
  });

  useEffect(() => {
    setEntries(parseSocialNetworks(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedValue]);

  function commit(next: SocialEntry[]) {
    setEntries(next);
    onChange(JSON.stringify(next));
  }

  function cancelForm() {
    setAdding(false);
    setEditingId(null);
    setDraft({ network: 'instagram', handle: '', message: '' });
  }

  function openEdit(entry: SocialEntry) {
    setAdding(false);
    setDraft({ network: entry.network as NetworkKey, handle: entry.handle, message: entry.message || '' });
    setEditingId(entry.id);
  }

  function submitAdd() {
    const h = draft.handle.trim().replace(/^@/, '');
    if (!h) return;
    commit([...entries, {
      id: Date.now(),
      network: draft.network,
      handle: h,
      ...(draft.network === 'whatsapp' && draft.message.trim() ? { message: draft.message.trim() } : {}),
    }]);
    cancelForm();
  }

  function submitEdit() {
    const h = draft.handle.trim().replace(/^@/, '');
    if (!h || editingId === null) return;
    commit(entries.map((e) => e.id !== editingId ? e : {
      ...e,
      network: draft.network,
      handle: h,
      message: draft.network === 'whatsapp' && draft.message.trim() ? draft.message.trim() : undefined,
    }));
    cancelForm();
  }

  // Shared form markup (used for both add and edit)
  const networkForm = (isEdit: boolean) => (
    <div className="p-4 rounded-xl border border-[#003876]/20 bg-[#003876]/5 dark:bg-[#003876]/10 space-y-3">
      {/* Network selector */}
      <div className="grid grid-cols-4 gap-2">
        {ALL_NETWORKS.map((key) => {
          const cfg = NETWORK_CONFIGS[key];
          const selected = draft.network === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, network: key }))}
              className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-[11px] font-medium transition-all ${
                selected
                  ? 'border-[#003876] bg-[#003876] text-white shadow-md'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white"
                style={{ backgroundColor: selected ? 'rgba(255,255,255,0.25)' : cfg.color }}
              >
                {cfg.icon({ size: 14, className: 'text-white' })}
              </span>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Handle input */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          {NETWORK_CONFIGS[draft.network].handleLabel}
        </label>
        <input
          type="text"
          value={draft.handle}
          onChange={(e) => setDraft((d) => ({ ...d, handle: e.target.value }))}
          placeholder={NETWORK_CONFIGS[draft.network].placeholder}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20"
        />
      </div>

      {/* WhatsApp message */}
      {draft.network === 'whatsapp' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Mensagem inicial (opcional)
          </label>
          <input
            type="text"
            value={draft.message}
            onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
            placeholder="Olá, vim do site e gostaria de saber mais informações"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20"
          />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={cancelForm}
          className="px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={isEdit ? submitEdit : submitAdd}
          disabled={!draft.handle.trim()}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-40 transition-colors"
        >
          {isEdit ? 'Salvar alterações' : 'Adicionar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Entry list — card or inline edit form */}
      {entries.map((entry) => {
        if (editingId === entry.id) return <div key={entry.id}>{networkForm(true)}</div>;

        const cfg = NETWORK_CONFIGS[entry.network as NetworkKey];
        return (
          <div
            key={entry.id}
            onClick={() => openEdit(entry)}
            className="group flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-[#003876]/30 dark:hover:border-[#ffd700]/30 hover:bg-gray-100/80 dark:hover:bg-gray-900/60 transition-all"
          >
            <NetworkBadge network={entry.network} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-tight">{cfg?.label || entry.network}</p>
              <p className="text-xs text-gray-400 truncate">
                {entry.network === 'whatsapp' ? entry.handle : `@${entry.handle}`}
              </p>
              {entry.message && (
                <p className="text-xs text-gray-400 italic truncate mt-0.5">"{entry.message}"</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Pencil className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); commit(entries.filter((en) => en.id !== entry.id)); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Add form or add button (hidden while editing an existing entry) */}
      {editingId === null && (
        adding ? networkForm(false) : (
          <button
            type="button"
            onClick={() => { setDraft({ network: 'instagram', handle: '', message: '' }); setAdding(true); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:border-[#003876] dark:hover:border-[#ffd700] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar rede social
          </button>
        )
      )}
    </div>
  );
}

// ── Institutional Settings Panel ─────────────────────────────────────────────
const INST_GROUPS: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  keys: string[];
  inlineKeys?: string[]; // pairs rendered side-by-side
}[] = [
  {
    title: 'Identificação',
    icon: Building2,
    keys: ['school_name', 'cnpj'],
  },
  {
    title: 'Horário de Funcionamento',
    icon: Clock,
    keys: ['business_hours'],
  },
  {
    title: 'Localização',
    icon: MapPin,
    keys: ['address', 'whatsapp', 'geolocation'],
  },
  {
    title: 'Contato',
    icon: Phone,
    keys: ['phone', 'email'],
    inlineKeys: ['phone', 'email'],
  },
  {
    title: 'Redes Sociais',
    icon: Share2,
    keys: ['social_networks'],
  },
  {
    title: 'Identidade Visual',
    subtitle: 'URL pública do logotipo exibido no site e nos documentos gerados.',
    icon: Palette,
    keys: ['logo_url'],
  },
];

function InstitutionalSettingsPanel({ settings, editValues, toStr, onChange, onSave, saving, saved, hasChanges }: {
  settings: SystemSetting[];
  editValues: Record<string, string>;
  toStr: (v: unknown) => string;
  onChange: (id: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  hasChanges: boolean;
}) {
  const byKey = Object.fromEntries(settings.map((s) => [s.key, s]));

  return (
    <div className="p-6 space-y-5">
      {INST_GROUPS.map((group) => {
        const GroupIcon = group.icon;
        const groupItems = group.keys.map((k) => byKey[k]).filter(Boolean);
        if (groupItems.length === 0) return null;

        const collapseId = `institucional.${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        return (
          <SettingsCard
            key={group.title}
            collapseId={collapseId}
            title={group.title}
            icon={GroupIcon}
            description={group.subtitle}
            bodyClassName="!space-y-5"
          >
              {/* Inline group: render all keys side-by-side in one row */}
              {group.inlineKeys ? (
                <div className="grid grid-cols-2 gap-4">
                  {groupItems.map((item) => {
                    const meta = KEY_META[item.key] || { label: item.key };
                    const isChanged = editValues[item.id] !== toStr(item.value);
                    return (
                      <SettingField
                        key={item.id}
                        item={item}
                        meta={meta}
                        value={editValues[item.id] || ''}
                        isChanged={isChanged}
                        hideDescription
                        onChange={(val) => onChange(item.id, val)}
                      />
                    );
                  })}
                </div>
              ) : groupItems.map((item) => {
                // Address gets a dedicated structured field
                if (item.key === 'address') {
                  const savedStr = toStr(item.value);
                  const isChanged = editValues[item.id] !== savedStr;
                  return (
                    <div key={item.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Endereço</label>
                        {isChanged && (
                          <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                            Alterado
                          </span>
                        )}
                      </div>
                      <AddressField
                        value={editValues[item.id] || ''}
                        savedValue={savedStr}
                        onChange={(v) => onChange(item.id, v)}
                      />
                    </div>
                  );
                }

                // Business hours gets a dedicated schedule field
                if (item.key === 'business_hours') {
                  const savedStr = toStr(item.value);
                  const isChanged = editValues[item.id] !== savedStr;
                  return (
                    <div key={item.id}>
                      {isChanged && (
                        <div className="flex justify-end mb-2">
                          <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                            Alterado
                          </span>
                        </div>
                      )}
                      <BusinessHoursField
                        value={editValues[item.id] || ''}
                        savedValue={savedStr}
                        onChange={(v) => onChange(item.id, v)}
                      />
                    </div>
                  );
                }

                // Geolocation gets a dedicated field with map + geocode button
                if (item.key === 'geolocation') {
                  const savedStr = toStr(item.value);
                  const isChanged = editValues[item.id] !== savedStr;
                  const addressSetting = byKey['address'];
                  const addressJson = addressSetting ? (editValues[addressSetting.id] ?? toStr(addressSetting.value)) : '';
                  return (
                    <div key={item.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Geolocalização da instituição</label>
                        {isChanged && (
                          <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                            Alterado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        Coordenadas e raio usados pelo módulo de atendimentos para validar o check-in presencial.
                      </p>
                      <GeolocationField
                        value={editValues[item.id] || ''}
                        savedValue={savedStr}
                        addressJson={addressJson}
                        onChange={(v) => onChange(item.id, v)}
                      />
                    </div>
                  );
                }

                // Social networks gets a dynamic list field
                if (item.key === 'social_networks') {
                  const savedStr = toStr(item.value);
                  const isChanged = editValues[item.id] !== savedStr;
                  return (
                    <div key={item.id}>
                      {isChanged && (
                        <div className="flex justify-end mb-2">
                          <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                            Alterado
                          </span>
                        </div>
                      )}
                      <SocialNetworksField
                        value={editValues[item.id] || ''}
                        savedValue={savedStr}
                        onChange={(v) => onChange(item.id, v)}
                      />
                    </div>
                  );
                }

                const meta = KEY_META[item.key] || { label: item.key };
                const isChanged = editValues[item.id] !== toStr(item.value);
                return (
                  <SettingField
                    key={item.id}
                    item={item}
                    meta={meta}
                    value={editValues[item.id] || ''}
                    isChanged={isChanged}
                    hideDescription
                    onChange={(val) => onChange(item.id, val)}
                  />
                );
              })}
          </SettingsCard>
        );
      })}

      {/* Fields not in any group (safety net) */}
      {settings
        .filter((s) => !INST_GROUPS.flatMap((g) => g.keys).includes(s.key))
        .map((item) => {
          const meta = KEY_META[item.key] || { label: item.key };
          const isChanged = editValues[item.id] !== toStr(item.value);
          return (
            <SettingField
              key={item.id}
              item={item}
              meta={meta}
              value={editValues[item.id] || ''}
              isChanged={isChanged}
              onChange={(val) => onChange(item.id, val)}
            />
          );
        })}

      {/* Floating save */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={onSave}
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

// ── WhatsApp Settings Panel (sub-tabbed) ─────────────────────────────────────

type WaSubTab = 'apis' | 'templates' | 'historico';

const WA_SUB_TABS: { key: WaSubTab; label: string; icon: React.ElementType }[] = [
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'historico', label: 'Histórico', icon: Send           },
  { key: 'apis',      label: 'APIs',      icon: Wifi          },
];

function WhatsAppSettingsPanel() {
  const [sub, setSub] = useState<WaSubTab>('templates');

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1.5 px-6 pt-5 pb-1">
        {WA_SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={[
              'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all duration-200',
              sub === key
                ? 'bg-[#ffd700] text-[#003876] shadow-md shadow-[#ffd700]/20'
                : 'text-[#003876] dark:text-[#ffd700] hover:bg-[#003876]/10 dark:hover:bg-[#ffd700]/10',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" />
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
          <div className="flex items-center gap-2 text-gray-400 text-sm py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando provedores…
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum provedor cadastrado ainda.</p>
            <p className="text-xs mt-1 text-gray-400">Cadastre uma instância WhatsApp para começar a enviar mensagens.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {providers.map((p) => {
            const isDefault = p.is_default;
            const isSettingThis = settingDefault === p.id;
            const statusDot = isDefault
              ? waState === 'connected'    ? 'bg-emerald-400'
                : waState === 'connecting' ? 'bg-amber-400 animate-pulse'
                : 'bg-red-400'
              : 'bg-gray-300 dark:bg-gray-500';
            const statusLabel = isDefault
              ? waState === 'connected'    ? `Conectado · +${waPhone}`
                : waState === 'connecting' ? 'Conectando…'
                : waState === 'unknown'    ? 'Verificando…'
                : 'Desconectado'
              : p.instance_url || 'Sem URL configurada';

            return (
              <div key={p.id} className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/60">
                {/* Card header */}
                <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{p.name}</span>
                    {isDefault && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase text-[#003876] dark:text-[#ffd700] bg-[#003876]/10 dark:bg-[#ffd700]/10 px-2 py-0.5 rounded-full flex-shrink-0">
                        <Star className="w-2.5 h-2.5" /> Padrão
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleEdit(p)}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:border-[#ffd700] dark:hover:text-[#ffd700] transition-colors flex-shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>
                </div>

                {/* Card body */}
                <div className="bg-white dark:bg-gray-800/20 px-5 py-4 flex items-center justify-between gap-4">
                  <p className="text-xs text-gray-400 truncate">{statusLabel}</p>
                  {!isDefault && (
                    <button
                      onClick={() => handleSetDefault(p.id)}
                      disabled={isSettingThis}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:border-[#ffd700] dark:hover:text-[#ffd700] disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {isSettingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                      Definir padrão
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}

        {/* Add new */}
        <div className="flex items-center gap-4 pt-1">
          <div className="flex-1 border-t border-gray-100 dark:border-gray-700" />
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#003876] text-white text-xs font-medium hover:bg-[#002855] transition-all flex-shrink-0"
          >
            <Plug className="w-3.5 h-3.5" />
            Adicionar API
          </button>
        </div>
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
  hideDescription?: boolean;
}

function SettingField({ item, meta, value, isChanged, onChange, hideDescription }: SettingFieldProps) {
  const [showSecret, setShowSecret] = useState(false);

  // Connection status special rendering
  if (item.key === 'connected') {
    const isConnected = value === 'true';
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{meta.label}</label>
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
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{meta.label}</label>
      {isChanged && (
        <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
          Alterado
        </span>
      )}
    </div>
  );

  const fieldDesc = (!hideDescription && item.description) ? (
    <p className="text-xs text-gray-400 mb-2">{item.description}</p>
  ) : null;

  // Boolean toggle
  if (meta.type === 'boolean') {
    const isOn = value === 'true';
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{meta.label}</p>
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

// ── Notifications Panel (card-style toggles) ────────────────────────────────
const NOTIF_CARD_META: Record<string, { desc: string; icon: React.ComponentType<{ className?: string }> }> = {
  admin_email_alerts:        { desc: 'Enviar alertas por e-mail para admins',              icon: Mail },
  auto_notify_on_contact:    { desc: 'Criar notificação interna ao receber novo contato',  icon: MessageSquare },
  auto_notify_on_enrollment: { desc: 'Criar notificação interna ao receber nova matrícula', icon: GraduationCap },
  auto_notify_on_visit:      { desc: 'Criar notificação interna ao receber novo agendamento', icon: CalendarCheck },
  notify_wa_connection:      { desc: 'Alertar quando a conexão do WhatsApp cair',          icon: Wifi },
};

function NotificationsPanel({ settings, editValues, toStr, onChange }: {
  settings: SystemSetting[];
  editValues: Record<string, string>;
  toStr: (v: unknown) => string;
  onChange: (id: string, val: string) => void;
}) {
  const booleanSettings = settings.filter((s) => (KEY_META[s.key] || {}).type === 'boolean');

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {booleanSettings.map((item) => {
          const meta = KEY_META[item.key] || { label: item.key };
          const cardMeta = NOTIF_CARD_META[item.key];
          const Icon = cardMeta?.icon || Bell;
          const desc = cardMeta?.desc || '';
          const currentVal = editValues[item.id] ?? toStr(item.value);
          const active = currentVal === 'true';
          const isChanged = editValues[item.id] !== toStr(item.value);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id, active ? 'false' : 'true')}
              className={[
                'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 relative',
                active
                  ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]',
              ].join(' ')}
            >
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-[#ffd700]' : 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                  {meta.label}
                </p>
                {desc && (
                  <p className={`text-[11px] mt-0.5 leading-tight ${active ? 'text-white/60' : 'text-gray-400'}`}>
                    {desc}
                  </p>
                )}
              </div>
              {isChanged && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
              )}
            </button>
          );
        })}
      </div>
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
    <div>
      {saving && (
        <div className="flex justify-end mb-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#003876]" />
        </div>
      )}

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

// ── Auto-Confirm Section ──────────────────────────────────────────────────

function AutoConfirmSection() {
  const [enabled, setEnabled]       = useState(false);
  const [positiveIds, setPositiveIds] = useState('sim, confirmar, yes');
  const [negativeIds, setNegativeIds] = useState('nao, cancelar, no');
  const [expiryHours, setExpiryHours] = useState('24');
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  // Webhook validation state
  const [webhookAlert, setWebhookAlert] = useState<'checking' | 'missing' | 'registering' | 'registered' | null>(null);
  const [webhookRegError, setWebhookRegError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('category', 'visit')
        .in('key', ['auto_confirm_enabled', 'auto_confirm_positive_ids', 'auto_confirm_negative_ids', 'auto_confirm_expiry_hours']);
      if (data) {
        for (const row of data as { key: string; value: unknown }[]) {
          const v = row.value;
          switch (row.key) {
            case 'auto_confirm_enabled':
              setEnabled(v === true || v === 'true' || v === '1');
              break;
            case 'auto_confirm_positive_ids': {
              const arr = Array.isArray(v) ? v : (() => { try { return JSON.parse(String(v)); } catch { return []; } })();
              if (Array.isArray(arr) && arr.length) setPositiveIds(arr.join(', '));
              break;
            }
            case 'auto_confirm_negative_ids': {
              const arr = Array.isArray(v) ? v : (() => { try { return JSON.parse(String(v)); } catch { return []; } })();
              if (Array.isArray(arr) && arr.length) setNegativeIds(arr.join(', '));
              break;
            }
            case 'auto_confirm_expiry_hours':
              setExpiryHours(String(typeof v === 'number' ? v : parseInt(String(v)) || 24));
              break;
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  async function saveSetting(key: string, value: unknown) {
    setSaving(true);
    await supabase
      .from('system_settings')
      .upsert(
        { category: 'visit', key, value, updated_at: new Date().toISOString() },
        { onConflict: 'category,key' },
      );
    setSaving(false);
  }

  /** Check if messages event is registered in the webhook */
  async function checkWebhookEvents(): Promise<boolean> {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'whatsapp')
      .eq('key', 'webhook_events')
      .maybeSingle();
    if (!data) return false;
    try {
      const events: string[] = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      return Array.isArray(events) && events.includes('messages');
    } catch { return false; }
  }

  /** Register webhook adding messages to current events */
  async function registerWithUpsert() {
    setWebhookAlert('registering');
    setWebhookRegError('');
    try {
      // Load current webhook settings
      const { data: rows } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('category', 'whatsapp')
        .in('key', ['webhook_secret', 'webhook_events']);

      let secret = '';
      let currentEvents: string[] = ['messages_update', 'connection'];
      for (const r of (rows || []) as { key: string; value: unknown }[]) {
        const v = typeof r.value === 'string' ? r.value : JSON.stringify(r.value);
        if (r.key === 'webhook_secret') secret = v.replace(/^"|"$/g, '');
        if (r.key === 'webhook_events') {
          try { currentEvents = JSON.parse(v); } catch { /* keep defaults */ }
        }
      }

      // Add messages if not present
      if (!currentEvents.includes('messages')) {
        currentEvents.push('messages');
      }

      // Build webhook URL
      const webhookUrl = secret
        ? `${WEBHOOK_FUNCTION_BASE}?secret=${encodeURIComponent(secret)}`
        : WEBHOOK_FUNCTION_BASE;

      const res = await registerWebhook(webhookUrl, currentEvents);
      if (res.success) {
        setWebhookAlert('registered');
        setTimeout(() => setWebhookAlert(null), 3000);
      } else {
        setWebhookRegError(res.error || 'Falha ao registrar webhook.');
        setWebhookAlert('missing');
      }
    } catch (err) {
      setWebhookRegError(err instanceof Error ? err.message : 'Erro inesperado.');
      setWebhookAlert('missing');
    }
  }

  async function handleToggle() {
    if (!enabled) {
      // Turning ON — check webhook first
      setWebhookAlert('checking');
      const hasUpsert = await checkWebhookEvents();
      if (!hasUpsert) {
        setWebhookAlert('missing');
        // Save as enabled regardless — user can register later
        setEnabled(true);
        saveSetting('auto_confirm_enabled', true);
        return;
      }
      setWebhookAlert(null);
    } else {
      setWebhookAlert(null);
    }
    const next = !enabled;
    setEnabled(next);
    saveSetting('auto_confirm_enabled', next);
  }

  function handleSaveIds(key: string, raw: string) {
    const arr = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    saveSetting(key, arr);
  }

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {saving && (
        <div className="flex justify-end">
          <Loader2 className="w-4 h-4 animate-spin text-[#003876]" />
        </div>
      )}

      {/* Toggle principal */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Ativar confirmação automática</p>
          <p className="text-xs text-gray-400 mt-0.5">Quando um template com botões é enviado como lembrete, o sistema rastreia a resposta e atualiza o status do agendamento.</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={webhookAlert === 'checking' || webhookAlert === 'registering'}
          className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/50 disabled:opacity-50 ${
            enabled ? 'bg-[#003876] dark:bg-[#ffd700]' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${
            enabled ? 'translate-x-6' : 'translate-x-0'
          }`}>
            {enabled && <Check className="w-3 h-3 text-[#003876] dark:text-[#003876]" strokeWidth={3} />}
          </span>
        </button>
      </div>

      {/* Webhook alert */}
      {webhookAlert === 'checking' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          Verificando configuração do webhook…
        </div>
      )}

      {webhookAlert === 'missing' && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-amber-50 dark:bg-amber-900/30 px-5 py-4 flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center">
                <TriangleAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Evento não registrado</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Configuração de webhook necessária</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                A confirmação automática depende do evento <strong>"Novas mensagens recebidas"</strong> (messages) estar habilitado no webhook da API WhatsApp.
                Atualmente este evento não está registrado.
              </p>
              {webhookRegError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">{webhookRegError}</p>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => setWebhookAlert(null)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Ignorar
              </button>
              <button
                onClick={registerWithUpsert}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Registrar evento agora
              </button>
            </div>
          </div>
        </div>
      )}

      {webhookAlert === 'registering' && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/10 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          Registrando evento messages no webhook…
        </div>
      )}

      {webhookAlert === 'registered' && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl px-4 py-3">
          <Check className="w-4 h-4 flex-shrink-0" />
          Webhook atualizado com sucesso! O evento messages está ativo.
        </div>
      )}

      {enabled && (
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          {/* IDs positivos */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">IDs de botão para confirmar</label>
            <input
              type="text"
              value={positiveIds}
              onChange={(e) => setPositiveIds(e.target.value)}
              onBlur={() => handleSaveIds('auto_confirm_positive_ids', positiveIds)}
              placeholder="sim, confirmar, yes"
              className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none focus:border-emerald-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">Separar por vírgula. Comparação case-insensitive com o ID do botão clicado.</p>
          </div>

          {/* IDs negativos */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">IDs de botão para cancelar</label>
            <input
              type="text"
              value={negativeIds}
              onChange={(e) => setNegativeIds(e.target.value)}
              onBlur={() => handleSaveIds('auto_confirm_negative_ids', negativeIds)}
              placeholder="nao, cancelar, no"
              className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none focus:border-red-400"
            />
          </div>

          {/* Expiração */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Expiração (horas)</label>
            <input
              type="number"
              min={1}
              max={168}
              value={expiryHours}
              onChange={(e) => setExpiryHours(e.target.value)}
              onBlur={() => saveSetting('auto_confirm_expiry_hours', parseInt(expiryHours) || 24)}
              className="w-24 text-xs px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none focus:border-amber-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">Após este período sem resposta, a confirmação pendente expira automaticamente.</p>
          </div>
        </div>
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
    '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full',
    '[&::-webkit-slider-thumb]:bg-white',
    '[&::-webkit-slider-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)] [&::-webkit-slider-thumb]:cursor-grab',
    '[&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:active:scale-110',
    '[&::-webkit-slider-thumb]:transition-transform',
    '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full',
    '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0',
    '[&::-moz-range-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]',
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
interface VisitAvailabilityInterval {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

interface VisitSettings {
  reasons: {
    key: string;
    label: string;
    icon: string;
    duration_minutes: number;
    buffer_minutes: number;
    max_per_slot: number;
    max_daily: number;
    availability_enabled: boolean;
    /** 0 = Dom, 6 = Sáb. Lista vazia = dia nenhum (motivo indisponível). */
    availability_weekdays: number[];
    /** 1..3 intervalos não-sobrepostos. Substitui os antigos availability_start/end. */
    availability_intervals: VisitAvailabilityInterval[];
    lead_integrated: boolean;
  }[];
}

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const MAX_INTERVALS = 3;

/** Converte legacy {availability_start, availability_end} em intervals[]. */
function normalizeReasonAvailability(raw: Record<string, unknown>): {
  availability_weekdays: number[];
  availability_intervals: VisitAvailabilityInterval[];
} {
  const weekdays =
    Array.isArray(raw.availability_weekdays) &&
    (raw.availability_weekdays as unknown[]).every((n) => typeof n === 'number')
      ? (raw.availability_weekdays as number[])
      : [...ALL_WEEKDAYS];

  let intervals: VisitAvailabilityInterval[] = [];
  if (Array.isArray(raw.availability_intervals)) {
    intervals = (raw.availability_intervals as Array<Record<string, unknown>>)
      .filter((i) => typeof i.start === 'string' && typeof i.end === 'string')
      .map((i) => ({ start: String(i.start), end: String(i.end) }));
  } else if (typeof raw.availability_start === 'string' && typeof raw.availability_end === 'string' && raw.availability_start && raw.availability_end) {
    // Legacy: migra single-interval para o novo formato
    intervals = [{ start: String(raw.availability_start), end: String(raw.availability_end) }];
  }
  return { availability_weekdays: weekdays, availability_intervals: intervals };
}

/** True se o intervalo `a` sobrepõe `b` (start < other.end && other.start < end). */
function intervalsOverlap(a: VisitAvailabilityInterval, b: VisitAvailabilityInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

const DEFAULT_VISIT: VisitSettings = {
  reasons: [],
};

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
      .in('key', ['reasons'])
      .then(({ data: rows }) => {
        if (!rows) { setLoading(false); return; }
        const merged = { ...DEFAULT_VISIT };
        const newIds: Record<string, string> = {};
        rows.forEach((r) => {
          newIds[r.key] = r.id;
          const v = r.value;
          const m = merged as Record<string, unknown>;
          if (r.key === 'reasons') {
            try {
              const raw: Array<Record<string, unknown>> =
                typeof v === 'string' ? JSON.parse(v) : (v as Array<Record<string, unknown>>);
              m[r.key] = raw.map((item) => {
                const { availability_weekdays, availability_intervals } = normalizeReasonAvailability(item);
                // Remove campos legados antes do merge — não persistimos mais.
                const { availability_start: _legacyStart, availability_end: _legacyEnd, ...rest } = item;
                void _legacyStart; void _legacyEnd;
                return {
                  icon: 'FileText',
                  duration_minutes: 30,
                  buffer_minutes: 0,
                  max_per_slot: 1,
                  max_daily: 0,
                  availability_enabled: false,
                  lead_integrated: false,
                  ...rest,
                  availability_weekdays,
                  availability_intervals,
                };
              });
            } catch { /* keep default */ }
          }
        });
        setData(merged);
        setIds(newIds);
        setOriginal(JSON.stringify(merged));
        setLoading(false);
      });
  }, []);

  // Dias em que a instituição está aberta + janela horária derivadas de
  // general.business_hours — fonte de verdade única. O drawer de motivos usa
  // isso para: (1) restringir os dias da semana disponíveis, (2) limitar o
  // TimeRangeSlider à janela real da instituição, (3) exibir a pausa de almoço
  // quando a instituição tiver 2 intervalos configurados.
  const [businessOpenWeekdays, setBusinessOpenWeekdays] = useState<number[]>([...ALL_WEEKDAYS]);
  const [businessWindow, setBusinessWindow] = useState<{
    start: string;
    end: string;
    lunchStart: string;
    lunchEnd: string;
  }>({ start: '08:00', end: '17:00', lunchStart: '12:00', lunchEnd: '13:30' });

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'general')
      .eq('key', 'business_hours')
      .maybeSingle()
      .then(({ data: row }) => {
        if (!row) return;
        try {
          const bh = parseBusinessHours(row.value as string | unknown);
          const openDays = ALL_WEEKDAYS.filter((i) => bh[String(i)]?.open === true);
          setBusinessOpenWeekdays(openDays.length > 0 ? openDays : [...ALL_WEEKDAYS]);

          // Janela global = min(start) e max(end) atravessando todos os dias abertos
          let minStart = '23:59';
          let maxEnd   = '00:00';
          // Para a "lunch band", usamos o gap do primeiro dia aberto que tenha
          // 2 intervalos. Isso é só visual no slider — o slot generator real
          // resolve por dia.
          let lunchStart = '';
          let lunchEnd   = '';
          for (const d of openDays) {
            const day = bh[String(d)];
            if (!day || !day.intervals.length) continue;
            const sorted = [...day.intervals].sort((a, b) => a.start.localeCompare(b.start));
            if (sorted[0].start < minStart) minStart = sorted[0].start;
            if (sorted[sorted.length - 1].end > maxEnd) maxEnd = sorted[sorted.length - 1].end;
            if (!lunchStart && sorted.length === 2) {
              lunchStart = sorted[0].end;
              lunchEnd   = sorted[1].start;
            }
          }
          if (minStart === '23:59') minStart = '08:00';
          if (maxEnd === '00:00')   maxEnd = '17:00';
          setBusinessWindow({
            start: minStart,
            end: maxEnd,
            lunchStart: lunchStart || minStart,
            lunchEnd: lunchEnd || minStart,
          });
        } catch {
          /* keep default */
        }
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
    // IMPORTANT: passar arrays/objetos direto — NUNCA JSON.stringify.
    // A coluna `value` é JSONB; supabase-js serializa nativamente.
    // Stringify manual armazena o valor como JSON-string (jsonb_typeof =
    // "string") e quebra leitores que esperam array/object.
    const rows: Array<{ key: string; value: unknown }> = [
      { key: 'reasons', value: data.reasons },
    ];
    const results = await Promise.all(
      rows.map(async (r) => {
        if (ids[r.key]) {
          const { error } = await supabase
            .from('system_settings')
            .update({ value: r.value })
            .eq('id', ids[r.key]);
          return { key: r.key, error };
        }
        const { data: row, error } = await supabase
          .from('system_settings')
          .insert({ category: 'visit', key: r.key, value: r.value })
          .select('id')
          .single();
        if (row) setIds((prev) => ({ ...prev, [r.key]: row.id }));
        return { key: r.key, error };
      }),
    );
    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      console.error('[AppointmentsSettingsPanel] save errors', failed);
      alert(
        `Falha ao salvar ${failed.length} configuração(ões): ${failed
          .map((f) => `${f.key} (${f.error?.message})`)
          .join(', ')}`,
      );
      setSaving(false);
      return;
    }
    setOriginal(JSON.stringify(data));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function openDrawer(key: string | null) {
    if (key === null) {
      setDrawerDraft({
        key: '',
        label: '',
        icon: 'FileText',
        duration_minutes: 30,
        buffer_minutes: 0,
        max_per_slot: 1,
        max_daily: 0,
        availability_enabled: false,
        availability_weekdays: [...businessOpenWeekdays],
        availability_intervals: [],
        lead_integrated: false,
      });
      setDrawerIsNew(true);
    } else {
      const found = data.reasons.find((r) => r.key === key);
      if (!found) return;
      // Intersecta com os dias úteis da instituição — se o admin removeu um
      // dia do horário de funcionamento depois que o motivo foi configurado,
      // limpamos o orfão ao abrir o drawer para edição.
      const cleanWeekdays = (found.availability_weekdays ?? [...businessOpenWeekdays]).filter((w) =>
        businessOpenWeekdays.includes(w),
      );
      setDrawerDraft({ ...found, availability_weekdays: cleanWeekdays });
      setDrawerIsNew(false);
    }
    setDrawerOpen(true);
  }

  function closeDrawer() { setDrawerOpen(false); setDrawerDraft(null); }

  /**
   * Persiste a lista de motivos diretamente no banco. O drawer NAO depende
   * mais do botao flutuante "Salvar" — caso contrario o usuario fechava a
   * pagina sem salvar e perdia as edicoes.
   *
   * IMPORTANTE: passa o array CRU para a coluna JSONB (sem JSON.stringify).
   * O supabase-js serializa nativamente; stringify manual armazena como
   * jsonb_typeof = "string" e quebra leitores que esperam array.
   */
  async function persistReasons(nextReasons: VisitSettings['reasons']): Promise<boolean> {
    const existingId = ids['reasons'];
    let error: { message: string } | null = null;
    if (existingId) {
      const res = await supabase
        .from('system_settings')
        .update({ value: nextReasons })
        .eq('id', existingId);
      error = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert({ category: 'visit', key: 'reasons', value: nextReasons })
        .select('id')
        .single();
      error = res.error;
      if (res.data) setIds((prev) => ({ ...prev, reasons: res.data.id }));
    }
    if (error) {
      console.error('[AppointmentsSettingsPanel] persistReasons error', error);
      alert(`Falha ao salvar motivos de visita: ${error.message}`);
      return false;
    }
    // Atualiza state local + baseline para nao gerar pending change
    setData((prev) => {
      const next = { ...prev, reasons: nextReasons };
      setOriginal(JSON.stringify(next));
      return next;
    });
    return true;
  }

  async function saveDrawer() {
    if (!drawerDraft || !drawerDraft.label.trim()) return;
    let nextReasons: VisitSettings['reasons'];
    if (drawerIsNew) {
      const label = drawerDraft.label.trim();
      const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `reason_${Date.now()}`;
      if (data.reasons.some((r) => r.key === key)) return;
      nextReasons = [...data.reasons, { ...drawerDraft, key, label }];
    } else {
      nextReasons = data.reasons.map((r) => (r.key === drawerDraft.key ? { ...drawerDraft } : r));
    }
    const ok = await persistReasons(nextReasons);
    if (ok) closeDrawer();
  }

  async function removeReason(key: string) {
    const nextReasons = data.reasons.filter((r) => r.key !== key);
    await persistReasons(nextReasons);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Motivos de Visita */}
      <SettingsCard
        collapseId="visits.reasons"
        title="Motivos de Visita"
        icon={FileText}
        description="Tipos de visita disponíveis para agendamento público."
        headerExtra={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{data.reasons.length}/10</span>
            {data.reasons.length < 10 && (
              <button
                onClick={() => openDrawer(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#003876] text-white text-xs font-medium hover:bg-[#002855] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            )}
          </div>
        }
      >
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
      </SettingsCard>

      {/* Dias Fechados */}
      <SettingsCard
        collapseId="visits.blockedDates"
        title="Dias Fechados"
        icon={CalendarX2}
        description="Datas específicas em que não há atendimento."
      >
          {/* ── Cadastrados ── */}
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#003876]/50 dark:text-blue-400/60">Cadastrados</p>
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
          <hr className="border-gray-100 dark:border-gray-700/50" />
          {/* ── Adicionar ── */}
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#003876]/50 dark:text-blue-400/60">Adicionar</p>
          <div className="flex gap-2 flex-wrap items-center">
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
      </SettingsCard>

      {/* Feriados */}
      <SettingsCard
        collapseId="visits.holidays"
        title="Feriados"
        icon={Calendar}
        description="Datas fixas recorrentes (dia/mês). Feriados variáveis use Dias Fechados."
      >
          {/* ── Cadastrados ── */}
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#003876]/50 dark:text-blue-400/60">Cadastrados</p>
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
          <hr className="border-gray-100 dark:border-gray-700/50" />
          {/* ── Adicionar ── */}
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#003876]/50 dark:text-blue-400/60">Adicionar</p>
          <div className="flex gap-2 flex-wrap items-center">
            <select value={newHolidayDay} onChange={(e) => setNewHolidayDay(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20">
              <option value="">Dia</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{String(d).padStart(2, '00')}</option>
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
      </SettingsCard>

      {/* Lembretes Automáticos */}
      <SettingsCard
        collapseId="visits.reminderChain"
        title="Lembretes Automáticos"
        icon={Bell}
        description={<>Cadeia de lembretes enviada antes da visita. Requer template com trigger <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-[11px]">on_reminder</code>.</>}
      >
        <ReminderChainSection />
      </SettingsCard>

      {/* Confirmação Automática */}
      <SettingsCard
        collapseId="visits.autoConfirm"
        title="Confirmação Automática"
        icon={CheckCircle2}
        description="Rastreia respostas de botões WhatsApp para confirmar/cancelar agendamentos automaticamente."
      >
        <AutoConfirmSection />
      </SettingsCard>

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
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#003876] to-[#002255] flex-shrink-0">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  {drawerIsNew ? 'Novo motivo' : 'Editar motivo'}
                </h3>
                <div className="flex items-center gap-1">
                  {!drawerIsNew && (
                    <button
                      onClick={() => { removeReason(d.key); closeDrawer(); }}
                      className="p-1.5 rounded-md text-white/60 hover:text-red-300 hover:bg-white/10 transition-colors"
                      title="Excluir motivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={closeDrawer} className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-900/60">

                {/* ── Identificação ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Identificação</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 px-4 py-4 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nome</label>
                      <input type="text" value={d.label} onChange={(e) => setDrawerDraft((prev) => prev ? { ...prev, label: e.target.value } : prev)} placeholder="Nome do motivo" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Ícone</p>
                      <div className="grid grid-cols-8 gap-1.5">
                        {REASON_ICON_OPTIONS.map(({ key: iconKey, label: iconLabel, Icon: IconComp }) => {
                          const isSelected = (d.icon || 'FileText') === iconKey;
                          return (
                            <button key={iconKey} onClick={() => setDrawerDraft((prev) => prev ? { ...prev, icon: iconKey } : prev)} title={iconLabel}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-[#003876] text-white shadow-md shadow-[#003876]/20 ring-2 ring-[#003876]/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-[#003876]/10 hover:text-[#003876] dark:hover:text-[#ffd700]'}`}>
                              <IconComp className="w-4 h-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Tempo ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Tempo</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 px-4 py-4 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Duração da visita</p>
                      <div className="flex flex-wrap gap-2">
                        {DURATION_OPTIONS.map((min) => (
                          <button key={min} onClick={() => setDrawerDraft((prev) => prev ? { ...prev, duration_minutes: min } : prev)} className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${d.duration_minutes === min ? 'bg-[#003876] text-white shadow-md shadow-[#003876]/20' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'}`}>
                            {min} min
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Intervalo após</p>
                      <p className="text-xs text-gray-400 mb-2">Tempo de preparação entre atendimentos</p>
                      <div className="flex flex-wrap gap-2">
                        {BUFFER_OPTIONS.map((min) => (
                          <button key={min} onClick={() => setDrawerDraft((prev) => prev ? { ...prev, buffer_minutes: min } : prev)} className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${d.buffer_minutes === min ? 'bg-[#003876] text-white shadow-md shadow-[#003876]/20' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'}`}>
                            {min === 0 ? 'Nenhum' : `${min} min`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Capacidade ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Capacidade</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 px-4 py-4 divide-y divide-gray-100 dark:divide-gray-700">
                    <div className="flex items-center justify-between pb-4">
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Máx. simultâneos</p>
                        <p className="text-xs text-gray-400 mt-0.5">Agendamentos no mesmo horário</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setDrawerDraft((prev) => prev ? { ...prev, max_per_slot: Math.max(1, (prev.max_per_slot ?? 1) - 1) } : prev)} className="w-8 h-8 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronDown className="w-4 h-4" /></button>
                        <span className="w-8 text-center text-lg font-bold text-gray-800 dark:text-white">{d.max_per_slot ?? 1}</span>
                        <button onClick={() => setDrawerDraft((prev) => prev ? { ...prev, max_per_slot: Math.min(10, (prev.max_per_slot ?? 1) + 1) } : prev)} className="w-8 h-8 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronUp className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4">
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Máx. diário</p>
                        <p className="text-xs text-gray-400 mt-0.5">0 = ilimitado</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setDrawerDraft((prev) => prev ? { ...prev, max_daily: Math.max(0, (prev.max_daily ?? 0) - 1) } : prev)} className="w-8 h-8 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronDown className="w-4 h-4" /></button>
                        <span className="w-8 text-center text-lg font-bold text-gray-800 dark:text-white">{d.max_daily ?? 0}</span>
                        <button onClick={() => setDrawerDraft((prev) => prev ? { ...prev, max_daily: Math.min(50, (prev.max_daily ?? 0) + 1) } : prev)} className="w-8 h-8 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronUp className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Disponibilidade ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                    <CalendarCheck className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Disponibilidade</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 px-4 py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Horário específico</p>
                        <p className="text-xs text-gray-400 mt-0.5">Restringe dias e horários disponíveis para este motivo</p>
                      </div>
                      <button
                        onClick={() => setDrawerDraft((prev) => {
                          if (!prev) return prev;
                          const enabling = !prev.availability_enabled;
                          // Ao ligar, garante pelo menos 1 intervalo e weekdays default.
                          // Intersecta com dias úteis da instituição para não começar
                          // com dias fechados marcados.
                          const baseWeekdays = prev.availability_weekdays?.length ? prev.availability_weekdays : businessOpenWeekdays;
                          const weekdays = baseWeekdays.filter((w) => businessOpenWeekdays.includes(w));
                          const intervals = prev.availability_intervals?.length
                            ? prev.availability_intervals
                            : [{ start: businessWindow.start, end: businessWindow.end }];
                          return {
                            ...prev,
                            availability_enabled: enabling,
                            availability_weekdays: weekdays.length ? weekdays : [...businessOpenWeekdays],
                            availability_intervals: intervals,
                          };
                        })}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/50 flex-shrink-0 ${d.availability_enabled ? 'bg-[#003876]' : 'bg-gray-200 dark:bg-gray-600'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${d.availability_enabled ? 'translate-x-6' : 'translate-x-0'}`}>
                          {d.availability_enabled && <Check className="w-3 h-3 text-[#003876]" strokeWidth={3} />}
                        </span>
                      </button>
                    </div>
                    {d.availability_enabled && (
                      <>
                        {/* ── Dias da semana ── */}
                        {/* Exibe apenas dias em que a instituição está aberta
                            (derivado de general.business_hours). Não faz sentido
                            permitir marcar um dia que a escola nem abre. */}
                        <div>
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Dias da semana</p>
                          {businessOpenWeekdays.length === 0 ? (
                            <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-3 py-2">
                              Nenhum dia de funcionamento configurado em Institucional → Horário de Funcionamento.
                            </p>
                          ) : (
                            <>
                              <div
                                className="grid gap-1.5"
                                style={{ gridTemplateColumns: `repeat(${businessOpenWeekdays.length}, minmax(0, 1fr))` }}
                              >
                                {businessOpenWeekdays.map((idx) => {
                                  const selected = d.availability_weekdays?.includes(idx) ?? false;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setDrawerDraft((prev) => {
                                        if (!prev) return prev;
                                        const current = prev.availability_weekdays ?? [...businessOpenWeekdays];
                                        const next = current.includes(idx)
                                          ? current.filter((x) => x !== idx)
                                          : [...current, idx].sort((a, b) => a - b);
                                        return { ...prev, availability_weekdays: next };
                                      })}
                                      className={`h-9 rounded-xl text-[11px] font-semibold transition-all ${
                                        selected
                                          ? 'bg-[#003876] text-white shadow-md shadow-[#003876]/20 ring-2 ring-[#003876]/30'
                                          : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                                      }`}
                                    >
                                      {WEEKDAYS[idx]}
                                    </button>
                                  );
                                })}
                              </div>
                              {(d.availability_weekdays?.length ?? 0) === 0 && (
                                <p className="text-[11px] text-red-500 mt-1.5">Selecione pelo menos um dia</p>
                              )}
                            </>
                          )}
                        </div>

                        {/* ── Intervalos de horário ── */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              Intervalos de horário
                              <span className="ml-1.5 text-[10px] font-normal text-gray-400">
                                ({(d.availability_intervals?.length ?? 0)}/{MAX_INTERVALS})
                              </span>
                            </p>
                            <button
                              type="button"
                              disabled={(d.availability_intervals?.length ?? 0) >= MAX_INTERVALS}
                              onClick={() => setDrawerDraft((prev) => {
                                if (!prev) return prev;
                                const current = prev.availability_intervals ?? [];
                                if (current.length >= MAX_INTERVALS) return prev;
                                // Tenta encontrar um espaço livre depois do último intervalo
                                const sorted = [...current].sort((a, b) => a.start.localeCompare(b.start));
                                const lastEnd = sorted[sorted.length - 1]?.end ?? businessWindow.start;
                                const [lh, lm] = lastEnd.split(':').map(Number);
                                const lastEndMin = lh * 60 + lm;
                                const stepMin = prev.duration_minutes || 30;
                                const newStartMin = Math.min(lastEndMin, (() => {
                                  const [eh, em] = businessWindow.end.split(':').map(Number);
                                  return eh * 60 + em - stepMin;
                                })());
                                const newEndMin = Math.min(newStartMin + stepMin, (() => {
                                  const [eh, em] = businessWindow.end.split(':').map(Number);
                                  return eh * 60 + em;
                                })());
                                const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
                                return {
                                  ...prev,
                                  availability_intervals: [...current, { start: toTime(newStartMin), end: toTime(newEndMin) }],
                                };
                              })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#003876] text-white text-[11px] font-semibold hover:bg-[#002855] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              Adicionar
                            </button>
                          </div>
                          <div className="space-y-3">
                            {(d.availability_intervals ?? []).map((interval, idx) => (
                              <div key={idx} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                    Intervalo {idx + 1}
                                  </span>
                                  {(d.availability_intervals?.length ?? 0) > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setDrawerDraft((prev) => {
                                        if (!prev) return prev;
                                        return {
                                          ...prev,
                                          availability_intervals: (prev.availability_intervals ?? []).filter((_, i) => i !== idx),
                                        };
                                      })}
                                      className="text-gray-400 hover:text-red-500 transition-colors"
                                      title="Remover intervalo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                <TimeRangeSlider
                                  workStart={businessWindow.start}
                                  workEnd={businessWindow.end}
                                  lunchStart={businessWindow.lunchStart}
                                  lunchEnd={businessWindow.lunchEnd}
                                  valueStart={interval.start}
                                  valueEnd={interval.end}
                                  stepMin={drawerDraft?.duration_minutes || 30}
                                  onChange={(start, end) => setDrawerDraft((prev) => {
                                    if (!prev) return prev;
                                    const current = prev.availability_intervals ?? [];
                                    const candidate = { start, end };
                                    // Rejeita se sobrepõe com outro intervalo
                                    const others = current.filter((_, i) => i !== idx);
                                    if (others.some((o) => intervalsOverlap(candidate, o))) {
                                      return prev;
                                    }
                                    const next = current.map((it, i) => (i === idx ? candidate : it));
                                    return { ...prev, availability_intervals: next };
                                  })}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Integrações ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                    <Plug className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Integrações</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Gestão de Leads</p>
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
                </div>

              </div>
              <div className="px-5 py-4 pb-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex-shrink-0">
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
          const m = merged as Record<string, unknown>;
          if (r.key === 'min_age') {
            merged.min_age = typeof v === 'number' ? v : parseInt(String(v)) || 0;
          } else if (r.key === 'require_parents_data' || r.key === 'require_documents') {
            m[r.key] = v === true || v === 'true';
          } else if (r.key === 'segments_available' || r.key === 'required_docs_list') {
            try { m[r.key] = typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : []); } catch { /* keep default */ }
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
    // Arrays vão como arrays — JSONB serializa nativamente.
    const rows: Array<{ key: string; value: unknown }> = [
      { key: 'min_age',              value: String(data.min_age) },
      { key: 'segments_available',   value: data.segments_available },
      { key: 'required_docs_list',   value: data.required_docs_list },
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
      <SettingsCard
        collapseId="enrollment.minAge"
        title="Idade Mínima"
        icon={Calendar}
        description="Idade mínima exigida para pré-matrícula."
      >
        <div className="flex items-center gap-4">
          <button onClick={() => setData((p) => ({ ...p, min_age: Math.max(0, p.min_age - 1) }))} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronDown className="w-4 h-4" /></button>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#003876] dark:text-white">{data.min_age}</span>
            <span className="text-sm text-gray-400">anos</span>
          </div>
          <button onClick={() => setData((p) => ({ ...p, min_age: Math.min(18, p.min_age + 1) }))} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] transition-colors"><ChevronUp className="w-4 h-4" /></button>
        </div>
      </SettingsCard>

      {/* Segmentos Disponíveis */}
      <SettingsCard
        collapseId="enrollment.segments"
        title="Segmentos Disponíveis"
        icon={GraduationCap}
        description="Níveis de ensino habilitados para pré-matrícula."
      >
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
      </SettingsCard>

      {/* Documentos Obrigatórios */}
      <SettingsCard
        collapseId="enrollment.requiredDocs"
        title="Documentos Obrigatórios"
        icon={FileText}
        description="Documentos exigidos no formulário de pré-matrícula."
      >
          {/* ── Sugeridos ── */}
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#003876]/50 dark:text-blue-400/60">Sugeridos</p>
          <div className="flex flex-wrap gap-2">
            {DOC_SUGGESTIONS.map(({ label: s, Icon: DocIcon }) => {
              const added = data.required_docs_list.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => added ? removeDoc(s) : addDoc(s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                    added
                      ? 'bg-[#003876] border-[#003876] text-white shadow-md shadow-[#003876]/20'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#003876]/40 hover:text-[#003876] dark:hover:text-[#ffd700]'
                  }`}
                >
                  <DocIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  {s}
                  {added && <Check className="w-3 h-3 flex-shrink-0 opacity-80 ml-0.5" strokeWidth={3} />}
                </button>
              );
            })}
            {data.required_docs_list.filter((d) => !DOC_SUGGESTIONS.some((s) => s.label === d)).map((doc) => (
              <span key={doc} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-[#003876] border-[#003876] text-white text-xs font-medium">
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                {doc}
                <button onClick={() => removeDoc(doc)} className="opacity-70 hover:opacity-100 transition-opacity ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <hr className="border-gray-100 dark:border-gray-700/50" />
          {/* ── Adicionar personalizado ── */}
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#003876]/50 dark:text-blue-400/60">Adicionar personalizado</p>
          <div className="flex gap-2">
            <input type="text" value={newDoc} onChange={(e) => setNewDoc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDoc(newDoc)} placeholder="Outro documento..." className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20 placeholder:text-gray-400" />
            <button onClick={() => addDoc(newDoc)} disabled={!newDoc.trim()} className="px-4 py-2 rounded-xl bg-[#003876] text-white text-sm font-medium hover:bg-[#002855] disabled:opacity-40 transition-all">Adicionar</button>
          </div>
      </SettingsCard>

      {/* Opções booleanas */}
      <SettingsCard
        collapseId="enrollment.options"
        title="Opções"
        icon={UserCheck}
        description="Requisitos adicionais para o formulário de pré-matrícula."
      >
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
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>
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
      </SettingsCard>

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
    // Arrays vão como arrays — JSONB serializa nativamente.
    const rows: Array<{ key: string; value: unknown }> = [
      { key: 'sla_hours',       value: String(data.sla_hours) },
      { key: 'required_fields', value: data.required_fields },
      { key: 'contact_reasons', value: data.reasons },
    ];
    const results = await Promise.all(
      rows.map(async (r) => {
        if (ids[r.key]) {
          const { error } = await supabase
            .from('system_settings')
            .update({ value: r.value })
            .eq('id', ids[r.key]);
          return { key: r.key, error };
        }
        const { data: row, error } = await supabase
          .from('system_settings')
          .insert({ category: 'contact', key: r.key, value: r.value })
          .select('id')
          .single();
        if (row) setIds((prev) => ({ ...prev, [r.key]: row.id }));
        return { key: r.key, error };
      }),
    );
    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      console.error('[ContactsSettingsPanel] save errors', failed);
      alert(
        `Falha ao salvar ${failed.length} configuração(ões): ${failed
          .map((f) => `${f.key} (${f.error?.message})`)
          .join(', ')}`,
      );
      setSaving(false);
      return;
    }
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

  /** Mesmo padrão da AppointmentsSettingsPanel — persistir direto. */
  async function persistReasons(nextReasons: ContactSettings['reasons']): Promise<boolean> {
    const existingId = ids['contact_reasons'];
    let error: { message: string } | null = null;
    if (existingId) {
      const res = await supabase
        .from('system_settings')
        .update({ value: nextReasons })
        .eq('id', existingId);
      error = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert({ category: 'contact', key: 'contact_reasons', value: nextReasons })
        .select('id')
        .single();
      error = res.error;
      if (res.data) setIds((prev) => ({ ...prev, contact_reasons: res.data.id }));
    }
    if (error) {
      console.error('[ContactsSettingsPanel] persistReasons error', error);
      alert(`Falha ao salvar motivos de contato: ${error.message}`);
      return false;
    }
    setData((prev) => {
      const next = { ...prev, reasons: nextReasons };
      setOriginal(JSON.stringify(next));
      return next;
    });
    return true;
  }

  async function saveDrawer() {
    if (!drawerDraft || !drawerDraft.label.trim()) return;
    let nextReasons: ContactSettings['reasons'];
    if (drawerIsNew) {
      const label = drawerDraft.label.trim();
      const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `reason_${Date.now()}`;
      if (data.reasons.some((r) => r.key === key)) return;
      nextReasons = [...data.reasons, { ...drawerDraft, key, label }];
    } else {
      nextReasons = data.reasons.map((r) => (r.key === drawerDraft.key ? { ...drawerDraft } : r));
    }
    const ok = await persistReasons(nextReasons);
    if (ok) closeDrawer();
  }

  async function removeReason(key: string) {
    const nextReasons = data.reasons.filter((r) => r.key !== key);
    await persistReasons(nextReasons);
  }

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
      <SettingsCard
        collapseId="contact.sla"
        title="SLA de Resposta"
        icon={Clock}
        description="Prazo máximo esperado para responder a um contato recebido."
      >
        <SLASlider value={data.sla_hours} onChange={(v) => setData((p) => ({ ...p, sla_hours: v }))} />
      </SettingsCard>

      {/* Campos Obrigatórios */}
      <SettingsCard
        collapseId="contact.requiredFields"
        title="Campos Obrigatórios"
        icon={FileText}
        description="Campos que o visitante precisa preencher no formulário."
      >
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
      </SettingsCard>

      {/* Motivos de Contato */}
      <SettingsCard
        collapseId="contact.reasons"
        title="Motivos de Contato"
        icon={MessageSquare}
        description="Opções de assunto disponíveis no formulário de contato."
        headerExtra={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{data.reasons.length}/12</span>
            {data.reasons.length < 12 && (
              <button onClick={() => openDrawer(null)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#003876] text-white text-xs font-medium hover:bg-[#002855] transition-all">
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            )}
          </div>
        }
      >
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
      </SettingsCard>

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
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#003876] to-[#002255] flex-shrink-0">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  {drawerIsNew ? 'Novo motivo' : 'Editar motivo'}
                </h3>
                <div className="flex items-center gap-1">
                  {!drawerIsNew && (
                    <button onClick={() => { removeReason(d.key); closeDrawer(); }} className="p-1.5 rounded-lg text-white/60 hover:text-red-300 hover:bg-white/10 transition-colors" title="Excluir motivo">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={closeDrawer} className="p-1.5 rounded-lg text-white/70 hover:bg-white/20 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-900/60">

                {/* ── Identificação ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Identificação</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 px-4 py-4 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nome</label>
                      <input type="text" value={d.label} onChange={(e) => setDrawerDraft((prev) => prev ? { ...prev, label: e.target.value } : prev)} placeholder="Nome do motivo" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Ícone</p>
                      <div className="grid grid-cols-8 gap-1.5">
                        {REASON_ICON_OPTIONS.map(({ key: iconKey, label: iconLabel, Icon: IconComp }) => {
                          const isSelected = (d.icon || 'MessageSquare') === iconKey;
                          return (
                            <button key={iconKey} onClick={() => setDrawerDraft((prev) => prev ? { ...prev, icon: iconKey } : prev)} title={iconLabel}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-[#003876] text-white shadow-md shadow-[#003876]/20 ring-2 ring-[#003876]/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-[#003876]/10 hover:text-[#003876] dark:hover:text-[#ffd700]'}`}>
                              <IconComp className="w-4 h-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Comportamento ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Comportamento</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Detalhe obrigatório</p>
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
                  </div>
                </div>

                {/* ── Integrações ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                    <Plug className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Integrações</span>
                  </div>
                  <div className="bg-white dark:bg-gray-900 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Gestão de Leads</p>
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
                </div>

              </div>
              <div className="px-5 py-4 pb-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex-shrink-0">
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
