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
  ExternalLink,
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

const DEFAULT_SCOPES = 'empresa nfe nfce nfse cnpj cep';

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
