/**
 * NfeSettingsPanel
 *
 * Painel de configuração do emissor NF-e (modelo 55) — escopo v1: devolução ao fornecedor.
 * Self-contained — carrega/salva direto em `company_nfe_config`.
 *
 * Certificado digital A1 é compartilhado com NFS-e via Nuvem Fiscal
 * (uma empresa = um certificado), então o upload é feito no painel de NFS-e.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { SelectDropdown } from '../../components/FormField';
import {
  Building2, FileText, Plug, Activity,
  Loader2, Check, Save, Zap,
} from 'lucide-react';

type Ambiente = 'homologacao' | 'producao';
type Provider = 'nuvem_fiscal' | 'outro' | '';
type IntegrationStatus = 'none' | 'homologacao' | 'ativa' | 'erro';
type RegimeTributario = 'simples_nacional' | 'lucro_presumido' | 'lucro_real';

/**
 * Dados do emitente — vivem em `company_fiscal_config` (tabela compartilhada
 * com NFS-e/NFC-e/Perfis Fiscais). NF-e mantém a numeração/integração em
 * `company_nfe_config` (tabela separada deste painel). Mesclamos no UI mas
 * mantemos as tabelas separadas pra não migrar dados existentes.
 */
interface EmitenteConfig {
  id?: string;
  razao_social: string;
  ie: string;
  regime_tributario: RegimeTributario;
}

const EMITENTE_EMPTY: EmitenteConfig = {
  razao_social: '',
  ie: '',
  regime_tributario: 'simples_nacional',
};

interface NfeConfig {
  id?: string;
  ambiente: Ambiente;
  serie: number;
  proximo_numero: number;
  provider: Provider;
  api_token_enc: string;
  api_base_url: string;
  webhook_url: string;
  webhook_secret: string;
  integration_status: IntegrationStatus;
  last_test_at: string | null;
  last_test_result: string | null;
}

