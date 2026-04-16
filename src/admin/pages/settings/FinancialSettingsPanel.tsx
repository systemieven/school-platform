/**
 * FinancialSettingsPanel
 *
 * Painel da aba "Financeiro" em /admin/configuracoes.
 * Seções: Plano de Contas, Formas de Pagamento, Gateways, Régua de Cobrança, Chave PIX, Parcelamento.
 * Self-contained — carrega/salva direto no Supabase.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { Toggle } from '../../components/Toggle';
import type {
  PaymentGateway, GatewayProvider, GatewayEnvironment, InstallmentConfig,
  FinancialAccountCategory, AccountCategoryType,
} from '../../types/admin.types';
import { GATEWAY_PROVIDER_LABELS } from '../../types/admin.types';
import {
  CreditCard, Loader2, Save, Check, Pencil, Trash2,
  X, ToggleLeft, ToggleRight, Zap, QrCode,
  Shield, Tag, Settings, Star, Wifi, WifiOff,
  Webhook, Copy, RefreshCcw, ExternalLink, Layers, Plus,
  BookOpen, Wallet, ChevronRight, ChevronDown, GripVertical,
} from 'lucide-react';

// ── Default payment methods ───────────────────────────────────────────────────
interface PaymentMethodItem {
  value: string;
  label: string;
  is_active: boolean;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethodItem[] = [
  { value: 'cash',        label: 'Dinheiro',         is_active: true },
  { value: 'pix',         label: 'PIX',              is_active: true },
  { value: 'credit_card', label: 'Cartão de Crédito', is_active: true },
  { value: 'debit_card',  label: 'Cartão de Débito',  is_active: true },
  { value: 'transfer',    label: 'Transferência',     is_active: true },
  { value: 'boleto',      label: 'Boleto',            is_active: true },
  { value: 'check',       label: 'Cheque',            is_active: false },
  { value: 'other',       label: 'Outro',             is_active: true },
];

// Webhook endpoint base (same host used by the supabase client)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const WEBHOOK_BASE = `${SUPABASE_URL}/functions/v1/payment-gateway-webhook`;

/** Generate a 36-char UUID-style webhook secret */
function generateWebhookSecret(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** Build webhook URL for a saved gateway */
function buildWebhookUrl(provider: string, gatewayId: string): string {
  return `${WEBHOOK_BASE}?provider=${provider}&gateway_id=${gatewayId}`;
}

// ── Gateway webhook configuration guides ─────────────────────────────────────
// Orienta o usuário a registrar a URL do webhook no painel de cada provedor.
// `implemented=true` indica que o backend já possui adapter funcional (hoje só Asaas).

interface GatewayGuide {
  panelPath: string;        // Caminho no painel do provedor
  authField: string;        // Nome do campo no painel para colar o Auth Token
  steps: string[];          // Passos extras depois de URL + Auth Token
  events: string[];         // Eventos recomendados / obrigatórios
  eventsNote?: string;      // Observação sobre seleção de eventos
  implemented: boolean;     // Backend já possui adapter para este provedor?
  notes?: string;           // Observação adicional (aparece no rodapé)
}

const GATEWAY_GUIDES: Partial<Record<GatewayProvider, GatewayGuide>> = {
  asaas: {
    panelPath: 'Integrações → Webhooks → Adicionar Webhook',
    authField: 'Token de autenticação',
    steps: [
      'Em Versão da API, selecione v3.',
      'Mantenha o status "Habilitado" e a fila "Sequencial".',
    ],
    events: [
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'PAYMENT_REFUNDED',
      'PAYMENT_UPDATED',
    ],
    eventsNote: 'Marque apenas os eventos abaixo — os demais são ignorados.',
    implemented: true,
    notes: 'Regerar o Auth Token invalida o webhook atual — atualize o token no painel Asaas após regerar.',
  },
  iugu: {
    panelPath: 'Administração → Web Hooks → Novo Web Hook',
    authField: 'Autenticação HTTP (usuário / senha)',
    steps: [
      'Defina o gatilho (evento) em cada Web Hook — a Iugu cria um registro por evento.',
      'Use o Auth Token como senha do HTTP Basic (usuário pode ficar em branco).',
    ],
    events: [
      'invoice.created',
      'invoice.status_changed',
      'invoice.payment_failed',
      'invoice.refund',
    ],
    eventsNote: 'Crie um Web Hook para cada gatilho acima.',
    implemented: false,
  },
  pagarme: {
    panelPath: 'Dashboard → Configurações → Postbacks / Webhooks',
    authField: 'Secret Key (HMAC)',
    steps: [
      'O Pagar.me assina o corpo com HMAC SHA1 no header X-Hub-Signature.',
      'Cole o Auth Token no campo de chave usada para gerar a assinatura.',
    ],
    events: [
      'order.paid',
      'order.payment_failed',
      'order.canceled',
      'charge.paid',
      'charge.refunded',
    ],
    implemented: false,
  },
  mercadopago: {
    panelPath: 'Desenvolvedores → Suas integrações → Webhooks',
    authField: 'Chave secreta (x-signature)',
    steps: [
      'Selecione "Modo de produção" apenas após testar em sandbox.',
      'O Mercado Pago envia a assinatura no header x-signature — o backend valida com o Auth Token.',
    ],
    events: [
      'payment',
      'merchant_order',
    ],
    eventsNote: 'Habilite ao menos o tópico "payment".',
    implemented: false,
  },
  vindi: {
    panelPath: 'Configurações → Webhooks → Novo webhook',
    authField: 'Autenticação (usuário / senha)',
    steps: [
      'A Vindi envia HTTP Basic — use o Auth Token como senha.',
    ],
    events: [
      'bill_created',
      'bill_paid',
      'charge_rejected',
      'subscription_canceled',
    ],
    implemented: false,
  },
  efi: {
    panelPath: 'API Efí — endpoint PUT /v1/notification/webhook',
    authField: 'Certificado mTLS (P12) + Auth Token como query string',
    steps: [
      'Efí exige certificado mTLS (.p12) enviado na requisição de configuração.',
      'O webhook é registrado via API, não pelo painel web.',
      'Anexe o Auth Token como ?hmac= na URL do webhook para validação adicional.',
    ],
    events: [
      'Cobranças PIX',
      'Boletos registrados',
    ],
    eventsNote: 'Efí envia todos os eventos de cobrança para o mesmo endpoint.',
    implemented: false,
    notes: 'O adapter Efí precisa ser implementado no backend antes de usar este gateway em produção.',
  },
  pagseguro: {
    panelPath: 'Integrações → Notificações / Webhooks',
    authField: 'Token de autenticação',
    steps: [
      'Habilite notificações em tempo real no painel.',
      'PagSeguro envia o código da transação e exige chamada de volta à API para detalhes.',
    ],
    events: [
      'Transação aprovada',
      'Transação cancelada',
      'Transação estornada',
    ],
    implemented: false,
  },
  sicredi: {
    panelPath: 'Integração via Gerente de Conta — requer certificado digital',
    authField: 'Certificado mTLS fornecido pelo Sicredi',
    steps: [
      'A integração Sicredi é contratada via gerente de conta PJ.',
      'O banco fornece o certificado mTLS e documenta o formato do webhook.',
      'Após configurado, cole o Auth Token no header combinado com o banco.',
    ],
    events: [
      'Boleto pago',
      'Boleto baixado',
      'PIX recebido',
    ],
    implemented: false,
    notes: 'Exige certificado digital e contrato com a cooperativa — não pode ser configurado apenas pelo painel.',
  },
};

// ── Billing stage config ─────────────────────────────────────────────────────

interface BillingStage {
  stage: string;    // "D-5", "D+3", "D+0" etc.
  label: string;    // User-defined label
  enabled: boolean;
  template_id: string | null;
}

/** Generate stage code from offset. Negative = before, positive = after, 0 = on the day */
function offsetToStage(offset: number): string {
  if (offset === 0) return 'D+0';
  return offset < 0 ? `D${offset}` : `D+${offset}`;
}

/** Extract numeric offset from stage code */
function stageToOffset(stage: string): number {
  const m = stage.match(/^D([+-]?\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Auto-generate label from offset */
function offsetToLabel(offset: number): string {
  if (offset === 0) return 'No dia do vencimento';
  const abs = Math.abs(offset);
  const unit = abs === 1 ? 'dia' : 'dias';
  return offset < 0 ? `${abs} ${unit} antes do vencimento` : `${abs} ${unit} após o vencimento`;
}

const PIX_TYPES = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'random', label: 'Chave aleatória' },
];

const PAYMENT_METHODS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
];

// ── GatewayGuideBlock ────────────────────────────────────────────────────────
// Bloco de instruções de webhook por provedor (data-driven via GATEWAY_GUIDES).

function GatewayGuideBlock({ provider, guide }: { provider: GatewayProvider; guide: GatewayGuide }) {
  const providerLabel = GATEWAY_PROVIDER_LABELS[provider];
  return (
    <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-2 leading-relaxed">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <Webhook className="w-3 h-3" /> Como configurar no {providerLabel}
        </p>
        {!guide.implemented && (
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
            Adapter pendente
          </span>
        )}
      </div>

      {!guide.implemented && (
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          O backend ainda não possui adapter para este provedor. As instruções abaixo servem como referência,
          mas o webhook só processará eventos após a implementação do adapter.
        </p>
      )}

      <ol className="list-decimal list-inside space-y-1 pl-1">
        <li>Acesse <strong>{guide.panelPath}</strong>.</li>
        <li>Cole a <strong>URL do Webhook</strong> acima no campo de URL do provedor.</li>
        <li>Cole o <strong>Auth Token</strong> acima no campo <em>{guide.authField}</em>.</li>
        {guide.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
        {guide.events.length > 0 && (
          <li>
            {guide.eventsNote ?? 'Marque os seguintes eventos:'}
            <ul className="mt-1 ml-4 list-disc space-y-0.5 font-mono text-[10px]">
              {guide.events.map((ev) => (
                <li key={ev}>{ev}</li>
              ))}
            </ul>
          </li>
        )}
        <li>Salve. O {providerLabel} começará a enviar eventos para a URL acima.</li>
      </ol>

      <p className="text-[10px] text-gray-400 pt-1 border-t border-blue-200 dark:border-blue-800">
        {guide.notes ?? 'Regerar o Auth Token invalida o webhook atual — atualize o token no painel do provedor após regerar.'}
      </p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FinancialSettingsPanel() {
  // ── Account categories (Plano de Contas) ───────────────────────────────────
  const [categories, setCategories] = useState<FinancialAccountCategory[]>([]);
  const [editingCat, setEditingCat] = useState<Partial<FinancialAccountCategory> | null>(null);
  const [isNewCat, setIsNewCat] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [catSaved, setCatSaved] = useState(false);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [catExpanded, setCatExpanded] = useState<Set<string>>(new Set());

  // ── Payment methods ────────────────────────────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(DEFAULT_PAYMENT_METHODS);
  const [pmSaving, setPmSaving] = useState(false);
  const [pmSaved, setPmSaved] = useState(false);
  const [initialPm, setInitialPm] = useState(JSON.stringify(DEFAULT_PAYMENT_METHODS));
  const [newPmValue, setNewPmValue] = useState('');
  const [newPmLabel, setNewPmLabel] = useState('');

  // Gateways
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [gwLoading, setGwLoading] = useState(true);
  const [editingGw, setEditingGw] = useState<Partial<PaymentGateway> | null>(null);
  const [isNewGw, setIsNewGw] = useState(false);
  const [gwSaving, setGwSaving] = useState(false);
  const [gwSaved, setGwSaved] = useState(false);
  const [deleteGwId, setDeleteGwId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const gwSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Billing stages
  const [stages, setStages] = useState<BillingStage[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [editingStageIdx, setEditingStageIdx] = useState<number | null>(null);
  const [deleteStageIdx, setDeleteStageIdx] = useState<number | null>(null);

  // PIX key
  const [pixType, setPixType] = useState('');
  const [pixValue, setPixValue] = useState('');

  // Installment configs
  const [installConfigs, setInstallConfigs] = useState<InstallmentConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<InstallmentConfig | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Dirty tracking — initial values loaded from DB
  const [initialStages, setInitialStages] = useState('[]');
  const [initialPixType, setInitialPixType] = useState('');
  const [initialPixValue, setInitialPixValue] = useState('');
  const [initialInstall, setInitialInstall] = useState('[]');

  // Unified save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanges =
    JSON.stringify(stages)         !== initialStages  ||
    JSON.stringify(installConfigs) !== initialInstall ||
    pixType !== initialPixType ||
    pixValue !== initialPixValue;

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setGwLoading(true);

    const [gwRes, settingsRes, tplRes, catRes] = await Promise.all([
      supabase.from('payment_gateways').select('*').order('created_at'),
      supabase.from('system_settings').select('*').eq('category', 'financial'),
      supabase.from('whatsapp_templates')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase.from('financial_account_categories')
        .select('*')
        .order('position')
        .order('name'),
    ]);

    setCategories((catRes.data ?? []) as FinancialAccountCategory[]);
    setGateways((gwRes.data ?? []) as PaymentGateway[]);

    // Filter templates by financeiro category
    const allTemplates = (tplRes.data ?? []) as { id: string; name: string }[];
    setTemplates(allTemplates);

    const ss = (settingsRes.data ?? []) as { key: string; value: string }[];

    // Billing stages
    let loadedStages: BillingStage[] = [];
    const stagesRaw = ss.find((s) => s.key === 'billing_stages');
    if (stagesRaw) {
      try {
        loadedStages = JSON.parse(stagesRaw.value) as BillingStage[];
      } catch { /* keep empty */ }
    }
    setStages(loadedStages);
    setInitialStages(JSON.stringify(loadedStages));

    // PIX key
    const pType = ss.find((s) => s.key === 'pix_key_type');
    const pValue = ss.find((s) => s.key === 'pix_key_value');
    const loadedPixType = pType?.value || '';
    const loadedPixValue = pValue?.value || '';
    setPixType(loadedPixType);
    setPixValue(loadedPixValue);
    setInitialPixType(loadedPixType);
    setInitialPixValue(loadedPixValue);

    // Installment configs
    const installRaw = ss.find((s) => s.key === 'installment_configs');
    let loadedInstall: InstallmentConfig[] = [];
    if (installRaw?.value) {
      try { loadedInstall = JSON.parse(installRaw.value) as InstallmentConfig[]; } catch { /**/ }
    }
    setInstallConfigs(loadedInstall);
    setInitialInstall(JSON.stringify(loadedInstall));

    // Payment methods
    const pmRaw = ss.find((s) => s.key === 'payment_methods');
    let loadedPm: PaymentMethodItem[] = DEFAULT_PAYMENT_METHODS;
    if (pmRaw?.value) {
      try { loadedPm = JSON.parse(pmRaw.value) as PaymentMethodItem[]; } catch { /**/ }
    }
    setPaymentMethods(loadedPm);
    setInitialPm(JSON.stringify(loadedPm));

    setGwLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Account Categories CRUD ────────────────────────────────────────────────

  async function saveCat() {
    if (!editingCat?.name?.trim() || !editingCat.type) return;
    setCatSaving(true);
    if (isNewCat) {
      const { data } = await supabase
        .from('financial_account_categories')
        .insert({
          name: editingCat.name.trim(),
          type: editingCat.type,
          parent_id: editingCat.parent_id ?? null,
          code: editingCat.code ?? null,
          is_active: true,
          position: categories.length,
        })
        .select()
        .single();
      if (data) setCategories([...categories, data as FinancialAccountCategory]);
      logAudit({ action: 'create', module: 'settings', description: `Categoria "${editingCat.name}" criada` });
    } else {
      const { data } = await supabase
        .from('financial_account_categories')
        .update({
          name: editingCat.name.trim(),
          type: editingCat.type,
          parent_id: editingCat.parent_id ?? null,
          code: editingCat.code ?? null,
        })
        .eq('id', editingCat.id!)
        .select()
        .single();
      if (data) setCategories(categories.map((c) => c.id === editingCat.id ? data as FinancialAccountCategory : c));
      logAudit({ action: 'update', module: 'settings', description: `Categoria "${editingCat.name}" atualizada` });
    }
    setCatSaving(false);
    setCatSaved(true);
    setTimeout(() => { setCatSaved(false); setEditingCat(null); }, 900);
  }

  async function toggleCatActive(cat: FinancialAccountCategory) {
    await supabase.from('financial_account_categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    setCategories(categories.map((c) => c.id === cat.id ? { ...c, is_active: !cat.is_active } : c));
  }

  async function deleteCat(id: string) {
    await supabase.from('financial_account_categories').delete().eq('id', id);
    setCategories(categories.filter((c) => c.id !== id));
    setDeleteCatId(null);
    logAudit({ action: 'delete', module: 'settings', description: 'Categoria excluída' });
  }

  // ── Payment Methods save ───────────────────────────────────────────────────

  async function savePaymentMethods() {
    setPmSaving(true);
    await supabase.from('system_settings').upsert(
      { category: 'financial', key: 'payment_methods', value: JSON.stringify(paymentMethods) },
      { onConflict: 'category,key' },
    );
    setInitialPm(JSON.stringify(paymentMethods));
    logAudit({ action: 'update', module: 'settings', description: 'Formas de pagamento atualizadas' });
    setPmSaving(false);
    setPmSaved(true);
    setTimeout(() => setPmSaved(false), 2500);
  }

  // ── Gateway CRUD ───────────────────────────────────────────────────────────

  function openNewGw() {
    setEditingGw({
      provider: 'manual' as GatewayProvider,
      label: '',
      environment: 'sandbox' as GatewayEnvironment,
      credentials: {},
      webhook_secret: generateWebhookSecret(),
      is_active: true,
      is_default: false,
      supported_methods: ['pix', 'boleto'],
    });
    setIsNewGw(true);
  }

  function regenerateSecret() {
    if (!editingGw) return;
    setEditingGw({ ...editingGw, webhook_secret: generateWebhookSecret() });
  }

  async function copyToClipboard(text: string, target: 'url' | 'secret') {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
    if (target === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1500);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 1500);
    }
  }

  function openEditGw(gw: PaymentGateway) {
    setEditingGw({ ...gw });
    setIsNewGw(false);
  }

  function closeGw() {
    setEditingGw(null);
    setIsNewGw(false);
  }

  async function saveGw() {
    if (!editingGw) return;
    setGwSaving(true);

    const payload = {
      provider: editingGw.provider!,
      label: editingGw.label!,
      environment: editingGw.environment!,
      credentials: editingGw.credentials || {},
      webhook_secret: editingGw.webhook_secret || null,
      is_active: editingGw.is_active ?? true,
      is_default: editingGw.is_default ?? false,
      supported_methods: editingGw.supported_methods || [],
    };

    if (isNewGw) {
      await supabase.from('payment_gateways').insert(payload);
      logAudit({ action: 'create', module: 'settings', description: `Gateway criado: ${payload.label}` });
    } else {
      await supabase.from('payment_gateways').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingGw.id!);
      logAudit({ action: 'update', module: 'settings', description: `Gateway atualizado: ${payload.label}` });
    }

    setGwSaving(false);
    setGwSaved(true);
    if (gwSavedTimer.current) clearTimeout(gwSavedTimer.current);
    gwSavedTimer.current = setTimeout(() => { setGwSaved(false); closeGw(); load(); }, 1200);
  }

  async function deleteGw(id: string) {
    const gw = gateways.find((g) => g.id === id);
    await supabase.from('payment_gateways').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'settings', description: `Gateway excluído: ${gw?.label}` });
    setDeleteGwId(null);
    load();
  }

  // ── Unified save ────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const promises: PromiseLike<unknown>[] = [];

    // Save billing stages if changed
    if (JSON.stringify(stages) !== initialStages) {
      promises.push(
        supabase.from('system_settings').upsert({
          category: 'financial',
          key: 'billing_stages',
          value: JSON.stringify(stages),
        }, { onConflict: 'category,key' }).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Régua de cobrança atualizada' });
    }

    // Save PIX if changed
    if (pixType !== initialPixType || pixValue !== initialPixValue) {
      promises.push(
        supabase.from('system_settings').upsert({ category: 'financial', key: 'pix_key_type', value: pixType }, { onConflict: 'category,key' }).then(),
        supabase.from('system_settings').upsert({ category: 'financial', key: 'pix_key_value', value: pixValue }, { onConflict: 'category,key' }).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Chave PIX atualizada' });
    }

    // Save installment configs if changed
    if (JSON.stringify(installConfigs) !== initialInstall) {
      promises.push(
        supabase.from('system_settings').upsert(
          { category: 'financial', key: 'installment_configs', value: JSON.stringify(installConfigs) },
          { onConflict: 'category,key' },
        ).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Regras de parcelamento atualizadas' });
    }

    await Promise.all(promises);

    // Update initial values to match current
    setInitialStages(JSON.stringify(stages));
    setInitialPixType(pixType);
    setInitialPixValue(pixValue);
    setInitialInstall(JSON.stringify(installConfigs));

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ── Installment config drawer save ─────────────────────────────────────────

  function saveConfig() {
    if (!editingConfig) return;
    setConfigSaving(true);
    // Sort rules by max_amount ASC, null last
    const sorted = [...editingConfig.rules].sort((a, b) => {
      if (a.max_amount === null) return 1;
      if (b.max_amount === null) return -1;
      return a.max_amount - b.max_amount;
    });
    const cfg = { ...editingConfig, rules: sorted };
    const exists = installConfigs.some((c) => c.id === cfg.id);
    setInstallConfigs(exists
      ? installConfigs.map((c) => (c.id === cfg.id ? cfg : c))
      : [...installConfigs, cfg],
    );
    setConfigSaving(false);
    setConfigSaved(true);
    setTimeout(() => { setConfigSaved(false); setEditingConfig(null); }, 900);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (gwLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Helpers for category tree ──────────────────────────────────────────────

  const rootCategories = categories.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  return (
    <div className="p-6 space-y-4">

      {/* ── 0. Plano de Contas ── */}
      <SettingsCard
        title="Plano de Contas"
        description="Categorias de receitas e despesas para classificação dos lançamentos financeiros"
        icon={BookOpen}
        collapseId="financial.account-categories"
        headerExtra={
          <button
            onClick={() => { setEditingCat({ type: 'receita' as AccountCategoryType }); setIsNewCat(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors font-medium"
          >
            <Plus className="w-3 h-3" /> Nova categoria
          </button>
        }
      >
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Nenhuma categoria configurada. As categorias padrão serão criadas na próxima migração do banco.
          </p>
        ) : (
          <div className="space-y-1">
            {rootCategories.map((cat) => {
              const children = childrenOf(cat.id);
              const isExpanded = catExpanded.has(cat.id);
              const isReceita = cat.type === 'receita';
              return (
                <div key={cat.id}>
                  {/* Parent row */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${cat.is_active ? '' : 'opacity-50'} hover:bg-gray-50 dark:hover:bg-gray-900/30 group`}>
                    {children.length > 0 ? (
                      <button onClick={() => setCatExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id);
                        return next;
                      })} className="p-0.5 text-gray-400">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <span className="w-5 inline-block" />
                    )}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isReceita ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                      {isReceita ? 'R' : 'D'}
                    </span>
                    {cat.code && <span className="text-[10px] text-gray-400 font-mono">{cat.code}</span>}
                    <p className={`flex-1 text-sm font-medium ${cat.is_active ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
                      {cat.name}
                    </p>
                    {cat.is_system && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Sistema</span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Toggle
                        checked={cat.is_active}
                        onChange={() => { void toggleCatActive(cat); }}
                      />
                      <button
                        onClick={() => { setEditingCat({ ...cat }); setIsNewCat(false); }}
                        className="p-1.5 text-gray-400 hover:text-brand-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {!cat.is_system && (
                        deleteCatId === cat.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteCat(cat.id)} className="px-2 py-0.5 text-[10px] bg-red-500 text-white rounded-lg">Confirmar</button>
                            <button onClick={() => setDeleteCatId(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteCatId(cat.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  {/* Children */}
                  {isExpanded && children.length > 0 && (
                    <div className="ml-8 space-y-0.5">
                      {children.map((child) => (
                        <div key={child.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${child.is_active ? '' : 'opacity-50'} hover:bg-gray-50 dark:hover:bg-gray-900/30 group`}>
                          <span className="w-5 inline-block" />
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isReceita ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                            {isReceita ? 'R' : 'D'}
                          </span>
                          {child.code && <span className="text-[10px] text-gray-400 font-mono">{child.code}</span>}
                          <p className={`flex-1 text-sm ${child.is_active ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                            {child.name}
                          </p>
                          {child.is_system && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Sistema</span>
                          )}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Toggle checked={child.is_active} onChange={() => { void toggleCatActive(child); }} />
                            <button onClick={() => { setEditingCat({ ...child }); setIsNewCat(false); }} className="p-1.5 text-gray-400 hover:text-brand-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                            {!child.is_system && (
                              deleteCatId === child.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => deleteCat(child.id)} className="px-2 py-0.5 text-[10px] bg-red-500 text-white rounded-lg">Confirmar</button>
                                  <button onClick={() => setDeleteCatId(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteCatId(child.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {/* ── 1. Formas de Pagamento ── */}
      <SettingsCard
        title="Formas de Pagamento"
        description="Formas de pagamento disponíveis para lançamentos no sistema"
        icon={Wallet}
        collapseId="financial.payment-methods"
      >
        <div className="space-y-2">
          {paymentMethods.map((pm, idx) => (
            <div key={pm.value} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
              <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
              <Toggle
                checked={pm.is_active}
                onChange={() => {
                  const next = [...paymentMethods];
                  next[idx] = { ...pm, is_active: !pm.is_active };
                  setPaymentMethods(next);
                }}
              />
              <p className={`flex-1 text-sm ${pm.is_active ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>{pm.label}</p>
              <span className="text-[10px] text-gray-400 font-mono">{pm.value}</span>
              <button
                onClick={() => setPaymentMethods(paymentMethods.filter((_, i) => i !== idx))}
                className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Add new method */}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={newPmValue}
              onChange={(e) => setNewPmValue(e.target.value)}
              placeholder="Chave (ex: pix2)"
              className="w-28 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                         bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                         placeholder:text-gray-400 focus:border-brand-primary outline-none"
            />
            <input
              type="text"
              value={newPmLabel}
              onChange={(e) => setNewPmLabel(e.target.value)}
              placeholder="Rótulo (ex: PIX Pessoa Jurídica)"
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                         bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                         placeholder:text-gray-400 focus:border-brand-primary outline-none"
            />
            <button
              onClick={() => {
                if (!newPmValue.trim() || !newPmLabel.trim()) return;
                setPaymentMethods([...paymentMethods, { value: newPmValue.trim(), label: newPmLabel.trim(), is_active: true }]);
                setNewPmValue('');
                setNewPmLabel('');
              }}
              className="px-3 py-1.5 text-xs font-medium bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Save bar */}
          {JSON.stringify(paymentMethods) !== initialPm && (
            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
              <button
                onClick={savePaymentMethods}
                disabled={pmSaving}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                  pmSaved
                    ? 'bg-emerald-500 text-white'
                    : 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                }`}
              >
                {pmSaving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando…</>
                ) : pmSaved ? (
                  <><Check className="w-3.5 h-3.5" /> Salvo!</>
                ) : (
                  <><Wallet className="w-3.5 h-3.5" /> Salvar formas de pagamento</>
                )}
              </button>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* ── A. Gateways de Pagamento ── */}
      <SettingsCard
        title="Gateways de Pagamento"
        description="Provedores para emissão de cobranças e recebimento de pagamentos"
        icon={CreditCard}
        collapseId="financial.gateways"
        headerExtra={
          <button onClick={openNewGw} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors font-medium">
            <CreditCard className="w-3 h-3" /> Adicionar
          </button>
        }
      >
        {gateways.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum gateway configurado. Cobranças serão registradas manualmente.</p>
        ) : (
          <div className="space-y-2">
            {gateways.map((gw) => (
              <div key={gw.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  {gw.is_active ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-gray-400" />}
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{gw.label}</p>
                    <p className="text-[10px] text-gray-400">
                      {GATEWAY_PROVIDER_LABELS[gw.provider]} · {gw.environment === 'sandbox' ? 'Sandbox' : 'Produção'}
                      {gw.is_default && <span className="ml-1.5 text-amber-500 font-semibold">Padrão</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditGw(gw)} className="p-1.5 text-gray-400 hover:text-brand-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {deleteGwId === gw.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteGw(gw.id)} className="px-2 py-1 text-[10px] bg-red-500 text-white rounded-lg">Confirmar</button>
                      <button onClick={() => setDeleteGwId(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteGwId(gw.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      {/* ── B. Régua de Cobrança ── */}
      <SettingsCard
        title="Régua de Cobrança WhatsApp"
        description="Configure etapas de notificação automática relativas ao vencimento"
        icon={Zap}
        collapseId="financial.billing"
        headerExtra={
          <button
            onClick={() => {
              setStages([...stages, { stage: 'D-5', label: '5 dias antes do vencimento', enabled: true, template_id: null }]);
              setEditingStageIdx(stages.length);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors font-medium"
          >
            <Zap className="w-3 h-3" /> Adicionar etapa
          </button>
        }
      >
        {stages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma etapa configurada. Adicione etapas para ativar a régua de cobrança.</p>
        ) : (
          <div className="space-y-2">
            {stages.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
                {/* Toggle */}
                <button
                  onClick={() => {
                    const next = [...stages];
                    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
                    setStages(next);
                  }}
                  className="flex-shrink-0"
                >
                  {stage.enabled
                    ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                    : <ToggleLeft className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                  }
                </button>

                {/* Label */}
                {editingStageIdx === idx ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 flex-shrink-0">D</span>
                      <input
                        type="number"
                        value={stageToOffset(stage.stage)}
                        onChange={(e) => {
                          const offset = parseInt(e.target.value, 10) || 0;
                          const next = [...stages];
                          next[idx] = { ...next[idx], stage: offsetToStage(offset), label: offsetToLabel(offset) };
                          setStages(next);
                        }}
                        className="w-16 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-center"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-gray-400 flex-shrink-0">dias</span>
                    </div>
                    <input
                      value={stage.label}
                      onChange={(e) => {
                        const next = [...stages];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setStages(next);
                      }}
                      className="flex-1 min-w-0 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none"
                      placeholder="Descrição da etapa"
                    />
                    <button onClick={() => setEditingStageIdx(null)} className="p-1 text-emerald-500 hover:text-emerald-600">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingStageIdx(idx)}>
                    <p className={`text-sm font-medium ${stage.enabled ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
                      {stage.stage}
                    </p>
                    <p className="text-[10px] text-gray-400">{stage.label}</p>
                  </div>
                )}

                {/* Template selector */}
                <select
                  value={stage.template_id || ''}
                  onChange={(e) => {
                    const next = [...stages];
                    next[idx] = { ...next[idx], template_id: e.target.value || null };
                    setStages(next);
                  }}
                  disabled={!stage.enabled}
                  className="w-44 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 disabled:opacity-40 focus:border-brand-primary outline-none"
                >
                  <option value="">Selecione template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {/* Edit / Delete */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {editingStageIdx !== idx && (
                    <button onClick={() => setEditingStageIdx(idx)} className="p-1.5 text-gray-400 hover:text-brand-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {deleteStageIdx === idx ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { const next = stages.filter((_, i) => i !== idx); setStages(next); setDeleteStageIdx(null); setEditingStageIdx(null); }} className="px-2 py-1 text-[10px] bg-red-500 text-white rounded-lg">Excluir</button>
                      <button onClick={() => setDeleteStageIdx(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteStageIdx(idx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-gray-400 mt-2">
          Valores negativos = antes do vencimento · Positivos = após · Zero = no dia. O disparo é feito como campanha, permitindo pausar/reiniciar via Comunicados.
        </p>
      </SettingsCard>

      {/* ── C. Regras de Parcelamento ── */}
      <SettingsCard
        title="Regras de Parcelamento"
        description="Defina faixas de valor e o máximo de parcelas por gateway e forma de pagamento"
        icon={CreditCard}
        collapseId="financial.installments"
        headerExtra={
          <button
            onClick={() => setEditingConfig({
              id: crypto.randomUUID(),
              gateway_id: gateways[0]?.id ?? '',
              payment_method: 'credit_card',
              enabled: true,
              rules: [],
            })}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5
                       rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20
                       dark:bg-brand-primary/20 dark:hover:bg-brand-primary/30 transition-colors"
          >
            <Plus className="w-3 h-3" /> Adicionar
          </button>
        }
      >
        {installConfigs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma regra configurada.</p>
        ) : (
          <div className="space-y-2">
            {installConfigs.map((cfg) => {
              const gw = gateways.find((g) => g.id === cfg.gateway_id);
              return (
                <div key={cfg.id}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40
                             rounded-xl border border-gray-100 dark:border-gray-700"
                >
                  <button
                    onClick={() =>
                      setInstallConfigs(installConfigs.map((c) =>
                        c.id === cfg.id ? { ...c, enabled: !c.enabled } : c))
                    }
                    className="flex-shrink-0"
                  >
                    {cfg.enabled
                      ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                      : <ToggleLeft  className="w-6 h-6 text-gray-300 dark:text-gray-600" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {gw?.label ?? 'Gateway não encontrado'} —{' '}
                      {cfg.payment_method === 'credit_card' ? 'Cartão de Crédito' : 'Cartão de Débito'}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {cfg.rules.length} faixa{cfg.rules.length !== 1 ? 's' : ''} configurada{cfg.rules.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingConfig({ ...cfg })}
                    className="p-1.5 text-gray-400 hover:text-brand-primary rounded-lg
                               hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setInstallConfigs(installConfigs.filter((c) => c.id !== cfg.id))}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg
                               hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {/* ── D. Chave PIX ── */}
      <SettingsCard
        title="Chave PIX para Cobranças"
        description="Chave utilizada nas notificações WhatsApp e no portal do aluno"
        icon={QrCode}
        collapseId="financial.pix"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tipo da chave</label>
            <select value={pixType} onChange={(e) => setPixType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
              <option value="">Selecione</option>
              {PIX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor da chave</label>
            <input value={pixValue} onChange={(e) => setPixValue(e.target.value)} placeholder="Ex: 00.000.000/0001-00"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
          </div>
        </div>
      </SettingsCard>

      {/* ── Floating save button ── */}
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
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* ── Gateway Drawer ── */}
      <Drawer
        open={!!editingGw}
        onClose={closeGw}
        title={isNewGw ? 'Novo Gateway' : 'Editar Gateway'}
        icon={CreditCard}
        width="w-[440px]"
        footer={
          <div className="flex gap-3">
            <button onClick={closeGw} disabled={gwSaving} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancelar</button>
            <button onClick={saveGw} disabled={!editingGw?.label || !editingGw?.provider || gwSaving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${gwSaved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {gwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : gwSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {gwSaving ? 'Salvando...' : gwSaved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        }
      >
        {editingGw && (
          <>
            <DrawerCard title="Identificação" icon={Tag}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Provedor *</label>
                <select value={editingGw.provider || ''} onChange={(e) => setEditingGw({ ...editingGw, provider: e.target.value as GatewayProvider })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
                  {Object.entries(GATEWAY_PROVIDER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome / Label *</label>
                <input value={editingGw.label || ''} onChange={(e) => setEditingGw({ ...editingGw, label: e.target.value })} placeholder="Ex: Asaas Produção"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
              </div>
            </DrawerCard>

            <DrawerCard title="Ambiente" icon={Settings}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Ambiente</label>
                <select value={editingGw.environment || 'sandbox'} onChange={(e) => setEditingGw({ ...editingGw, environment: e.target.value as GatewayEnvironment })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
                  <option value="sandbox">Sandbox (testes)</option>
                  <option value="production">Produção</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Toggle
                  checked={!!editingGw.is_active}
                  onChange={(v) => setEditingGw({ ...editingGw, is_active: v })}
                  label="Ativo"
                  description="Habilita este gateway para processar cobranças."
                />
                <Toggle
                  checked={!!editingGw.is_default}
                  onChange={(v) => setEditingGw({ ...editingGw, is_default: v })}
                  label="Padrão"
                  description="Usado por padrão em novas cobranças."
                />
              </div>
            </DrawerCard>

            {editingGw.provider !== 'manual' && (
              <DrawerCard title="Credenciais" icon={Shield}>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">API Key / Token</label>
                  <input type="password" value={editingGw.credentials?.api_key || ''} onChange={(e) => setEditingGw({ ...editingGw, credentials: { ...editingGw.credentials, api_key: e.target.value } })} placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
                </div>
                {editingGw.provider === 'asaas' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Wallet ID (opcional)</label>
                    <input value={editingGw.credentials?.wallet_id || ''} onChange={(e) => setEditingGw({ ...editingGw, credentials: { ...editingGw.credentials, wallet_id: e.target.value } })} placeholder="Seu wallet ID"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
                  </div>
                )}
              </DrawerCard>
            )}

            {editingGw.provider !== 'manual' && (
              <DrawerCard title="Webhook" icon={Webhook}>
                {isNewGw || !editingGw.id ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                    Salve o gateway primeiro para gerar a URL do webhook. O Auth Token já foi gerado abaixo.
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">URL do Webhook</label>
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <code className="text-[11px] text-gray-600 dark:text-gray-400 flex-1 truncate select-all">
                        {buildWebhookUrl(editingGw.provider!, editingGw.id)}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(buildWebhookUrl(editingGw.provider!, editingGw.id!), 'url')}
                        title="Copiar URL"
                        className={`flex-shrink-0 p-1 rounded transition-colors ${copiedUrl ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Auth Token (validação)</label>
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
                    <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <code className="text-[11px] text-gray-600 dark:text-gray-400 flex-1 truncate select-all font-mono">
                      {editingGw.webhook_secret || '—'}
                    </code>
                    <button
                      type="button"
                      onClick={() => editingGw.webhook_secret && copyToClipboard(editingGw.webhook_secret, 'secret')}
                      title="Copiar token"
                      className={`flex-shrink-0 p-1 rounded transition-colors ${copiedSecret ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                      {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={regenerateSecret}
                      title="Gerar novo token"
                      className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-brand-primary transition-colors"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingGw.provider && GATEWAY_GUIDES[editingGw.provider] && (
                  <GatewayGuideBlock
                    provider={editingGw.provider}
                    guide={GATEWAY_GUIDES[editingGw.provider]!}
                  />
                )}
              </DrawerCard>
            )}

            <DrawerCard title="Métodos de Pagamento" icon={Star}>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const selected = editingGw.supported_methods?.includes(method.value) ?? false;
                  return (
                    <button key={method.value} type="button"
                      onClick={() => {
                        const methods = editingGw.supported_methods || [];
                        setEditingGw({
                          ...editingGw,
                          supported_methods: selected ? methods.filter((m) => m !== method.value) : [...methods, method.value],
                        });
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${selected ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-semibold' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
                    >
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </DrawerCard>
          </>
        )}
      </Drawer>

      {/* ── Installment Config Drawer ── */}
      <Drawer
        open={!!editingConfig}
        onClose={() => setEditingConfig(null)}
        title={installConfigs.some((c) => c.id === editingConfig?.id) ? 'Editar Regra de Parcelamento' : 'Nova Regra de Parcelamento'}
        icon={CreditCard}
        width="w-[460px]"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setEditingConfig(null)}
              disabled={configSaving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                         text-sm font-medium text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveConfig}
              disabled={configSaving || !editingConfig?.gateway_id}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                          text-sm font-semibold transition-all duration-300
                          ${configSaved
                            ? 'bg-emerald-500 text-white'
                            : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
                          }`}
            >
              {configSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : configSaved
                  ? <Check className="w-4 h-4" />
                  : <CreditCard className="w-4 h-4" />}
              {configSaving ? 'Salvando…' : configSaved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        }
      >
        {editingConfig && (
          <>
            <DrawerCard title="Configuração" icon={Settings}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Gateway de Pagamento
                </label>
                <select
                  value={editingConfig.gateway_id}
                  onChange={(e) => setEditingConfig({ ...editingConfig, gateway_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200
                             focus:border-brand-primary outline-none"
                >
                  {gateways.length === 0 && (
                    <option value="">Nenhum gateway cadastrado</option>
                  )}
                  {gateways.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['credit_card', 'debit_card'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditingConfig({ ...editingConfig, payment_method: m })}
                      className={`px-3 py-2 text-xs rounded-xl border transition-colors font-medium ${
                        editingConfig.payment_method === m
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {m === 'credit_card' ? 'Cartão de Crédito' : 'Cartão de Débito'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ativo</span>
                <button
                  onClick={() => setEditingConfig({ ...editingConfig, enabled: !editingConfig.enabled })}
                  className="flex-shrink-0"
                >
                  {editingConfig.enabled
                    ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                    : <ToggleLeft  className="w-7 h-7 text-gray-300 dark:text-gray-600" />}
                </button>
              </div>
            </DrawerCard>

            <DrawerCard
              title="Faixas de Parcelamento"
              icon={Layers}
              headerExtra={
                <button
                  onClick={() =>
                    setEditingConfig({
                      ...editingConfig,
                      rules: [...editingConfig.rules, { max_amount: null, max_installments: 2 }],
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1
                             rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Adicionar faixa
                </button>
              }
            >
              {editingConfig.rules.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Nenhuma faixa adicionada.</p>
              ) : (
                <div className="space-y-2">
                  {editingConfig.rules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 flex-shrink-0">Até R$</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Sem limite"
                        value={rule.max_amount ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          const next = [...editingConfig.rules];
                          next[idx] = { ...next[idx], max_amount: val };
                          setEditingConfig({ ...editingConfig, rules: next });
                        }}
                        className="w-28 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                                   bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                                   placeholder:text-gray-400 focus:border-brand-primary outline-none"
                      />
                      <span className="text-xs text-gray-400 flex-shrink-0">→ até</span>
                      <select
                        value={rule.max_installments}
                        onChange={(e) => {
                          const next = [...editingConfig.rules];
                          next[idx] = { ...next[idx], max_installments: Number(e.target.value) };
                          setEditingConfig({ ...editingConfig, rules: next });
                        }}
                        className="w-20 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                                   bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                                   focus:border-brand-primary outline-none"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const next = editingConfig.rules.filter((_, i) => i !== idx);
                          setEditingConfig({ ...editingConfig, rules: next });
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-lg
                                   hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-2">
                Deixe "Até R$" em branco na última faixa para indicar "qualquer valor acima".
              </p>
            </DrawerCard>
          </>
        )}
      </Drawer>

      {/* ── Drawer: Categoria do Plano de Contas ── */}
      <Drawer
        open={editingCat !== null}
        onClose={() => setEditingCat(null)}
        title={isNewCat ? 'Nova Categoria' : 'Editar Categoria'}
        icon={Tag}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setEditingCat(null)}
              disabled={catSaving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                         text-sm text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveCat}
              disabled={catSaving || !editingCat?.name?.trim() || !editingCat?.type}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                          text-sm font-medium transition-all
                          ${catSaved
                            ? 'bg-emerald-500 text-white'
                            : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}
            >
              {catSaving ? <Loader2 className="w-4 h-4 animate-spin" />
               : catSaved  ? <Check className="w-4 h-4" />
                           : <BookOpen className="w-4 h-4" />}
              {catSaving ? 'Salvando…' : catSaved ? 'Salvo!' : isNewCat ? 'Criar categoria' : 'Salvar'}
            </button>
          </div>
        }
      >
        {editingCat && (
          <DrawerCard title="Dados da Categoria" icon={BookOpen}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Nome *
                </label>
                <input
                  type="text"
                  value={editingCat.name ?? ''}
                  onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                  placeholder="Ex: Aluguel, Mensalidades..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                             placeholder:text-gray-400 focus:border-brand-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Tipo *
                </label>
                <div className="flex gap-2">
                  {(['receita', 'despesa'] as AccountCategoryType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditingCat({ ...editingCat, type: t })}
                      className={`flex-1 py-2.5 text-sm rounded-xl border font-medium capitalize transition-colors ${
                        editingCat.type === t
                          ? t === 'receita'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {t === 'receita' ? 'Receita' : 'Despesa'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Categoria Pai (opcional)
                </label>
                <select
                  value={editingCat.parent_id ?? ''}
                  onChange={(e) => setEditingCat({ ...editingCat, parent_id: e.target.value || null })}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                             focus:border-brand-primary outline-none"
                >
                  <option value="">— Nenhuma (categoria raiz) —</option>
                  {categories
                    .filter((c) => !c.parent_id && c.id !== editingCat.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                    ))
                  }
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Código Contábil (opcional)
                </label>
                <input
                  type="text"
                  value={editingCat.code ?? ''}
                  onChange={(e) => setEditingCat({ ...editingCat, code: e.target.value || null })}
                  placeholder="Ex: 1.1.1, 4.2..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                             placeholder:text-gray-400 focus:border-brand-primary outline-none"
                />
              </div>
            </div>
          </DrawerCard>
        )}
      </Drawer>
    </div>
  );
}
