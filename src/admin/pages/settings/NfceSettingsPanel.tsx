/**
 * NfceSettingsPanel
 *
 * Painel de configuração do emissor NFC-e (modelo 65).
 * Self-contained — carrega/salva direto em `company_nfce_config`.
 *
 * Certificado digital A1 é compartilhado com NFS-e via Nuvem Fiscal
 * (uma empresa = um certificado), então o upload é feito no painel de NFS-e.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';
import { SelectDropdown } from '../../components/FormField';
import {
  FileText, Plug, Activity, KeyRound,
  Loader2, Check, Save, Eye, EyeOff, Zap,
} from 'lucide-react';

type Ambiente = 'homologacao' | 'producao';
type Provider = 'nuvem_fiscal' | 'outro' | '';
type IntegrationStatus = 'none' | 'homologacao' | 'ativa' | 'erro';

interface NfceConfig {
  id?: string;
  ambiente: Ambiente;
  serie: number;
  proximo_numero: number;
  csc: string;
  id_csc: string;
  provider: Provider;
  api_token_enc: string;
  api_base_url: string;
  webhook_url: string;
  webhook_secret: string;
  integration_status: IntegrationStatus;
  auto_emit_on_payment: boolean;
  last_test_at: string | null;
  last_test_result: string | null;
}

const EMPTY: NfceConfig = {
  ambiente: 'homologacao',
  serie: 1,
  proximo_numero: 1,
  csc: '',
  id_csc: '',
  provider: 'nuvem_fiscal',
  api_token_enc: '',
  api_base_url: '',
  webhook_url: '',
  webhook_secret: '',
  integration_status: 'none',
  auto_emit_on_payment: false,
  last_test_at: null,
  last_test_result: null,
};

function fmtDatetime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const INTEGRATION_STATUS_CFG: Record<IntegrationStatus, { label: string; cls: string }> = {
  none:        { label: 'Não configurada', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  homologacao: { label: 'Homologação',     cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  ativa:       { label: 'Ativa',           cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  erro:        { label: 'Erro',            cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
};

function IntegrationBadge({ status }: { status: IntegrationStatus }) {
  const cfg = INTEGRATION_STATUS_CFG[status] ?? INTEGRATION_STATUS_CFG.none;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const LABEL_CLS = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';
const INPUT_CLS = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none';

export default function NfceSettingsPanel() {
  const [form, setForm] = useState<NfceConfig>(EMPTY);
  const [origForm, setOrigForm] = useState<NfceConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCsc, setShowCsc] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const webhookFnUrl = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/nfce-webhook`;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('company_nfce_config')
      .select('*')
      .maybeSingle();
    const loaded = data ? (data as unknown as NfceConfig) : EMPTY;
    setForm(loaded);
    setOrigForm(loaded);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof NfceConfig>(key: K, value: NfceConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const hasChanges = JSON.stringify(form) !== JSON.stringify(origForm);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const payload = { ...form };
    let error: unknown = null;

    if (form.id) {
      const res = await supabase.from('company_nfce_config').update(payload).eq('id', form.id);
      error = res.error;
    } else {
      const res = await supabase.from('company_nfce_config').insert(payload).select('id').single();
      error = res.error;
      if (!error && res.data) {
        setForm((prev) => ({ ...prev, id: (res.data as { id: string }).id }));
      }
    }

    setSaving(false);
    if (error) {
      console.error('[NfceSettingsPanel] save error:', error);
      return;
    }

    logAudit({
      action: 'update',
      module: 'nfce-settings',
      description: 'Configurações NFC-e salvas',
    });

    setOrigForm({ ...form });
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 900);
  }

  async function handleTest() {
    if (testLoading) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('nfce-emitter', {
        body: { action: 'test' },
      });
      if (error) {
        setTestResult(`Erro: ${error.message}`);
      } else {
        setTestResult(JSON.stringify(data, null, 2));
        if (data?.status) set('integration_status', data.status as IntegrationStatus);
        set('last_test_at', new Date().toISOString());
        set('last_test_result', typeof data?.message === 'string' ? data.message : 'OK');
      }
    } catch (e: unknown) {
      setTestResult(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
    }
    setTestLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* ── 1. Emissão ───────────────────────────────────────────────────── */}
      <SettingsCard
        title="Emissão"
        description="Parâmetros padrão para emissão das NFC-e"
        icon={FileText}
        collapseId="nfce.emissao"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectDropdown
            label="Ambiente"
            value={form.ambiente}
            onChange={(e) => set('ambiente', e.target.value as Ambiente)}
          >
            <option value="homologacao">Homologação (testes)</option>
            <option value="producao">Produção</option>
          </SelectDropdown>
          <div>
            <label className={LABEL_CLS}>Série</label>
            <input
              type="number"
              min={1}
              value={form.serie}
              onChange={(e) => set('serie', parseInt(e.target.value) || 1)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Próximo Número</label>
            <input
              type="number"
              min={1}
              value={form.proximo_numero}
              onChange={(e) => set('proximo_numero', parseInt(e.target.value) || 1)}
              className={INPUT_CLS}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Emitir NFC-e automaticamente ao confirmar venda</p>
            <p className="text-xs text-gray-400 mt-0.5">Quando um pedido da loja é pago, a nota é emitida sem intervenção manual</p>
          </div>
          <Toggle checked={form.auto_emit_on_payment} onChange={(v) => set('auto_emit_on_payment', v)} onColor="bg-emerald-500" />
        </div>
      </SettingsCard>

      {/* ── 2. CSC (Código de Segurança do Contribuinte) ─────────────────── */}
      <SettingsCard
        title="CSC — Código de Segurança do Contribuinte"
        description="Fornecido pela SEFAZ do estado ao credenciar o emitente. Usado para assinar o QRCode do DANFE NFC-e."
        icon={KeyRound}
        collapseId="nfce.csc"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={LABEL_CLS}>ID do CSC</label>
            <input
              type="text"
              value={form.id_csc}
              onChange={(e) => set('id_csc', e.target.value)}
              placeholder="Ex.: 000001"
              className={INPUT_CLS}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>Token CSC</label>
            <div className="relative">
              <input
                type={showCsc ? 'text' : 'password'}
                value={form.csc}
                onChange={(e) => set('csc', e.target.value)}
                placeholder="Token alfanumérico fornecido pela SEFAZ"
                className={`${INPUT_CLS} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowCsc((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showCsc ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Obtidos no portal da SEFAZ estadual após habilitação do CNPJ para emissão de NFC-e.
          Mantenha em sigilo — o CSC é usado para autenticar todas as notas emitidas.
        </p>
      </SettingsCard>

      {/* ── 3. Webhook ────────────────────────────────────────────────────── */}
      <SettingsCard
        title="Webhook de callbacks"
        description="Cadastre esta URL no painel do provedor para receber atualizações de status das NFC-e."
        icon={Plug}
        collapseId="nfce.webhook"
      >
        <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 dark:bg-brand-primary/10 p-3 text-xs text-brand-primary dark:text-brand-secondary mb-4">
          As credenciais (client_id / client_secret) e o ambiente da API são configurados em
          <strong> Configurações → Fiscal → Provedor</strong>. Um único par serve para NF-e, NFC-e e NFS-e.
        </div>

        <label className={LABEL_CLS}>URL do Webhook (somente leitura)</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={webhookFnUrl}
            className={`${INPUT_CLS} bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-default`}
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(webhookFnUrl)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            Copiar
          </button>
        </div>
      </SettingsCard>

      {/* ── 4. Status da Integração ──────────────────────────────────────── */}
      <SettingsCard
        title="Status da Integração"
        description="Situação atual da conexão com o provider e histórico de testes"
        icon={Activity}
        collapseId="nfce.status"
      >
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className={LABEL_CLS}>Status</p>
            <IntegrationBadge status={form.integration_status} />
          </div>
          <div>
            <p className={LABEL_CLS}>Último Teste</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{fmtDatetime(form.last_test_at)}</p>
          </div>
          {form.last_test_result && (
            <div className="flex-1 min-w-[200px]">
              <p className={LABEL_CLS}>Resultado</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{form.last_test_result}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleTest}
          disabled={testLoading || !form.provider}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-primary/40 text-brand-primary text-sm font-medium hover:bg-brand-primary/5 disabled:opacity-50 transition-colors"
        >
          {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {testLoading ? 'Testando…' : 'Testar Conexão'}
        </button>

        {testResult && (
          <pre className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
            {testResult}
          </pre>
        )}
      </SettingsCard>

      {/* ── Floating Save ────────────────────────────────────────────────── */}
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
    </div>
  );
}
