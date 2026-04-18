/**
 * FiscalProviderCredentialsPanel
 *
 * Credenciais OAuth2 do provedor fiscal (Nuvem Fiscal). Um par
 * client_id/client_secret serve para NF-e, NFC-e, NFS-e e consulta de
 * empresa/CNPJ/CEP — por isso as credenciais ficam centralizadas aqui
 * e os painéis de cada documento só configuram séries, ambiente SEFAZ,
 * CSC, webhooks etc.
 *
 * A Nuvem Fiscal troca o par (client_id, client_secret) por um bearer
 * token em https://auth.nuvemfiscal.com.br/oauth/token (grant_type=
 * client_credentials). O token vive ~30 dias e é cacheado pelo backend.
 *
 * Tabela: `fiscal_provider_credentials` (singleton).
 * Teste: edge function `fiscal-provider-test` (faz um token exchange).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { SelectDropdown } from '../../components/FormField';
import {
  KeyRound, Plug, Activity, Loader2, Check, Save, Eye, EyeOff, Zap,
  ExternalLink, Gauge, RefreshCw,
} from 'lucide-react';

type Environment = 'sandbox' | 'production';
type Provider = 'nuvem_fiscal';

interface ProviderCredentials {
  id?: string;
  provider: Provider;
  client_id: string;
  client_secret_enc: string;
  environment: Environment;
  scopes: string;
}

const DEFAULT_SCOPES = 'empresa nfe nfce nfse cnpj cep conta';

interface QuotaRow {
  nome: string;
  consumo: number;
  limite: number;
}

interface QuotasResult {
  ok: boolean;
  data?: QuotaRow[];
  fetched_at?: string;
  error?: string;
  status?: number;
}

/** Rótulo amigável por nome de cota conhecido. */
const QUOTA_LABELS: Record<string, string> = {
  'nfe-emissao':       'NF-e · Emissões',
  'nfce-emissao':      'NFC-e · Emissões',
  'nfse-emissao':      'NFS-e · Emissões',
  'dfe-eventos':       'DF-e · Eventos',
  'cnpj-consultas':    'CNPJ · Consultas',
  'cnpj-listagem':     'CNPJ · Listagem',
  'cep-consultas':     'CEP · Consultas',
  'empresa-certificados': 'Empresas · Certificados',
};

function quotaLabel(nome: string): string {
  return QUOTA_LABELS[nome] ?? nome;
}

const EMPTY: ProviderCredentials = {
  provider: 'nuvem_fiscal',
  client_id: '',
  client_secret_enc: '',
  environment: 'sandbox',
  scopes: DEFAULT_SCOPES,
};

const LABEL_CLS = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';
const INPUT_CLS = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none';

