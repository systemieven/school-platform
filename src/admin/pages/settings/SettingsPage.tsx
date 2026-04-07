import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  registerWebhook, WEBHOOK_FUNCTION_BASE, connectInstance, disconnectInstance,
  updateProfileName, updateProfileImage, getPrivacy, updatePrivacy, updatePresence,
} from '../../lib/whatsapp-api';
import type { PrivacySettings } from '../../lib/whatsapp-api';
import { useWhatsAppStatus } from '../../contexts/WhatsAppStatusContext';
import ImageCropModal from '../../components/ImageCropModal';
import type { SystemSetting } from '../../types/admin.types';
import {
  Settings, Save, Loader2, Check, Building2, MessageCircle,
  CalendarCheck, GraduationCap, MessageSquare, Bell, Palette,
  Eye, EyeOff, AlertCircle, Wifi, WifiOff, RefreshCw,
  PanelLeftClose, PanelLeftOpen, Smartphone, CheckCircle2,
  Copy, Link, ExternalLink, Shuffle, KeyRound, Globe, ShieldCheck,
  QrCode, Hash, LogOut, TriangleAlert, Phone, UserCircle2,
  Camera, Lock, Radio, Pencil, Trash2, Upload,
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
            <div className="p-6">
              {/* WhatsApp tab: fully handled by the specialised panel */}
              {activeTab === 'whatsapp' ? (
                tabSettings.length === 0
                  ? <EmptyTabState tab={currentTab} />
                  : <WhatsAppConnectionPanel />
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

// ── helpers ───────────────────────────────────────────────────────────────────
function jsonVal(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  return JSON.parse(String(v)) || '';
}

function generateSecret(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── WhatsApp Connection Panel ─────────────────────────────────────────────────
function WhatsAppConnectionPanel() {
  // ── Global WA status (from context — fetched once on layout mount)
  const { state: waState, instanceData, loading: waLoading, refresh: refreshWa } = useWhatsAppStatus();

  // ── Credentials state
  const [instanceUrl, setInstanceUrl] = useState('');
  const [apiToken,    setApiToken]    = useState('');
  const [showToken,   setShowToken]   = useState(false);
  const [savingCred,  setSavingCred]  = useState(false);
  const [savedCred,   setSavedCred]   = useState(false);
  const [credIds,     setCredIds]     = useState<Record<string, string>>({});

  // ── Connection flow state
  type ConnFlow = 'idle' | 'qr' | 'paircode' | 'success' | 'error';
  const [connFlow,      setConnFlow]      = useState<ConnFlow>('idle');
  const [connecting,    setConnecting]    = useState(false);
  const [qrImage,       setQrImage]       = useState('');
  const [pairCode,      setPairCode]      = useState('');
  const [phoneInput,    setPhoneInput]    = useState('');
  const [connError,     setConnError]     = useState('');
  const [qrExpiry,      setQrExpiry]      = useState(0); // timestamp when QR expires
  const [showDisconnectWarn, setShowDisconnectWarn] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Webhook state
  const [webhookSecret,  setWebhookSecret]  = useState('');
  const [showSecret,     setShowSecret]     = useState(false);
  const [savingSecret,   setSavingSecret]   = useState(false);
  const [savedSecret,    setSavedSecret]    = useState(false);
  const [secretId,       setSecretId]       = useState('');
  const [registering,    setRegistering]    = useState(false);
  const [regResult,      setRegResult]      = useState<{ success: boolean; error?: string } | null>(null);
  const [webhookUrlInDb, setWebhookUrlInDb] = useState('');
  const [copied,         setCopied]         = useState(false);

  // ── Load all WhatsApp API settings on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('id, key, value')
        .eq('category', 'whatsapp');
      if (!data) return;
      const ids: Record<string, string> = {};
      data.forEach((r: { id: string; key: string; value: unknown }) => {
        ids[r.key] = r.id;
        const v = jsonVal(r.value);
        if (r.key === 'instance_url')   setInstanceUrl(v);
        if (r.key === 'api_token')      setApiToken(v);
        if (r.key === 'webhook_secret') { setWebhookSecret(v); setSecretId(r.id); }
        if (r.key === 'webhook_url')    setWebhookUrlInDb(v);
      });
      setCredIds(ids);
    })();
  }, []);

  // ── Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollRef.current)     { clearInterval(pollRef.current);  pollRef.current = null; }
    if (qrRefreshRef.current){ clearTimeout(qrRefreshRef.current); qrRefreshRef.current = null; }
  }, []);

  // ── Stop polling when component unmounts
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── When waState becomes connected (from global context), clear flow
  useEffect(() => {
    if (waState === 'connected' && connFlow !== 'idle') {
      stopPolling();
      setConnFlow('idle');
      setConnecting(false);
    }
  }, [waState, connFlow, stopPolling]);

  const webhookUrl = webhookSecret
    ? `${WEBHOOK_FUNCTION_BASE}?secret=${encodeURIComponent(webhookSecret)}`
    : WEBHOOK_FUNCTION_BASE;

  // ── Save credentials
  const handleSaveCred = async () => {
    setSavingCred(true);
    const ops = [];
    if (credIds['instance_url']) ops.push(supabase.from('system_settings').update({ value: instanceUrl }).eq('id', credIds['instance_url']));
    if (credIds['api_token'])    ops.push(supabase.from('system_settings').update({ value: apiToken    }).eq('id', credIds['api_token']));
    await Promise.all(ops);
    setSavingCred(false);
    setSavedCred(true);
    setTimeout(() => setSavedCred(false), 2500);
  };

  // ── Start QR-code connection flow
  const handleConnectQr = async () => {
    setConnecting(true);
    setConnError('');
    setConnFlow('qr');
    const res = await connectInstance();
    if (!res.success || !res.qrcode) {
      setConnError(res.error || 'Não foi possível gerar o QR code.');
      setConnFlow('error');
      setConnecting(false);
      return;
    }
    setQrImage(res.qrcode);
    setQrExpiry(Date.now() + 110_000); // ~2 min minus buffer
    setConnecting(false);

    // Poll status every 3 s
    pollRef.current = setInterval(async () => {
      refreshWa(); // update global context
    }, 3000);

    // Refresh QR after 90 s (before 2-min API timeout)
    qrRefreshRef.current = setTimeout(async () => {
      const refresh = await connectInstance();
      if (refresh.success && refresh.qrcode) {
        setQrImage(refresh.qrcode);
        setQrExpiry(Date.now() + 110_000);
      }
    }, 90_000);
  };

  // ── Start pairing-code connection flow
  const handleConnectPhone = async () => {
    if (!phoneInput.trim()) return;
    setConnecting(true);
    setConnError('');
    const phone = phoneInput.replace(/\D/g, '');
    const res = await connectInstance(phone);
    if (!res.success) {
      setConnError(res.error || 'Não foi possível gerar o código de pareamento.');
      setConnFlow('error');
      setConnecting(false);
      return;
    }
    setPairCode(res.paircode || '');
    setConnFlow('paircode');
    setConnecting(false);

    // Poll status every 3 s
    pollRef.current = setInterval(() => refreshWa(), 3000);
  };

  // ── Disconnect
  const handleDisconnect = async () => {
    setDisconnecting(true);
    const res = await disconnectInstance();
    if (res.success) {
      setShowDisconnectWarn(false);
      refreshWa();
    } else {
      setConnError(res.error || 'Erro ao desconectar.');
    }
    setDisconnecting(false);
  };

  // ── Cancel connection attempt
  const handleCancelConnect = () => {
    stopPolling();
    setConnFlow('idle');
    setConnecting(false);
    setQrImage('');
    setPairCode('');
    setConnError('');
  };

  // ── Generate & save webhook secret
  const handleGenerateSecret = async () => {
    const secret = generateSecret();
    setWebhookSecret(secret);
    setSavingSecret(true);
    if (secretId) await supabase.from('system_settings').update({ value: secret }).eq('id', secretId);
    setSavingSecret(false);
    setSavedSecret(true);
    setRegResult(null);
    setTimeout(() => setSavedSecret(false), 2500);
  };

  const handleSaveSecret = async () => {
    setSavingSecret(true);
    if (secretId) await supabase.from('system_settings').update({ value: webhookSecret }).eq('id', secretId);
    setSavingSecret(false);
    setSavedSecret(true);
    setRegResult(null);
    setTimeout(() => setSavedSecret(false), 2500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegister = async () => {
    setRegistering(true);
    setRegResult(null);
    const res = await registerWebhook(webhookUrl);
    setRegResult(res);
    if (res.success) setWebhookUrlInDb(webhookUrl);
    setRegistering(false);
  };

  const isRegistered = webhookUrlInDb === webhookUrl && webhookSecret !== '';

  // QR time remaining
  const [qrSecsLeft, setQrSecsLeft] = useState(0);
  useEffect(() => {
    if (connFlow !== 'qr') return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((qrExpiry - Date.now()) / 1000));
      setQrSecsLeft(left);
    }, 1000);
    return () => clearInterval(t);
  }, [connFlow, qrExpiry]);

  return (
    <div className="space-y-5">

      {/* ── Section 1: Credentials ──────────────────────────────────────────── */}
      <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Credenciais da API</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> URL da Instância
            </label>
            <input
              type="text" value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)}
              placeholder="https://sua-instancia.exemplo.com"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Token da API
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'} value={apiToken} onChange={(e) => setApiToken(e.target.value)}
                placeholder="Cole o token da instância WhatsApp API"
                className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none transition-all"
              />
              <button type="button" onClick={() => setShowToken(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={handleSaveCred} disabled={savingCred || (!instanceUrl && !apiToken)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              savedCred ? 'bg-emerald-500 text-white' : 'bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50'}`}>
            {savingCred ? <Loader2 className="w-4 h-4 animate-spin" /> : savedCred ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savingCred ? 'Salvando…' : savedCred ? 'Salvo!' : 'Salvar Credenciais'}
          </button>
        </div>
      </div>

      {/* ── Section 2: WhatsApp Connection ──────────────────────────────────── */}
      <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-2xl p-5">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Conexão WhatsApp</h3>
          {/* Status badge */}
          <span className={`ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            waState === 'connected'    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
            : waState === 'connecting' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
            : waState === 'unknown'    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
          }`}>
            {waLoading ? <Loader2 className="w-3 h-3 animate-spin" />
              : waState === 'connected'    ? <CheckCircle2 className="w-3 h-3" />
              : waState === 'connecting'   ? <Loader2 className="w-3 h-3 animate-spin" />
              : <WifiOff className="w-3 h-3" />}
            {waState === 'connected'    ? 'Conectado'
              : waState === 'connecting' ? 'Conectando…'
              : waState === 'unknown'    ? 'Verificando…'
              : 'Desconectado'}
          </span>
          {/* Manual refresh */}
          <button onClick={refreshWa} disabled={waLoading} title="Atualizar status"
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${waLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── CONNECTED state ── */}
        {waState === 'connected' && instanceData && (
          <div className="space-y-4">
            {/* Profile card */}
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Instância conectada</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                  {instanceData.name && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="text-gray-400">Perfil: </span>{instanceData.name}
                    </span>
                  )}
                  {instanceData.phone && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="text-gray-400">Número: </span>+{instanceData.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Disconnect button */}
            {!showDisconnectWarn ? (
              <button onClick={() => setShowDisconnectWarn(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <LogOut className="w-4 h-4" /> Desconectar WhatsApp
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                  <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Confirmar desconexão?</p>
                    <p className="text-xs mt-1 text-red-500 dark:text-red-300">
                      A sessão será encerrada. Todas as notificações automáticas (agendamentos, matrículas, contatos) serão pausadas até que uma nova conexão seja estabelecida via QR code.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDisconnect} disabled={disconnecting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
                    {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                    {disconnecting ? 'Desconectando…' : 'Sim, desconectar'}
                  </button>
                  <button onClick={() => setShowDisconnectWarn(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DISCONNECTED / UNKNOWN state — connect buttons ── */}
        {(waState === 'disconnected' || waState === 'unknown') && connFlow === 'idle' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Conecte a instância ao WhatsApp para habilitar o envio de notificações automáticas.
            </p>
            {connError && (
              <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2 rounded-xl">
                {connError}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleConnectQr} disabled={connecting}
                className="inline-flex items-center gap-2 bg-[#003876] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#002855] disabled:opacity-60 transition-colors">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                {connecting ? 'Gerando QR…' : 'Conectar com QR Code'}
              </button>
              <button onClick={() => { setConnFlow('paircode'); setConnError(''); }}
                className="inline-flex items-center gap-2 border border-[#003876] text-[#003876] dark:border-[#ffd700] dark:text-[#ffd700] px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#003876]/5 dark:hover:bg-[#ffd700]/5 transition-colors">
                <Phone className="w-4 h-4" /> Conectar com número
              </button>
            </div>
          </div>
        )}

        {/* ── QR CODE flow ── */}
        {connFlow === 'qr' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Abra o WhatsApp no celular → <strong>Configurações → Dispositivos vinculados → Vincular dispositivo</strong> → aponte a câmera para o QR code.
            </p>
            {qrImage ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-2xl border border-gray-200 dark:border-gray-600 inline-block">
                  <img src={qrImage} alt="QR Code WhatsApp" className="w-52 h-52 block" />
                </div>
                {qrSecsLeft > 0 && (
                  <p className="text-xs text-gray-400">
                    QR expira em <span className={`font-mono font-semibold ${qrSecsLeft < 30 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                      {String(Math.floor(qrSecsLeft / 60)).padStart(2,'0')}:{String(qrSecsLeft % 60).padStart(2,'0')}
                    </span>
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> Aguardando leitura…
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Gerando QR code…
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setConnFlow('paircode'); stopPolling(); }}
                className="inline-flex items-center gap-1.5 text-xs text-[#003876] dark:text-[#ffd700] hover:underline">
                <Hash className="w-3.5 h-3.5" /> Usar código de pareamento
              </button>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <button onClick={handleCancelConnect} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:underline">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── PAIRING CODE input ── */}
        {connFlow === 'paircode' && !pairCode && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Digite o número de telefone vinculado ao WhatsApp (com DDI). Um código de 8 dígitos será exibido para inserir no app.
            </p>
            {connError && (
              <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2 rounded-xl">
                {connError}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="tel" value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                placeholder="5581999999999"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none"
              />
              <button onClick={handleConnectPhone} disabled={connecting || !phoneInput.trim()}
                className="inline-flex items-center gap-2 bg-[#003876] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#002855] disabled:opacity-60 transition-colors">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                {connecting ? 'Gerando…' : 'Gerar código'}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleConnectQr}
                className="inline-flex items-center gap-1.5 text-xs text-[#003876] dark:text-[#ffd700] hover:underline">
                <QrCode className="w-3.5 h-3.5" /> Usar QR code
              </button>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <button onClick={handleCancelConnect} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:underline">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── PAIRING CODE display ── */}
        {connFlow === 'paircode' && pairCode && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No WhatsApp, vá em <strong>Configurações → Dispositivos vinculados → Vincular dispositivo → Vincular com número de telefone</strong> e insira o código abaixo.
            </p>
            <div className="bg-[#003876]/5 dark:bg-[#003876]/20 border border-[#003876]/20 dark:border-[#003876]/40 rounded-2xl p-4 flex items-center justify-center">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-[#003876] dark:text-[#ffd700]">
                {pairCode}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Aguardando pareamento…
            </div>
            <button onClick={handleCancelConnect} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:underline">
              Cancelar
            </button>
          </div>
        )}

        {/* ── ERROR state ── */}
        {connFlow === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm">
              <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Falha ao conectar</p>
                {connError && <p className="text-xs mt-1 font-mono bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">{connError}</p>}
              </div>
            </div>
            <button onClick={() => { setConnFlow('idle'); setConnError(''); }}
              className="text-xs text-[#003876] dark:text-[#ffd700] hover:underline">Tentar novamente</button>
          </div>
        )}
      </div>

      {/* ── Sections 3-5: visible only when connected ───────────────────────── */}
      {waState === 'connected' && (
        <>
          <WaProfileSection />
          <WaPrivacySection />
          <WaPresenceSection />
        </>
      )}

      {/* ── Section 6: Webhook ──────────────────────────────────────────────── */}
      <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Link className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Webhook de Status de Entrega</h3>
          {isRegistered && (
            <span className="ml-auto text-[10px] font-semibold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Registrado
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Permite que a API WhatsApp informe o status de entrega (enviado, entregue, lido) de cada mensagem enviada.
        </p>
        {/* Webhook secret */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Chave Secreta <span className="text-gray-400 font-normal">— valida requisições recebidas da API WhatsApp</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type={showSecret ? 'text' : 'password'} value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)} placeholder="Clique em Gerar para criar uma chave"
                className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none font-mono transition-all" />
              <button type="button" onClick={() => setShowSecret(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={handleGenerateSecret} disabled={savingSecret}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:border-[#ffd700] dark:hover:text-[#ffd700] disabled:opacity-50 transition-colors whitespace-nowrap">
              {savingSecret ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />} Gerar
            </button>
            {webhookSecret && (
              <button onClick={handleSaveSecret} disabled={savingSecret}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  savedSecret ? 'bg-emerald-500 text-white' : 'bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50'}`}>
                {savingSecret ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedSecret ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {savedSecret ? 'Salva!' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
        {/* Webhook URL */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            URL do Webhook
            {!webhookSecret && <span className="text-amber-500 ml-1">— gere a chave secreta primeiro</span>}
          </label>
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <code className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate select-all">{webhookUrl}</code>
            <button onClick={handleCopy} title="Copiar URL"
              className={`flex-shrink-0 p-1 rounded transition-colors ${copied ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <button onClick={handleRegister} disabled={registering || !webhookSecret}
          className="inline-flex items-center gap-2 border border-[#003876] text-[#003876] dark:border-[#ffd700] dark:text-[#ffd700] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#003876]/5 dark:hover:bg-[#ffd700]/5 disabled:opacity-50 transition-colors">
          {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
          {registering ? 'Registrando…' : 'Registrar na API'}
        </button>
        {regResult && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-xl ${regResult.success
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
            {regResult.success
              ? '✓ Webhook registrado com sucesso. A API WhatsApp agora enviará atualizações de entrega para esta URL.'
              : `Erro ao registrar: ${regResult.error}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section: WhatsApp Profile ────────────────────────────────────────────────
function WaProfileSection() {
  const { instanceData, refresh } = useWhatsAppStatus();

  const [profileName,  setProfileName]  = useState(instanceData?.name  || '');
  const [savingName,   setSavingName]   = useState(false);
  const [nameResult,   setNameResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  const [cropSrc,      setCropSrc]      = useState<string | null>(null);
  const [savingPhoto,  setSavingPhoto]  = useState(false);
  const [photoResult,  setPhotoResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [removingPhoto,setRemovingPhoto]= useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // sync when instanceData changes (e.g., after refresh)
  useEffect(() => { setProfileName(instanceData?.name || ''); }, [instanceData]);

  const handleSaveName = async () => {
    if (!profileName.trim()) return;
    setSavingName(true);
    setNameResult(null);
    const res = await updateProfileName(profileName.trim());
    setNameResult({ ok: res.success, msg: res.success ? 'Nome atualizado!' : (res.error || 'Erro') });
    if (res.success) refresh();
    setSavingName(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setCropSrc(ev.target.result as string);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleCropSave = async (base64: string) => {
    setCropSrc(null);
    setSavingPhoto(true);
    setPhotoResult(null);
    const res = await updateProfileImage(base64);
    setPhotoResult({ ok: res.success, msg: res.success ? 'Foto atualizada!' : (res.error || 'Erro') });
    if (res.success) setTimeout(refresh, 1500);
    setSavingPhoto(false);
  };

  const handleRemovePhoto = async () => {
    setRemovingPhoto(true);
    setPhotoResult(null);
    const res = await updateProfileImage('remove');
    setPhotoResult({ ok: res.success, msg: res.success ? 'Foto removida.' : (res.error || 'Erro') });
    if (res.success) refresh();
    setRemovingPhoto(false);
  };

  return (
    <>
      {cropSrc && <ImageCropModal src={cropSrc} onSave={handleCropSave} onClose={() => setCropSrc(null)} />}

      <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <UserCircle2 className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Perfil WhatsApp</h3>
        </div>

        {/* Photo row */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden border-2 border-white dark:border-gray-700 shadow">
              {instanceData?.profilePicUrl ? (
                <img src={instanceData.profilePicUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <UserCircle2 className="w-8 h-8" />
                </div>
              )}
            </div>
            {savingPhoto && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Photo actions */}
          <div className="flex-1 space-y-2">
            <input type="file" accept="image/*" ref={fileRef} onChange={handleFileChange} className="hidden" />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={savingPhoto}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                {savingPhoto ? 'Enviando…' : 'Trocar foto'}
              </button>
              {instanceData?.profilePicUrl && (
                <button
                  onClick={handleRemovePhoto}
                  disabled={removingPhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                >
                  {removingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Remover
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400">JPEG recomendado · a imagem será recortada em 640×640</p>
          </div>
        </div>

        {photoResult && (
          <p className={`text-xs px-3 py-2 rounded-xl ${photoResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'}`}>
            {photoResult.msg}
          </p>
        )}

        {/* Name row */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Nome de exibição
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              placeholder="Nome visível no WhatsApp"
              maxLength={25}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none transition-all"
            />
            <button
              onClick={handleSaveName}
              disabled={savingName || !profileName.trim()}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                nameResult?.ok ? 'bg-emerald-500 text-white' : 'bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50'
              }`}
            >
              {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : nameResult?.ok ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {savingName ? 'Salvando…' : nameResult?.ok ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
          {nameResult && !nameResult.ok && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">{nameResult.msg}</p>
          )}
        </div>
      </div>
    </>
  );
}

// ── Privacy options helper ────────────────────────────────────────────────────
const PRIVACY_FIELDS: Array<{
  key: keyof PrivacySettings;
  label: string;
  options: { value: string; label: string }[];
}> = [
  { key: 'profile',      label: 'Foto de perfil',          options: [{ value: 'all', label: 'Todos' }, { value: 'contacts', label: 'Meus contatos' }, { value: 'contact_blacklist', label: 'Contatos exceto bloqueados' }, { value: 'none', label: 'Ninguém' }] },
  { key: 'last',         label: 'Visto por último',         options: [{ value: 'all', label: 'Todos' }, { value: 'contacts', label: 'Meus contatos' }, { value: 'contact_blacklist', label: 'Contatos exceto bloqueados' }, { value: 'none', label: 'Ninguém' }] },
  { key: 'online',       label: 'Status online',            options: [{ value: 'all', label: 'Todos' }, { value: 'match_last_seen', label: 'Igual ao visto por último' }] },
  { key: 'status',       label: 'Recado (mensagem de status)', options: [{ value: 'all', label: 'Todos' }, { value: 'contacts', label: 'Meus contatos' }, { value: 'contact_blacklist', label: 'Contatos exceto bloqueados' }, { value: 'none', label: 'Ninguém' }] },
  { key: 'readreceipts', label: 'Confirmações de leitura',  options: [{ value: 'all', label: 'Ativadas (tic azul visível)' }, { value: 'none', label: 'Desativadas' }] },
  { key: 'groupadd',     label: 'Adicionar a grupos',       options: [{ value: 'all', label: 'Todos' }, { value: 'contacts', label: 'Meus contatos' }, { value: 'contact_blacklist', label: 'Contatos exceto bloqueados' }, { value: 'none', label: 'Ninguém' }] },
  { key: 'calladd',      label: 'Chamadas recebidas',       options: [{ value: 'all', label: 'Todos' }, { value: 'known', label: 'Números conhecidos' }] },
];

// ── Section: Privacy ──────────────────────────────────────────────────────────
function WaPrivacySection() {
  const [privacy,   setPrivacy]   = useState<PrivacySettings>({});
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [result,    setResult]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [loaded,    setLoaded]    = useState(false);

  const fetchPrivacy = async () => {
    setLoading(true);
    const { data, error } = await getPrivacy();
    if (data) setPrivacy(data);
    if (error) setResult({ ok: false, msg: error });
    setLoaded(true);
    setLoading(false);
  };

  useEffect(() => { fetchPrivacy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (key: keyof PrivacySettings, value: string) => {
    setPrivacy(prev => ({ ...prev, [key]: value as never }));
    setResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    const res = await updatePrivacy(privacy);
    setResult({ ok: res.success, msg: res.success ? 'Privacidade atualizada com sucesso.' : (res.error || 'Erro ao salvar.') });
    setSaving(false);
  };

  const selectCls = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none transition-all appearance-none';

  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Privacidade</h3>
        {loading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin ml-1" />}
        <button onClick={fetchPrivacy} disabled={loading} title="Recarregar"
          className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loaded && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {PRIVACY_FIELDS.map(({ key, label, options }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                <select value={(privacy[key] as string) || ''} onChange={e => handleChange(key, e.target.value)} className={selectCls}>
                  {!privacy[key] && <option value="" disabled>— Carregando —</option>}
                  {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {result && (
            <p className={`text-xs px-3 py-2 rounded-xl ${result.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'}`}>
              {result.msg}
            </p>
          )}

          <button onClick={handleSave} disabled={saving}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              result?.ok ? 'bg-emerald-500 text-white' : 'bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50'
            }`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : result?.ok ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando…' : result?.ok ? 'Salvo!' : 'Salvar privacidade'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Section: Presence ─────────────────────────────────────────────────────────
function WaPresenceSection() {
  const { instanceData, refresh } = useWhatsAppStatus();
  // Derive current presence from instanceData.current_presence if available
  const initial = (instanceData?.['current_presence'] as string) === 'available' ? 'available' : 'unavailable';
  const [presence, setPresence] = useState<'available' | 'unavailable'>(initial as 'available' | 'unavailable');
  const [saving,   setSaving]   = useState(false);
  const [result,   setResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const p = instanceData?.['current_presence'] as string;
    if (p === 'available' || p === 'unavailable') setPresence(p);
  }, [instanceData]);

  const handleSave = async (value: 'available' | 'unavailable') => {
    setPresence(value);
    setSaving(true);
    setResult(null);
    const res = await updatePresence(value);
    setResult({ ok: res.success, msg: res.success ? 'Presença atualizada!' : (res.error || 'Erro') });
    if (res.success) refresh();
    setSaving(false);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status de presença</h3>
        {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin ml-1" />}
      </div>

      <div className="flex gap-2">
        {(['available', 'unavailable'] as const).map((val) => (
          <button
            key={val}
            onClick={() => handleSave(val)}
            disabled={saving}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-60 ${
              presence === val
                ? val === 'available'
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-400 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-white dark:hover:bg-gray-800'
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${val === 'available' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
            {val === 'available' ? 'Disponível (online)' : 'Indisponível (offline)'}
          </button>
        ))}
      </div>

      {result && (
        <p className={`text-xs px-3 py-2 rounded-xl ${result.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'}`}>
          {result.msg}
        </p>
      )}

      {presence === 'unavailable' && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2.5">
          <TriangleAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Com status <strong>indisponível</strong>, confirmações de entrega (ticks azuis) podem não ser recebidas se nenhum dispositivo móvel estiver ativo. Isso pode afetar o monitoramento de leitura das mensagens.
          </p>
        </div>
      )}
    </div>
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
