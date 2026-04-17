/**
 * NfseSettingsPanel
 *
 * Painel de configuração do emissor NFS-e.
 * Self-contained — carrega/salva direto em `company_nfse_config`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';
import { SelectDropdown } from '../../components/FormField';
import {
  Building2, FileText, DollarSign, Plug, Activity,
  Loader2, Check, Save, Eye, EyeOff, Zap,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Ambiente = 'homologacao' | 'producao';
type Provider = 'focus' | 'enotas' | 'nuvem_fiscal' | 'nfse_io' | 'outro' | '';
type IntegrationStatus = 'none' | 'homologacao' | 'ativa' | 'erro';

interface NfseConfig {
  id?: string;
  inscricao_municipal: string;
  codigo_municipio_ibge: string;
  ambiente: Ambiente;
  serie: string;
  proximo_numero: number;
  aliq_iss_padrao: number;
  reter_pis: boolean;
  reter_cofins: boolean;
  reter_csll: boolean;
  reter_irpj: boolean;
  reter_inss: boolean;
  optante_simples: boolean;
  incentivador_cultural: boolean;
  provider: Provider;
  api_token_enc: string;
  api_base_url: string;
  webhook_url: string;
  webhook_secret: string;
  integration_status: IntegrationStatus;
  last_test_at: string | null;
  last_test_result: string | null;
}

const EMPTY: NfseConfig = {
  inscricao_municipal: '',
  codigo_municipio_ibge: '',
  ambiente: 'homologacao',
  serie: '1',
  proximo_numero: 1,
  aliq_iss_padrao: 2,
  reter_pis: false,
  reter_cofins: false,
  reter_csll: false,
  reter_irpj: false,
  reter_inss: false,
  optante_simples: false,
  incentivador_cultural: false,
  provider: '',
  api_token_enc: '',
  api_base_url: '',
  webhook_url: '',
  webhook_secret: '',
  integration_status: 'none',
  last_test_at: null,
  last_test_result: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Retenção row ──────────────────────────────────────────────────────────────

function RetencaoRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── Input / Label helpers ─────────────────────────────────────────────────────

const LABEL_CLS = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';
const INPUT_CLS = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none';

// ── Main Component ────────────────────────────────────────────────────────────

export default function NfseSettingsPanel() {
  const [form, setForm] = useState<NfseConfig>(EMPTY);
  const [origForm, setOrigForm] = useState<NfseConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showToken, setShowToken] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Webhook URL from env (edge function public URL)
  const webhookFnUrl = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/nfse-webhook`;

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('company_nfse_config')
      .select('*')
      .maybeSingle();
    const loaded = data ? (data as unknown as NfseConfig) : EMPTY;
    setForm(loaded);
    setOrigForm(loaded);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function set<K extends keyof NfseConfig>(key: K, value: NfseConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── hasChanges ────────────────────────────────────────────────────────────

  const hasChanges = JSON.stringify(form) !== JSON.stringify(origForm);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (saving) return;
    setSaving(true);

    const payload = { ...form };
    let error: unknown = null;

    if (form.id) {
      const res = await supabase
        .from('company_nfse_config')
        .update(payload)
        .eq('id', form.id);
      error = res.error;
    } else {
      const res = await supabase
        .from('company_nfse_config')
        .insert(payload)
        .select('id')
        .single();
      error = res.error;
      if (!error && res.data) {
        setForm((prev) => ({ ...prev, id: (res.data as { id: string }).id }));
      }
    }

    setSaving(false);

    if (error) {
      console.error('[NfseSettingsPanel] save error:', error);
      return;
    }

    logAudit({
      action: 'update',
      module: 'nfse-settings',
      description: 'Configurações NFS-e salvas',
    });

    setOrigForm({ ...form });
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 900);
  }

  // ── Test connection ───────────────────────────────────────────────────────

  async function handleTest() {
    if (testLoading) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('nfse-emitter', {
        body: { action: 'test' },
      });
      if (error) {
        setTestResult(`Erro: ${error.message}`);
      } else {
        setTestResult(JSON.stringify(data, null, 2));
        // Update integration_status from result if present
        if (data?.status) {
          set('integration_status', data.status as IntegrationStatus);
        }
        set('last_test_at', new Date().toISOString());
        set('last_test_result', typeof data?.message === 'string' ? data.message : 'OK');
      }
    } catch (e: unknown) {
      setTestResult(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
    }
    setTestLoading(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* ── 1. Emitente NFS-e ────────────────────────────────────────────── */}
      <SettingsCard
        title="Emitente NFS-e"
        description="Dados cadastrais do emitente para geração das notas"
        icon={Building2}
        collapseId="nfse.emitente"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLS}>Inscrição Municipal</label>
            <input
              type="text"
              value={form.inscricao_municipal}
              onChange={(e) => set('inscricao_municipal', e.target.value)}
              placeholder="Ex.: 123456789"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Código Município IBGE</label>
            <input
              type="text"
              value={form.codigo_municipio_ibge}
              onChange={(e) => set('codigo_municipio_ibge', e.target.value)}
              placeholder="Ex.: 2604106"
              className={INPUT_CLS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Optante pelo Simples Nacional</p>
              <p className="text-xs text-gray-400 mt-0.5">Impacta cálculo e alíquotas de ISS</p>
            </div>
            <Toggle checked={form.optante_simples} onChange={(v) => set('optante_simples', v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Incentivador Cultural</p>
              <p className="text-xs text-gray-400 mt-0.5">Campo obrigatório em alguns municípios</p>
            </div>
            <Toggle checked={form.incentivador_cultural} onChange={(v) => set('incentivador_cultural', v)} />
          </div>
        </div>
      </SettingsCard>

      {/* ── 2. Emissão ───────────────────────────────────────────────────── */}
      <SettingsCard
        title="Emissão"
        description="Parâmetros padrão para emissão das NFS-e"
        icon={FileText}
        collapseId="nfse.emissao"
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
              type="text"
              value={form.serie}
              onChange={(e) => set('serie', e.target.value)}
              placeholder="1"
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
          <div>
            <label className={LABEL_CLS}>Alíquota ISS Padrão (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.aliq_iss_padrao}
              onChange={(e) => set('aliq_iss_padrao', parseFloat(e.target.value) || 0)}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </SettingsCard>

      {/* ── 3. Tributação Padrão ─────────────────────────────────────────── */}
      <SettingsCard
        title="Tributação Padrão"
        description="Retenções que serão aplicadas por padrão nas notas emitidas"
        icon={DollarSign}
        collapseId="nfse.tributacao"
      >
        <RetencaoRow
          label="Reter PIS"
          description="Programa de Integração Social"
          checked={form.reter_pis}
          onChange={(v) => set('reter_pis', v)}
        />
        <RetencaoRow
          label="Reter COFINS"
          description="Contribuição para o Financiamento da Seguridade Social"
          checked={form.reter_cofins}
          onChange={(v) => set('reter_cofins', v)}
        />
        <RetencaoRow
          label="Reter CSLL"
          description="Contribuição Social sobre o Lucro Líquido"
          checked={form.reter_csll}
          onChange={(v) => set('reter_csll', v)}
        />
        <RetencaoRow
          label="Reter IRPJ"
          description="Imposto de Renda Pessoa Jurídica"
          checked={form.reter_irpj}
          onChange={(v) => set('reter_irpj', v)}
        />
        <RetencaoRow
          label="Reter INSS"
          description="Instituto Nacional do Seguro Social"
          checked={form.reter_inss}
          onChange={(v) => set('reter_inss', v)}
        />
      </SettingsCard>

      {/* ── 4. Integração com Provider ───────────────────────────────────── */}
      <SettingsCard
        title="Integração com Provider"
        description="Credenciais e endpoints do provedor de NFS-e"
        icon={Plug}
        collapseId="nfse.provider"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <SelectDropdown
              label="Provider"
              value={form.provider}
              onChange={(e) => set('provider', e.target.value as Provider)}
            >
              <option value="">Selecionar provider…</option>
              <option value="focus">Focus NFe</option>
              <option value="enotas">eNotas</option>
              <option value="nuvem_fiscal">Nuvem Fiscal</option>
              <option value="nfse_io">NFS-e.io</option>
              <option value="outro">Outro</option>
            </SelectDropdown>
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>URL da API</label>
            <input
              type="url"
              value={form.api_base_url}
              onChange={(e) => set('api_base_url', e.target.value)}
              placeholder="https://api.provider.com/v1"
              className={INPUT_CLS}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>Token da API</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={form.api_token_enc}
                onChange={(e) => set('api_token_enc', e.target.value)}
                placeholder="Token de autenticação"
                className={`${INPUT_CLS} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
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
            <p className="text-[11px] text-gray-400 mt-1">
              Cadastre esta URL no painel do provider para receber callbacks de status das NFS-e.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* ── 5. Status da Integração ──────────────────────────────────────── */}
      <SettingsCard
        title="Status da Integração"
        description="Situação atual da conexão com o provider e histórico de testes"
        icon={Activity}
        collapseId="nfse.status"
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
          {testLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
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
