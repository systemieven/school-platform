/**
 * FiscalProfilesPanel
 *
 * Sub-aba "Perfis Fiscais" da aba Fiscal em /admin/configuracoes.
 *
 * Extraído do antigo FiscalSettingsPanel (que misturava emitente + emissão +
 * integração + perfis num painel só) — agora vive sob a chave granular
 * `settings-fiscal-perfis` para permitir liberar CRUD de modelos tributários
 * sem expor as credenciais do provider de emissão.
 *
 * Persiste em `fiscal_profiles`. Self-contained — sem props.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { Toggle } from '../../components/Toggle';
import { SelectDropdown } from '../../components/FormField';
import {
  Layers, FileText, Plug, Loader2, Check, Trash2, Plus,
} from 'lucide-react';

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

const INPUT = 'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white focus:border-brand-primary outline-none';
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

export default function FiscalProfilesPanel() {
  const [profiles, setProfiles] = useState<FiscalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<Partial<FiscalProfile> | null>(null);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const profileSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('fiscal_profiles').select('*').order('name');
    setProfiles((data ?? []) as FiscalProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
      const { data } = await supabase.from('fiscal_profiles').insert(payload).select().single();
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

  function setProfileField<K extends keyof FiscalProfile>(key: K, value: FiscalProfile[K]) {
    setEditingProfile((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
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
                <SelectDropdown
                  label="Origem da Mercadoria"
                  value={editingProfile.origem ?? 0}
                  onChange={(e) => setProfileField('origem', Number(e.target.value))}
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
                </SelectDropdown>
              </div>
            </DrawerCard>

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
                <SelectDropdown
                  label="Modalidade Base de Cálculo"
                  value={editingProfile.mod_bc_icms ?? 0}
                  onChange={(e) => setProfileField('mod_bc_icms', Number(e.target.value))}
                >
                  <option value={0}>0 — Margem de Valor Agregado</option>
                  <option value={1}>1 — Pauta (Valor)</option>
                  <option value={2}>2 — Preço Tabelado</option>
                  <option value={3}>3 — Valor da Operação</option>
                </SelectDropdown>
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