interface TestResult {
  ok: boolean;
  environment?: string;
  expires_at?: string;
  error?: string;
  status?: number;
}

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function FiscalProviderCredentialsPanel() {
  const [form, setForm] = useState<ProviderCredentials>(EMPTY);
  const [origForm, setOrigForm] = useState<ProviderCredentials>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showSecret, setShowSecret] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [quotasLoading, setQuotasLoading] = useState(false);
  const [quotas, setQuotas] = useState<QuotasResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fiscal_provider_credentials')
      .select('*')
      .eq('provider', 'nuvem_fiscal')
      .maybeSingle();
    const loaded = data ? (data as unknown as ProviderCredentials) : EMPTY;
    setForm(loaded);
    setOrigForm(loaded);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof ProviderCredentials>(key: K, value: ProviderCredentials[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const hasChanges = JSON.stringify(form) !== JSON.stringify(origForm);
  const canSave = form.client_id.trim().length > 0 && form.client_secret_enc.trim().length > 0;

  async function handleSave() {
    if (saving || !canSave) return;
    setSaving(true);
    const payload = { ...form, scopes: form.scopes.trim() || DEFAULT_SCOPES };
    let error: unknown = null;

    if (form.id) {
      const res = await supabase
        .from('fiscal_provider_credentials')
        .update(payload)
        .eq('id', form.id);
      error = res.error;
    } else {
      const res = await supabase
        .from('fiscal_provider_credentials')
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
      console.error('[FiscalProviderCredentialsPanel] save error:', error);
      return;
    }

    logAudit({
      action: 'update',
      module: 'settings',
      description: 'Credenciais do provedor fiscal (Nuvem Fiscal) atualizadas',
    });

    setOrigForm({ ...form });
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 900);
  }

  const loadQuotas = useCallback(async () => {
    setQuotasLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-provider-quotas', { body: {} });
      if (error) {
        setQuotas({ ok: false, error: error.message });
      } else {
        setQuotas(data as QuotasResult);
      }
    } catch (e: unknown) {
      setQuotas({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    setQuotasLoading(false);
  }, []);

  // Auto-load quotas once when credentials exist.
  useEffect(() => {
    if (!loading && origForm.id && !quotas) void loadQuotas();
  }, [loading, origForm.id, quotas, loadQuotas]);

  async function handleTest() {
    if (testLoading) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-provider-test', { body: {} });
      if (error) {
        setTestResult({ ok: false, error: error.message });
      } else {
        setTestResult(data as TestResult);
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
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
      {/* ── 1. Provedor + ambiente ───────────────────────────────────────── */}
      <SettingsCard
        title="Provedor fiscal"
        description="Escolha do provedor e ambiente (sandbox / produção). As credenciais abaixo são compartilhadas entre NF-e, NFC-e e NFS-e."
        icon={Plug}
        collapseId="fiscal-provider.provider"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectDropdown
            label="Provedor"
            value={form.provider}
            onChange={(e) => set('provider', e.target.value as Provider)}
          >
            <option value="nuvem_fiscal">Nuvem Fiscal</option>
          </SelectDropdown>

          <SelectDropdown
            label="Ambiente da API"
            value={form.environment}
            onChange={(e) => set('environment', e.target.value as Environment)}
          >
            <option value="sandbox">Sandbox (api.sandbox.nuvemfiscal.com.br)</option>
            <option value="production">Produção (api.nuvemfiscal.com.br)</option>
          </SelectDropdown>
        </div>

        <p className="text-[11px] text-gray-400 mt-2">
          O ambiente SEFAZ (homologação / produção) das notas continua sendo configurado em
          cada aba específica (NF-e, NFC-e, NFS-e).
        </p>
      </SettingsCard>

      {/* ── 2. Credenciais OAuth2 ────────────────────────────────────────── */}
      <SettingsCard
        title="Credenciais OAuth2"
        description="client_id + client_secret gerados no painel da Nuvem Fiscal. O backend troca esse par por um bearer token válido por 30 dias."
        icon={KeyRound}
        collapseId="fiscal-provider.credentials"
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={LABEL_CLS}>Client ID</label>
            <input
              type="text"
              value={form.client_id}
              onChange={(e) => set('client_id', e.target.value)}
              placeholder="Ex.: 3fda2c..."
              className={INPUT_CLS}
              autoComplete="off"
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Client Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={form.client_secret_enc}
                onChange={(e) => set('client_secret_enc', e.target.value)}
                placeholder="Secret gerado no painel da Nuvem Fiscal"
                className={`${INPUT_CLS} pr-11`}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Escopos</label>
            <input
              type="text"
              value={form.scopes}
              onChange={(e) => set('scopes', e.target.value)}
              placeholder={DEFAULT_SCOPES}
              className={INPUT_CLS}
              autoComplete="off"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Separe por espaço. Padrão cobre os endpoints usados pelo sistema: emissão de notas,
              cadastro de empresas e consultas auxiliares.
            </p>
          </div>
        </div>

        <a
          href="https://dev.nuvemfiscal.com.br/docs/autenticacao"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-brand-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Documentação oficial: como gerar client_id e client_secret
        </a>
      </SettingsCard>

      {/* ── 3. Teste de conexão ──────────────────────────────────────────── */}
      <SettingsCard
        title="Teste de conexão"
        description="Executa um token exchange com o provedor e valida as credenciais."
        icon={Activity}
        collapseId="fiscal-provider.test"
      >
        <button
          type="button"
          onClick={handleTest}
          disabled={testLoading || !form.client_id || !form.client_secret_enc || hasChanges}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-primary/40 text-brand-primary text-sm font-medium hover:bg-brand-primary/5 disabled:opacity-50 transition-colors"
          title={hasChanges ? 'Salve antes de testar' : undefined}
        >
          {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {testLoading ? 'Testando…' : 'Testar Conexão'}
        </button>

        {hasChanges && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
            Salve as credenciais antes de testar — o teste usa o que já está no banco.
          </p>
        )}

        {testResult && (
          <div className={`mt-3 rounded-xl border p-3 text-sm ${
            testResult.ok
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}>
            {testResult.ok ? (
              <div className="space-y-1">
                <p className="font-semibold">✓ Conexão estabelecida</p>
                <p className="text-xs">Ambiente: <span className="font-mono">{testResult.environment}</span></p>
                <p className="text-xs">Token expira em: <span className="font-mono">{fmtDatetime(testResult.expires_at)}</span></p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold">✗ Falha na autenticação</p>
                {testResult.status !== undefined && <p className="text-xs">HTTP {testResult.status}</p>}
                <p className="text-xs font-mono">{testResult.error ?? 'Erro desconhecido'}</p>
              </div>
            )}
          </div>
        )}
      </SettingsCard>

      {/* ── 4. Consumo e cotas ───────────────────────────────────────────── */}
      <SettingsCard
        title="Consumo e cotas"
        description="Dados vindos de GET /conta/cotas. Mostra o quanto da sua franquia mensal já foi utilizada."
        icon={Gauge}
        collapseId="fiscal-provider.quotas"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-gray-400">
            {quotas?.ok && quotas.fetched_at
              ? <>Última consulta: <span className="font-mono">{fmtDatetime(quotas.fetched_at)}</span></>
              : quotasLoading
                ? 'Carregando…'
                : 'Clique em atualizar para buscar o consumo atual.'}
          </div>
          <button
            type="button"
            onClick={loadQuotas}
            disabled={quotasLoading || !origForm.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            title={!origForm.id ? 'Salve credenciais antes' : undefined}
          >
            {quotasLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Atualizar
          </button>
        </div>

        {quotas && !quotas.ok && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold">Falha ao consultar cotas</p>
            {quotas.status !== undefined && <p className="text-xs">HTTP {quotas.status}</p>}
            <p className="text-xs font-mono mt-1">{quotas.error ?? 'Erro desconhecido'}</p>
          </div>
        )}

        {quotas?.ok && quotas.data && quotas.data.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">Nenhuma cota reportada pelo provedor.</p>
        )}

        {quotas?.ok && quotas.data && quotas.data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quotas.data.map((q) => {
              const limit = Math.max(0, Number(q.limite) || 0);
              const used  = Math.max(0, Number(q.consumo) || 0);
              const pct   = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              const remaining = Math.max(0, limit - used);
              const barColor =
                pct >= 90 ? 'bg-red-500'
                : pct >= 70 ? 'bg-amber-500'
                : 'bg-emerald-500';
              const unlimited = limit === 0;
              return (
                <div key={q.nome} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {quotaLabel(q.nome)}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">{q.nome}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-xl font-bold text-gray-800 dark:text-white">{used.toLocaleString('pt-BR')}</span>
                    <span className="text-sm text-gray-400">/ {unlimited ? 'ilimitado' : limit.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full ${unlimited ? 'bg-gray-300 dark:bg-gray-600' : barColor} transition-all`}
                      style={{ width: unlimited ? '100%' : `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-400">
                    <span>{unlimited ? '—' : `${pct}% usado`}</span>
                    <span>{unlimited ? '' : `Restante: ${remaining.toLocaleString('pt-BR')}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {/* ── Floating Save ────────────────────────────────────────────────── */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving || !canSave}
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
