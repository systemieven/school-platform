/**
 * FinancialSettingsPanel
 *
 * Painel da aba "Financeiro" em /admin/configuracoes.
 * 3 seções: Gateways de Pagamento, Régua de Cobrança, Chave PIX.
 * Self-contained — carrega/salva direto no Supabase.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { Drawer, DrawerCard } from '../../components/Drawer';
import type { PaymentGateway, GatewayProvider, GatewayEnvironment } from '../../types/admin.types';
import { GATEWAY_PROVIDER_LABELS } from '../../types/admin.types';
import {
  CreditCard, Loader2, Save, Check, Pencil, Trash2,
  X, ToggleLeft, ToggleRight, Zap, QrCode,
  Shield, Tag, Settings, Star, Wifi, WifiOff,
} from 'lucide-react';

// ── Billing stage config ─────────────────────────────────────────────────────

interface BillingStage {
  stage: string;
  label: string;
  enabled: boolean;
  template_id: string | null;
}

const DEFAULT_STAGES: BillingStage[] = [
  { stage: 'D-5', label: '5 dias antes do vencimento', enabled: false, template_id: null },
  { stage: 'D-1', label: '1 dia antes do vencimento', enabled: false, template_id: null },
  { stage: 'D+0', label: 'No dia do vencimento', enabled: false, template_id: null },
  { stage: 'D+3', label: '3 dias após o vencimento', enabled: false, template_id: null },
  { stage: 'D+10', label: '10 dias após o vencimento', enabled: false, template_id: null },
  { stage: 'D+30', label: '30 dias após o vencimento', enabled: false, template_id: null },
];

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

// ── Component ────────────────────────────────────────────────────────────────

export default function FinancialSettingsPanel() {
  // Gateways
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [gwLoading, setGwLoading] = useState(true);
  const [editingGw, setEditingGw] = useState<Partial<PaymentGateway> | null>(null);
  const [isNewGw, setIsNewGw] = useState(false);
  const [gwSaving, setGwSaving] = useState(false);
  const [gwSaved, setGwSaved] = useState(false);
  const [deleteGwId, setDeleteGwId] = useState<string | null>(null);
  const gwSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Billing stages
  const [stages, setStages] = useState<BillingStage[]>(DEFAULT_STAGES);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [stagesSaving, setStagesSaving] = useState(false);
  const [stagesSaved, setStagesSaved] = useState(false);

  // PIX key
  const [pixType, setPixType] = useState('');
  const [pixValue, setPixValue] = useState('');
  const [pixSaving, setPixSaving] = useState(false);
  const [pixSaved, setPixSaved] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setGwLoading(true);

    const [gwRes, settingsRes, tplRes] = await Promise.all([
      supabase.from('payment_gateways').select('*').order('created_at'),
      supabase.from('system_settings').select('*').eq('category', 'financial'),
      supabase.from('whatsapp_templates')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ]);

    setGateways((gwRes.data ?? []) as PaymentGateway[]);

    // Filter templates by financeiro category
    const allTemplates = (tplRes.data ?? []) as { id: string; name: string }[];
    setTemplates(allTemplates);

    const ss = (settingsRes.data ?? []) as { key: string; value: string }[];

    // Billing stages
    const stagesRaw = ss.find((s) => s.key === 'billing_stages');
    if (stagesRaw) {
      try {
        const parsed = JSON.parse(stagesRaw.value) as BillingStage[];
        setStages(DEFAULT_STAGES.map((d) => {
          const found = parsed.find((p) => p.stage === d.stage);
          return found ? { ...d, enabled: found.enabled, template_id: found.template_id } : d;
        }));
      } catch { /* keep defaults */ }
    }

    // PIX key
    const pType = ss.find((s) => s.key === 'pix_key_type');
    const pValue = ss.find((s) => s.key === 'pix_key_value');
    if (pType) setPixType(pType.value);
    if (pValue) setPixValue(pValue.value);

    setGwLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Gateway CRUD ───────────────────────────────────────────────────────────

  function openNewGw() {
    setEditingGw({
      provider: 'manual' as GatewayProvider,
      label: '',
      environment: 'sandbox' as GatewayEnvironment,
      credentials: {},
      is_active: true,
      is_default: false,
      supported_methods: ['pix', 'boleto'],
    });
    setIsNewGw(true);
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

  // ── Billing stages save ────────────────────────────────────────────────────

  async function saveStages() {
    setStagesSaving(true);
    await supabase.from('system_settings').upsert({
      category: 'financial',
      key: 'billing_stages',
      value: JSON.stringify(stages),
    }, { onConflict: 'category,key' });
    logAudit({ action: 'update', module: 'settings', description: 'Régua de cobrança atualizada' });
    setStagesSaving(false);
    setStagesSaved(true);
    setTimeout(() => setStagesSaved(false), 2500);
  }

  // ── PIX save ───────────────────────────────────────────────────────────────

  async function savePix() {
    setPixSaving(true);
    await Promise.all([
      supabase.from('system_settings').upsert({ category: 'financial', key: 'pix_key_type', value: pixType }, { onConflict: 'category,key' }),
      supabase.from('system_settings').upsert({ category: 'financial', key: 'pix_key_value', value: pixValue }, { onConflict: 'category,key' }),
    ]);
    logAudit({ action: 'update', module: 'settings', description: 'Chave PIX atualizada' });
    setPixSaving(false);
    setPixSaved(true);
    setTimeout(() => setPixSaved(false), 2500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (gwLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
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
        description="Configure quando enviar notificações automáticas de cobrança"
        icon={Zap}
        collapseId="financial.billing"
        headerExtra={
          <button onClick={saveStages} disabled={stagesSaving}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${stagesSaved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
            {stagesSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : stagesSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {stagesSaving ? 'Salvando...' : stagesSaved ? 'Salvo!' : 'Salvar'}
          </button>
        }
      >
        <div className="space-y-2">
          {stages.map((stage, idx) => (
            <div key={stage.stage} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
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
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${stage.enabled ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
                  {stage.stage}
                </p>
                <p className="text-[10px] text-gray-400">{stage.label}</p>
              </div>

              {/* Template selector */}
              <select
                value={stage.template_id || ''}
                onChange={(e) => {
                  const next = [...stages];
                  next[idx] = { ...next[idx], template_id: e.target.value || null };
                  setStages(next);
                }}
                disabled={!stage.enabled}
                className="w-48 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 disabled:opacity-40 focus:border-brand-primary outline-none"
              >
                <option value="">Selecione template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* ── C. Chave PIX ── */}
      <SettingsCard
        title="Chave PIX para Cobranças"
        description="Chave utilizada nas notificações WhatsApp e no portal do aluno"
        icon={QrCode}
        collapseId="financial.pix"
        headerExtra={
          <button onClick={savePix} disabled={pixSaving || !pixType || !pixValue}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${pixSaved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
            {pixSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : pixSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {pixSaving ? 'Salvando...' : pixSaved ? 'Salvo!' : 'Salvar'}
          </button>
        }
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

      {/* ── Gateway Drawer ── */}
      <Drawer
        open={!!editingGw}
        onClose={closeGw}
        title={isNewGw ? 'Novo Gateway' : 'Editar Gateway'}
        icon={CreditCard}
        width="w-[440px]"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={closeGw} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancelar</button>
            <button onClick={saveGw} disabled={!editingGw?.label || !editingGw?.provider || gwSaving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${gwSaved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
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
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${editingGw.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={() => setEditingGw({ ...editingGw, is_active: !editingGw.is_active })}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editingGw.is_active ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Ativo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${editingGw.is_default ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={() => setEditingGw({ ...editingGw, is_default: !editingGw.is_default })}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editingGw.is_default ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Padrão</span>
                </label>
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
    </div>
  );
}