const EMPTY: NfeConfig = {
  ambiente: 'homologacao',
  serie: 1,
  proximo_numero: 1,
  provider: 'nuvem_fiscal',
  api_token_enc: '',
  api_base_url: '',
  webhook_url: '',
  webhook_secret: '',
  integration_status: 'none',
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

export default function NfeSettingsPanel() {
  const [form, setForm] = useState<NfeConfig>(EMPTY);
  const [origForm, setOrigForm] = useState<NfeConfig>(EMPTY);
  const [emitente, setEmitente] = useState<EmitenteConfig>(EMITENTE_EMPTY);
  const [origEmitente, setOrigEmitente] = useState<EmitenteConfig>(EMITENTE_EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const webhookFnUrl = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/nfe-webhook`;

  const load = useCallback(async () => {
    setLoading(true);
    const [nfeRes, emitRes] = await Promise.all([
      supabase.from('company_nfe_config').select('*').maybeSingle(),
      supabase.from('company_fiscal_config')
        .select('id, razao_social, ie, regime_tributario')
        .limit(1)
        .maybeSingle(),
    ]);
    const loaded = nfeRes.data ? (nfeRes.data as unknown as NfeConfig) : EMPTY;
    setForm(loaded);
    setOrigForm(loaded);
    const loadedEmit: EmitenteConfig = emitRes.data
      ? {
          id: (emitRes.data as { id: string }).id,
          razao_social: (emitRes.data as { razao_social: string | null }).razao_social ?? '',
          ie: (emitRes.data as { ie: string | null }).ie ?? '',
          regime_tributario:
            ((emitRes.data as { regime_tributario: RegimeTributario | null }).regime_tributario
              ?? 'simples_nacional'),
        }
      : EMITENTE_EMPTY;
    setEmitente(loadedEmit);
    setOrigEmitente(loadedEmit);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof NfeConfig>(key: K, value: NfeConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setEmit<K extends keyof EmitenteConfig>(key: K, value: EmitenteConfig[K]) {
    setEmitente((prev) => ({ ...prev, [key]: value }));
  }

  const hasChanges =
    JSON.stringify(form) !== JSON.stringify(origForm) ||
    JSON.stringify(emitente) !== JSON.stringify(origEmitente);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const payload = { ...form };
    let error: unknown = null;

    if (form.id) {
      const res = await supabase.from('company_nfe_config').update(payload).eq('id', form.id);
      error = res.error;
    } else {
      const res = await supabase.from('company_nfe_config').insert(payload).select('id').single();
      error = res.error;
      if (!error && res.data) {
        setForm((prev) => ({ ...prev, id: (res.data as { id: string }).id }));
      }
    }

    // Emitente — UPSERT em company_fiscal_config (compartilhado com NFS-e/NFC-e/Perfis)
    const emitPayload = {
      razao_social: emitente.razao_social,
      ie: emitente.ie,
      regime_tributario: emitente.regime_tributario,
      updated_at: new Date().toISOString(),
    };
    if (emitente.id) {
      const res = await supabase.from('company_fiscal_config').update(emitPayload).eq('id', emitente.id);
      if (res.error) error = res.error;
    } else {
      const res = await supabase.from('company_fiscal_config').insert(emitPayload).select('id').single();
      if (res.error) error = res.error;
      else if (res.data) setEmitente((prev) => ({ ...prev, id: (res.data as { id: string }).id }));
    }

    setSaving(false);
    if (error) {
      console.error('[NfeSettingsPanel] save error:', error);
      return;
    }

    logAudit({
      action: 'update',
      module: 'nfe-settings',
      description: 'Configurações NF-e salvas',
    });

    setOrigForm({ ...form });
    setOrigEmitente({ ...emitente });
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 900);
  }

  async function handleTest() {
    if (testLoading) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('nfe-emitter', {
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
      {/* ── 0. Dados do Emitente ─────────────────────────────────────────── */}
      <SettingsCard
        title="Dados do Emitente"
        description="Informações fiscais específicas da empresa emissora de NF-e"
        icon={Building2}
        collapseId="nfe.emitente"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 text-sm text-blue-700 dark:text-blue-300">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
            <span>
              CNPJ, nome fantasia, endereço e demais dados cadastrais são gerenciados em{' '}
              <a href="/admin/configuracoes?tab=institutional" className="font-semibold underline hover:opacity-80">
                Configurações › Institucional
              </a>.
            </span>
          </div>
          <div>
            <label className={LABEL_CLS}>Razão Social</label>
            <input
              type="text"
              value={emitente.razao_social}
              onChange={(e) => setEmit('razao_social', e.target.value)}
              placeholder="Razão Social Ltda"
              className={INPUT_CLS}
            />
            <p className="text-[11px] text-gray-400 mt-1">Nome jurídico exato conforme registro — pode diferir do nome fantasia.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={emitente.ie}
                onChange={(e) => setEmit('ie', e.target.value)}
                placeholder="000000000"
                className={INPUT_CLS}
              />
            </div>
            <SelectDropdown
              label="Regime Tributário"
              value={emitente.regime_tributario}
              onChange={(e) => setEmit('regime_tributario', e.target.value as RegimeTributario)}
            >
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </SelectDropdown>
          </div>
        </div>
      </SettingsCard>

      {/* ── 1. Emissão ───────────────────────────────────────────────────── */}
      <SettingsCard
        title="Emissão"
        description="Parâmetros padrão para emissão das NF-e de devolução"
        icon={FileText}
        collapseId="nfe.emissao"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <p className="text-[11px] text-gray-400 mt-2">
          Escopo atual: NF-e de devolução ao fornecedor. Emissão sempre manual a partir da listagem de notas de entrada.
          Certificado digital A1 é compartilhado com NFS-e (mesmo CNPJ no vault Nuvem Fiscal).
        </p>
      </SettingsCard>

      {/* ── 2. Webhook ────────────────────────────────────────────────────── */}
      <SettingsCard
        title="Webhook de callbacks"
        description="Cadastre esta URL no painel do provedor para receber atualizações de status das NF-e."
        icon={Plug}
        collapseId="nfe.webhook"
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

      {/* ── 3. Status da Integração ──────────────────────────────────────── */}
      <SettingsCard
        title="Status da Integração"
        description="Situação atual da conexão com o provider e histórico de testes"
        icon={Activity}
        collapseId="nfe.status"
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
