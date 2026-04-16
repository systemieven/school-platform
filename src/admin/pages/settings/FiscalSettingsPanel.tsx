/**
 * FiscalSettingsPanel
 *
 * Painel da aba "Fiscal" em /admin/configuracoes.
 * Seções: Dados do Emitente, Configurações de Emissão, Integração com Emissor Externo, Perfis Fiscais.
 * Self-contained — carrega/salva direto no Supabase.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { Toggle } from '../../components/Toggle';
import {
  Building2,
  FileText,
  Plug,
  Layers,
  Loader2,
  Check,
  Trash2,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type RegimeTributario = 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
type Ambiente = 'producao' | 'homologacao';
type NfeProvider = 'focus' | 'enotas' | 'nuvem_fiscal' | 'outro' | '';
type NfeIntegrationStatus = 'none' | 'homologacao' | 'ativa';

interface CompanyFiscalConfig {
  id?: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  ie: string;
  im: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  regime_tributario: RegimeTributario;
  ambiente: Ambiente;
  serie_nfe: number;
  proximo_numero_nfe: number;
  cfop_venda_interna: string;
  cfop_venda_interestadual: string;
  cfop_devolucao: string;
  aliq_pis_padrao: number;
  aliq_cofins_padrao: number;
  nfe_provider: NfeProvider;
  nfe_api_token: string;
  nfe_webhook_url: string;
  nfe_integration_status: NfeIntegrationStatus;
  updated_at?: string;
}

interface FiscalProfile {
  id: string;
  name: string;
  description: string;
  ncm: string;
  cest: string;
  cfop_saida: string;
  origem: number;
  unidade_trib: string;
  cst_icms: string;
  csosn: string;
  mod_bc_icms: number;
  aliq_icms: number;
  red_bc_icms: number;
  mva: number;
  cst_pis: string;
  aliq_pis: number;
  cst_cofins: string;
  aliq_cofins: number;
  cst_ipi: string;
  ex_tipi: string;
  aliq_ipi: number;
  gera_nfe: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_CONFIG: CompanyFiscalConfig = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  ie: '',
  im: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cep: '',
  municipio: '',
  uf: '',
  regime_tributario: 'simples_nacional',
  ambiente: 'homologacao',
  serie_nfe: 1,
  proximo_numero_nfe: 1,
  cfop_venda_interna: '',
  cfop_venda_interestadual: '',
  cfop_devolucao: '',
  aliq_pis_padrao: 0,
  aliq_cofins_padrao: 0,
  nfe_provider: '',
  nfe_api_token: '',
  nfe_webhook_url: '',
  nfe_integration_status: 'none',
};

const EMPTY_PROFILE: Omit<FiscalProfile, 'id'> = {
  name: '',
  description: '',
  ncm: '',
  cest: '',
  cfop_saida: '',
  origem: 0,
  unidade_trib: '',
  cst_icms: '',
  csosn: '',
  mod_bc_icms: 0,
  aliq_icms: 0,
  red_bc_icms: 0,
  mva: 0,
  cst_pis: '',
  aliq_pis: 0,
  cst_cofins: '',
  aliq_cofins: 0,
  cst_ipi: '',
  ex_tipi: '',
  aliq_ipi: 0,
  gera_nfe: true,
};

// ── Input / Label CSS helpers ─────────────────────────────────────────────────

const INPUT = 'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white focus:border-brand-primary outline-none';
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

// ── Integration status badge ──────────────────────────────────────────────────

function IntegrationBadge({ status }: { status: NfeIntegrationStatus }) {
  if (status === 'ativa') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        Ativa
      </span>
    );
  }
  if (status === 'homologacao') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        Homologação
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
      Não configurada
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FiscalSettingsPanel() {
  // ── Company config ─────────────────────────────────────────────────────────
  const [config, setConfig] = useState<CompanyFiscalConfig>(EMPTY_CONFIG);
  const [configId, setConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Section save states (each SettingsCard has its own)
  const [emitenteSaving, setEmitenteSaving] = useState(false);
  const [emitenteSaved, setEmitenteSaved] = useState(false);

  const [emissaoSaving, setEmissaoSaving] = useState(false);
  const [emissaoSaved, setEmissaoSaved] = useState(false);

  const [integSaving, setIntegSaving] = useState(false);
  const [integSaved, setIntegSaved] = useState(false);

  // API token UI state — never send the real token back after it's been saved
  const [showToken, setShowToken] = useState(false);
  const [tokenDirty, setTokenDirty] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  // ── Fiscal profiles ────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<FiscalProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<Partial<FiscalProfile> | null>(null);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);

  const profileSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);

    const [cfgRes, profRes] = await Promise.all([
      supabase.from('company_fiscal_config').select('*').limit(1).maybeSingle(),
      supabase.from('fiscal_profiles').select('*').order('name'),
    ]);

    if (cfgRes.data) {
      const row = cfgRes.data as CompanyFiscalConfig & { id: string };
      setConfigId(row.id);
      setConfig({
        razao_social: row.razao_social ?? '',
        nome_fantasia: row.nome_fantasia ?? '',
        cnpj: row.cnpj ?? '',
        ie: row.ie ?? '',
        im: row.im ?? '',
        logradouro: row.logradouro ?? '',
        numero: row.numero ?? '',
        complemento: row.complemento ?? '',
        bairro: row.bairro ?? '',
        cep: row.cep ?? '',
        municipio: row.municipio ?? '',
        uf: row.uf ?? '',
        regime_tributario: row.regime_tributario ?? 'simples_nacional',
        ambiente: row.ambiente ?? 'homologacao',
        serie_nfe: row.serie_nfe ?? 1,
        proximo_numero_nfe: row.proximo_numero_nfe ?? 1,
        cfop_venda_interna: row.cfop_venda_interna ?? '',
        cfop_venda_interestadual: row.cfop_venda_interestadual ?? '',
        cfop_devolucao: row.cfop_devolucao ?? '',
        aliq_pis_padrao: row.aliq_pis_padrao ?? 0,
        aliq_cofins_padrao: row.aliq_cofins_padrao ?? 0,
        nfe_provider: row.nfe_provider ?? '',
        // Never load token into form — show placeholder only
        nfe_api_token: '',
        nfe_webhook_url: row.nfe_webhook_url ?? '',
        nfe_integration_status: row.nfe_integration_status ?? 'none',
      });
    }

    setProfiles((profRes.data ?? []) as FiscalProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Persist helper ─────────────────────────────────────────────────────────

  async function persistConfig(partial: Partial<CompanyFiscalConfig>) {
    if (configId) {
      await supabase
        .from('company_fiscal_config')
        .update({ ...partial, updated_at: new Date().toISOString() })
        .eq('id', configId);
    } else {
      const { data } = await supabase
        .from('company_fiscal_config')
        .insert(partial)
        .select('id')
        .single();
      if (data) setConfigId((data as { id: string }).id);
    }
  }

  // ── Save: Emitente ─────────────────────────────────────────────────────────

  async function saveEmitente() {
    setEmitenteSaving(true);
    await persistConfig({
      razao_social: config.razao_social,
      nome_fantasia: config.nome_fantasia,
      cnpj: config.cnpj,
      ie: config.ie,
      im: config.im,
      logradouro: config.logradouro,
      numero: config.numero,
      complemento: config.complemento,
      bairro: config.bairro,
      cep: config.cep,
      municipio: config.municipio,
      uf: config.uf,
      regime_tributario: config.regime_tributario,
    });
    logAudit({ action: 'update', module: 'settings', description: 'Dados do emitente fiscal atualizados' });
    setEmitenteSaving(false);
    setEmitenteSaved(true);
    setTimeout(() => setEmitenteSaved(false), 900);
  }

  // ── Save: Emissão ──────────────────────────────────────────────────────────

  async function saveEmissao() {
    setEmissaoSaving(true);
    await persistConfig({
      ambiente: config.ambiente,
      serie_nfe: config.serie_nfe,
      proximo_numero_nfe: config.proximo_numero_nfe,
      cfop_venda_interna: config.cfop_venda_interna,
      cfop_venda_interestadual: config.cfop_venda_interestadual,
      cfop_devolucao: config.cfop_devolucao,
      aliq_pis_padrao: config.aliq_pis_padrao,
      aliq_cofins_padrao: config.aliq_cofins_padrao,
    });
    logAudit({ action: 'update', module: 'settings', description: 'Configurações de emissão NF-e atualizadas' });
    setEmissaoSaving(false);
    setEmissaoSaved(true);
    setTimeout(() => setEmissaoSaved(false), 900);
  }

  // ── Save: Integração ───────────────────────────────────────────────────────

  async function saveIntegracao() {
    setIntegSaving(true);
    const partial: Partial<CompanyFiscalConfig> = {
      nfe_provider: config.nfe_provider,
      nfe_webhook_url: config.nfe_webhook_url,
    };
    // Only send token if the user actually typed a new one
    if (tokenDirty && tokenInput.trim() !== '') {
      partial.nfe_api_token = tokenInput.trim();
    }
    await persistConfig(partial);
    logAudit({ action: 'update', module: 'settings', description: 'Integração com emissor externo NF-e atualizada' });
    setTokenDirty(false);
    setTokenInput('');
    setShowToken(false);
    setIntegSaving(false);
    setIntegSaved(true);
    setTimeout(() => setIntegSaved(false), 900);
  }

  // ── Fiscal Profiles CRUD ───────────────────────────────────────────────────

  function openNewProfile() {
    setEditingProfile({ ...EMPTY_PROFILE, id: undefined });
    setIsNewProfile(true);
  }

  function openEditProfile(profile: FiscalProfile) {
    setEditingProfile({ ...profile });
    setIsNewProfile(false);
  }

  function closeProfileDrawer() {
    setEditingProfile(null);
    setIsNewProfile(false);
    setDeleteProfileId(null);
  }

  async function saveProfile() {
    if (!editingProfile?.name?.trim()) return;
    setProfileSaving(true);

    if (isNewProfile) {
      const payload = { ...editingProfile } as Partial<FiscalProfile>;
      delete payload.id;
      const { data } = await supabase
        .from('fiscal_profiles')
        .insert(payload)
        .select()
        .single();
      if (data) setProfiles([...profiles, data as FiscalProfile]);
      logAudit({ action: 'create', module: 'settings', description: `Perfil fiscal "${editingProfile.name}" criado` });
    } else {
      const { id, ...rest } = editingProfile as FiscalProfile;
      await supabase.from('fiscal_profiles').update(rest).eq('id', id);
      setProfiles(profiles.map((p) => p.id === id ? { ...p, ...rest } : p));
      logAudit({ action: 'update', module: 'settings', description: `Perfil fiscal "${editingProfile.name}" atualizado` });
    }

    setProfileSaving(false);
    setProfileSaved(true);
    if (profileSavedTimer.current) clearTimeout(profileSavedTimer.current);
    profileSavedTimer.current = setTimeout(() => {
      setProfileSaved(false);
      closeProfileDrawer();
    }, 900);
  }

  async function deleteProfile(id: string) {
    const profile = profiles.find((p) => p.id === id);
    await supabase.from('fiscal_profiles').delete().eq('id', id);
    setProfiles(profiles.filter((p) => p.id !== id));
    logAudit({ action: 'delete', module: 'settings', description: `Perfil fiscal "${profile?.name}" excluído` });
    closeProfileDrawer();
  }

  // ── Field update helpers ───────────────────────────────────────────────────

  function setField<K extends keyof CompanyFiscalConfig>(key: K, value: CompanyFiscalConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function setProfileField<K extends keyof FiscalProfile>(key: K, value: FiscalProfile[K]) {
    setEditingProfile((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">

      {/* ── 1. Dados do Emitente ── */}
      <SettingsCard
        title="Dados do Emitente"
        description="Razão social, CNPJ, endereço e regime tributário da empresa emissora de NF-e"
        icon={Building2}
        collapseId="fiscal.emitente"
      >
        <div className="space-y-4">

          {/* Razão Social + Nome Fantasia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Razão Social</label>
              <input
                type="text"
                value={config.razao_social}
                onChange={(e) => setField('razao_social', e.target.value)}
                placeholder="Razão Social Ltda"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Nome Fantasia</label>
              <input
                type="text"
                value={config.nome_fantasia}
                onChange={(e) => setField('nome_fantasia', e.target.value)}
                placeholder="Nome Fantasia"
                className={INPUT}
              />
            </div>
          </div>

          {/* CNPJ + IE + IM */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>CNPJ</label>
              <input
                type="text"
                value={config.cnpj}
                onChange={(e) => setField('cnpj', e.target.value)}
                placeholder="00.000.000/0001-00"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={config.ie}
                onChange={(e) => setField('ie', e.target.value)}
                placeholder="000000000"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Inscrição Municipal (IM)</label>
              <input
                type="text"
                value={config.im}
                onChange={(e) => setField('im', e.target.value)}
                placeholder="000000"
                className={INPUT}
              />
            </div>
          </div>

          {/* Logradouro + Número + Complemento */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-4">
            <div>
              <label className={LABEL}>Logradouro</label>
              <input
                type="text"
                value={config.logradouro}
                onChange={(e) => setField('logradouro', e.target.value)}
                placeholder="Rua, Av., etc."
                className={INPUT}
              />
            </div>
            <div className="sm:w-24">
              <label className={LABEL}>Número</label>
              <input
                type="text"
                value={config.numero}
                onChange={(e) => setField('numero', e.target.value)}
                placeholder="100"
                className={INPUT}
              />
            </div>
            <div className="sm:w-36">
              <label className={LABEL}>Complemento</label>
              <input
                type="text"
                value={config.complemento}
                onChange={(e) => setField('complemento', e.target.value)}
                placeholder="Sala 1"
                className={INPUT}
              />
            </div>
          </div>

          {/* Bairro + CEP + UF + Município */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={LABEL}>Bairro</label>
              <input
                type="text"
                value={config.bairro}
                onChange={(e) => setField('bairro', e.target.value)}
                placeholder="Centro"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>CEP</label>
              <input
                type="text"
                value={config.cep}
                onChange={(e) => setField('cep', e.target.value)}
                placeholder="55000-000"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>UF</label>
              <input
                type="text"
                maxLength={2}
                value={config.uf}
                onChange={(e) => setField('uf', e.target.value.toUpperCase())}
                placeholder="PE"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Município</label>
              <input
                type="text"
                value={config.municipio}
                onChange={(e) => setField('municipio', e.target.value)}
                placeholder="Caruaru"
                className={INPUT}
              />
            </div>
          </div>

          {/* Regime Tributário */}
          <div className="sm:max-w-xs">
            <label className={LABEL}>Regime Tributário</label>
            <select
              value={config.regime_tributario}
              onChange={(e) => setField('regime_tributario', e.target.value as RegimeTributario)}
              className={INPUT}
            >
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={saveEmitente}
              disabled={emitenteSaving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                emitenteSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
              }`}
            >
              {emitenteSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
              ) : emitenteSaved ? (
                <><Check className="w-4 h-4" /> Salvo!</>
              ) : (
                <><Building2 className="w-4 h-4" /> Salvar emitente</>
              )}
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* ── 2. Configurações de Emissão ── */}
      <SettingsCard
        title="Configurações de Emissão"
        description="Ambiente, série, numeração, CFOPs padrão e alíquotas de PIS/COFINS"
        icon={FileText}
        collapseId="fiscal.emissao"
      >
        <div className="space-y-4">

          {/* Ambiente + Série + Próximo número */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Ambiente</label>
              <select
                value={config.ambiente}
                onChange={(e) => setField('ambiente', e.target.value as Ambiente)}
                className={INPUT}
              >
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Série NF-e</label>
              <input
                type="number"
                min={1}
                value={config.serie_nfe}
                onChange={(e) => setField('serie_nfe', Number(e.target.value))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Próximo Número NF-e</label>
              <input
                type="number"
                min={1}
                value={config.proximo_numero_nfe}
                onChange={(e) => setField('proximo_numero_nfe', Number(e.target.value))}
                className={INPUT}
              />
            </div>
          </div>

          {/* CFOPs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>CFOP Venda Interna</label>
              <input
                type="text"
                value={config.cfop_venda_interna}
                onChange={(e) => setField('cfop_venda_interna', e.target.value)}
                placeholder="5102"
                className={`${INPUT} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL}>CFOP Venda Interestadual</label>
              <input
                type="text"
                value={config.cfop_venda_interestadual}
                onChange={(e) => setField('cfop_venda_interestadual', e.target.value)}
                placeholder="6102"
                className={`${INPUT} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL}>CFOP Devolução</label>
              <input
                type="text"
                value={config.cfop_devolucao}
                onChange={(e) => setField('cfop_devolucao', e.target.value)}
                placeholder="1202"
                className={`${INPUT} font-mono`}
              />
            </div>
          </div>

          {/* PIS + COFINS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Alíquota PIS Padrão (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={config.aliq_pis_padrao}
                onChange={(e) => setField('aliq_pis_padrao', Number(e.target.value))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Alíquota COFINS Padrão (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={config.aliq_cofins_padrao}
                onChange={(e) => setField('aliq_cofins_padrao', Number(e.target.value))}
                className={INPUT}
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={saveEmissao}
              disabled={emissaoSaving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                emissaoSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
              }`}
            >
              {emissaoSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
              ) : emissaoSaved ? (
                <><Check className="w-4 h-4" /> Salvo!</>
              ) : (
                <><FileText className="w-4 h-4" /> Salvar emissão</>
              )}
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* ── 3. Integração com Emissor Externo ── */}
      <SettingsCard
        title="Integração com Emissor Externo"
        description="Configure o provedor de emissão NF-e e as credenciais de acesso à API"
        icon={Plug}
        collapseId="fiscal.integracao"
      >
        <div className="space-y-4">

          {/* Warning banner */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            <span className="mt-0.5 flex-shrink-0">⚠️</span>
            <p>
              <strong>Campos estruturais</strong> — nenhuma emissão real ocorre nesta fase. As credenciais são armazenadas para uso futuro quando o pipeline de emissão for ativado.
            </p>
          </div>

          {/* Provider */}
          <div className="sm:max-w-xs">
            <label className={LABEL}>Provedor NF-e</label>
            <select
              value={config.nfe_provider}
              onChange={(e) => setField('nfe_provider', e.target.value as NfeProvider)}
              className={INPUT}
            >
              <option value="">— Não configurado —</option>
              <option value="focus">Focus NF-e</option>
              <option value="enotas">eNotas</option>
              <option value="nuvem_fiscal">Nuvem Fiscal</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          {/* API Token */}
          <div>
            <label className={LABEL}>Token / API Key</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenDirty ? tokenInput : ''}
                onChange={(e) => {
                  setTokenDirty(true);
                  setTokenInput(e.target.value);
                }}
                placeholder={tokenDirty ? '' : '••••••••  (salvo — digite para substituir)'}
                className={`${INPUT} pr-10`}
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
            <p className="mt-1 text-[10px] text-gray-400">O token não é exibido após salvar por segurança.</p>
          </div>

          {/* Webhook URL */}
          <div>
            <label className={LABEL}>URL de Webhook (retorno do emissor)</label>
            <input
              type="text"
              value={config.nfe_webhook_url}
              onChange={(e) => setField('nfe_webhook_url', e.target.value)}
              placeholder="https://seu-emissor.com/webhook"
              className={INPUT}
            />
          </div>

          {/* Integration status (read-only) */}
          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status da integração</span>
            <IntegrationBadge status={config.nfe_integration_status} />
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={saveIntegracao}
              disabled={integSaving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                integSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
              }`}
            >
              {integSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
              ) : integSaved ? (
                <><Check className="w-4 h-4" /> Salvo!</>
              ) : (
                <><Plug className="w-4 h-4" /> Salvar integração</>
              )}
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* ── 4. Perfis Fiscais ── */}
      <SettingsCard
        title="Perfis Fiscais"
        description="Modelos reutilizáveis de tributação para produtos e serviços (NCM, CST, CSOSN, alíquotas)"
        icon={Layers}
        collapseId="fiscal.perfis"
        headerExtra={
          <button
            onClick={openNewProfile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors font-medium"
          >
            <Plus className="w-3 h-3" /> Novo Perfil
          </button>
        }
      >
        {profiles.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Nenhum perfil cadastrado. Crie perfis para agilizar a classificação fiscal de produtos.
          </p>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => openEditProfile(profile)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors text-left"
              >
                <Layers className="w-4 h-4 text-brand-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{profile.name}</p>
                  {profile.description && (
                    <p className="text-[11px] text-gray-400 truncate">{profile.description}</p>
                  )}
                </div>
                {profile.ncm && (
                  <span className="flex-shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    NCM {profile.ncm}
                  </span>
                )}
                {profile.gera_nfe && (
                  <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    NF-e
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </SettingsCard>

      {/* ── Drawer: Perfil Fiscal ── */}
      <Drawer
        open={!!editingProfile}
        onClose={closeProfileDrawer}
        title={isNewProfile ? 'Novo Perfil Fiscal' : 'Editar Perfil Fiscal'}
        icon={Layers}
        width="w-[480px]"
        footer={
          <div className="flex items-center gap-2">
            {!isNewProfile && editingProfile?.id && (
              <>
                {deleteProfileId === editingProfile.id ? (
                  <>
                    <button
                      onClick={() => deleteProfile(editingProfile.id!)}
                      disabled={profileSaving}
                      className="px-4 py-2.5 text-sm font-medium rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Confirmar
                    </button>
                    <button
                      onClick={() => setDeleteProfileId(null)}
                      className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Cancelar exclusão
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setDeleteProfileId(editingProfile.id!)}
                    disabled={profileSaving}
                    className="px-4 py-2.5 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )}
              </>
            )}
            <div className="flex-1" />
            <button
              onClick={closeProfileDrawer}
              disabled={profileSaving}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveProfile}
              disabled={profileSaving || !editingProfile?.name?.trim()}
              className={`px-5 py-2.5 flex items-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                profileSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
              }`}
            >
              {profileSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
              ) : profileSaved ? (
                <><Check className="w-4 h-4" /> Salvo!</>
              ) : (
                <><Layers className="w-4 h-4" /> {isNewProfile ? 'Criar perfil' : 'Salvar'}</>
              )}
            </button>
          </div>
        }
      >
        {editingProfile && (
          <>
            {/* Identificação */}
            <DrawerCard title="Identificação" icon={Layers}>
              <div>
                <label className={LABEL}>Nome *</label>
                <input
                  type="text"
                  value={editingProfile.name ?? ''}
                  onChange={(e) => setProfileField('name', e.target.value)}
                  placeholder="Ex: Produto Tributado Simples"
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Descrição</label>
                <input
                  type="text"
                  value={editingProfile.description ?? ''}
                  onChange={(e) => setProfileField('description', e.target.value)}
                  placeholder="Breve descrição do perfil"
                  className={INPUT}
                />
              </div>
            </DrawerCard>

            {/* Classificação */}
            <DrawerCard title="Classificação" icon={FileText}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>NCM</label>
                  <input
                    type="text"
                    value={editingProfile.ncm ?? ''}
                    onChange={(e) => setProfileField('ncm', e.target.value)}
                    placeholder="00000000"
                    className={`${INPUT} font-mono`}
                  />
                </div>
                <div>
                  <label className={LABEL}>CEST</label>
                  <input
                    type="text"
                    value={editingProfile.cest ?? ''}
                    onChange={(e) => setProfileField('cest', e.target.value)}
                    placeholder="0000000"
                    className={`${INPUT} font-mono`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>CFOP de Saída</label>
                  <input
                    type="text"
                    value={editingProfile.cfop_saida ?? ''}
                    onChange={(e) => setProfileField('cfop_saida', e.target.value)}
                    placeholder="5102"
                    className={`${INPUT} font-mono`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Unidade Tributável</label>
                  <input
                    type="text"
                    value={editingProfile.unidade_trib ?? ''}
                    onChange={(e) => setProfileField('unidade_trib', e.target.value)}
                    placeholder="UN, KG, CX…"
                    className={INPUT}
                  />
                </div>
              </div>
              <div className="sm:max-w-[200px]">
                <label className={LABEL}>Origem da Mercadoria</label>
                <select
                  value={editingProfile.origem ?? 0}
                  onChange={(e) => setProfileField('origem', Number(e.target.value))}
                  className={INPUT}
                >
                  <option value={0}>0 — Nacional</option>
                  <option value={1}>1 — Estrangeira (importação direta)</option>
                  <option value={2}>2 — Estrangeira (adquirida no mercado interno)</option>
                  <option value={3}>3 — Nacional, conteúdo de importação &gt; 40%</option>
                  <option value={4}>4 — Nacional, produção conforme processos básicos</option>
                  <option value={5}>5 — Nacional, conteúdo de importação ≤ 40%</option>
                  <option value={6}>6 — Estrangeira (importação direta, sem similar)</option>
                  <option value={7}>7 — Estrangeira (adquirida internamente, sem similar)</option>
                  <option value={8}>8 — Nacional, conteúdo de importação &gt; 70%</option>
                </select>
              </div>
            </DrawerCard>

            {/* ICMS */}
            <DrawerCard title="ICMS" icon={FileText}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>CST ICMS</label>
                  <input
                    type="text"
                    value={editingProfile.cst_icms ?? ''}
                    onChange={(e) => setProfileField('cst_icms', e.target.value)}
                    placeholder="00"
                    className={`${INPUT} font-mono`}
                  />
                </div>
                <div>
                  <label className={LABEL}>CSOSN</label>
                  <input
                    type="text"
                    value={editingProfile.csosn ?? ''}
                    onChange={(e) => setProfileField('csosn', e.target.value)}
                    placeholder="102"
                    className={`${INPUT} font-mono`}
                  />
                </div>
              </div>
              <div className="sm:max-w-[220px]">
                <label className={LABEL}>Modalidade Base de Cálculo</label>
                <select
                  value={editingProfile.mod_bc_icms ?? 0}
                  onChange={(e) => setProfileField('mod_bc_icms', Number(e.target.value))}
                  className={INPUT}
                >
                  <option value={0}>0 — Margem de Valor Agregado</option>
                  <option value={1}>1 — Pauta (Valor)</option>
                  <option value={2}>2 — Preço Tabelado</option>
                  <option value={3}>3 — Valor da Operação</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Alíq. ICMS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editingProfile.aliq_icms ?? 0}
                    onChange={(e) => setProfileField('aliq_icms', Number(e.target.value))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Red. BC (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editingProfile.red_bc_icms ?? 0}
                    onChange={(e) => setProfileField('red_bc_icms', Number(e.target.value))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>MVA (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editingProfile.mva ?? 0}
                    onChange={(e) => setProfileField('mva', Number(e.target.value))}
                    className={INPUT}
                  />
                </div>
              </div>
            </DrawerCard>

            {/* PIS/COFINS */}
            <DrawerCard title="PIS / COFINS" icon={FileText}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>CST PIS</label>
                  <input
                    type="text"
                    value={editingProfile.cst_pis ?? ''}
                    onChange={(e) => setProfileField('cst_pis', e.target.value)}
                    placeholder="07"
                    className={`${INPUT} font-mono`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Alíq. PIS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editingProfile.aliq_pis ?? 0}
                    onChange={(e) => setProfileField('aliq_pis', Number(e.target.value))}
                    className={INPUT}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>CST COFINS</label>
                  <input
                    type="text"
                    value={editingProfile.cst_cofins ?? ''}
                    onChange={(e) => setProfileField('cst_cofins', e.target.value)}
                    placeholder="07"
                    className={`${INPUT} font-mono`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Alíq. COFINS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editingProfile.aliq_cofins ?? 0}
                    onChange={(e) => setProfileField('aliq_cofins', Number(e.target.value))}
                    className={INPUT}
                  />
                </div>
              </div>
            </DrawerCard>

            {/* IPI */}
            <DrawerCard title="IPI" icon={FileText}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>CST IPI</label>
                  <input
                    type="text"
                    value={editingProfile.cst_ipi ?? ''}
                    onChange={(e) => setProfileField('cst_ipi', e.target.value)}
                    placeholder="99"
                    className={`${INPUT} font-mono`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Ex TIPI</label>
                  <input
                    type="text"
                    value={editingProfile.ex_tipi ?? ''}
                    onChange={(e) => setProfileField('ex_tipi', e.target.value)}
                    placeholder="000"
                    className={`${INPUT} font-mono`}
                  />
                </div>
              </div>
              <div className="sm:max-w-[160px]">
                <label className={LABEL}>Alíq. IPI (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editingProfile.aliq_ipi ?? 0}
                  onChange={(e) => setProfileField('aliq_ipi', Number(e.target.value))}
                  className={INPUT}
                />
              </div>
            </DrawerCard>

            {/* Emissão */}
            <DrawerCard title="Emissão" icon={Plug}>
              <Toggle
                checked={editingProfile.gera_nfe ?? true}
                onChange={(v) => setProfileField('gera_nfe', v)}
                label="Gera NF-e"
                description="Produtos com este perfil disparam emissão de nota fiscal eletrônica."
              />
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}
