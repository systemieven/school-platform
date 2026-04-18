import { useEffect, useState } from 'react';
import {
  User, Briefcase, MapPin, ShieldCheck, Check, Loader2, Trash2,
  KeyRound, Copy,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { Toggle } from '../../../components/Toggle';
import { SelectDropdown } from '../../../components/FormField';
import { useCepLookup } from '../../../hooks/useCepLookup';
import { logAudit } from '../../../../lib/audit';
import {
  createStaff, updateStaff, deleteStaff, grantStaffAccess, revokeStaffAccess,
  type Staff, type StaffInput, type EmploymentType,
} from '../../../hooks/useStaff';
import { usePermissions } from '../../../contexts/PermissionsContext';

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';
const labelCls =
  'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  terceirizado: 'Terceirizado',
};

const GRANT_ROLES: { key: 'coordinator' | 'teacher' | 'user'; label: string }[] = [
  { key: 'user',        label: 'Usuário' },
  { key: 'teacher',     label: 'Professor' },
  { key: 'coordinator', label: 'Coordenador' },
];

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const BLANK: Partial<StaffInput> = {
  full_name: '',
  email: null,
  phone: null,
  cpf: null,
  rg: null,
  birth_date: null,
  address_street: null,
  address_number: null,
  address_complement: null,
  address_neighborhood: null,
  address_city: null,
  address_state: null,
  address_zip: null,
  position: '',
  department: null,
  hire_date: new Date().toISOString().slice(0, 10),
  termination_date: null,
  employment_type: 'clt',
  emergency_contact_name: null,
  emergency_contact_phone: null,
  avatar_url: null,
  is_active: true,
  notes: null,
};

interface Props {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
  onSaved: () => void;
}

type TabKey = 'pessoal' | 'profissional' | 'endereco' | 'acesso';

export default function ColaboradorDrawer({ open, onClose, staff, onSaved }: Props) {
  const { can } = usePermissions();
  const canEditAccess = can('users', 'create') && can('rh-colaboradores', 'edit');

  const [tab, setTab] = useState<TabKey>('pessoal');
  const [form, setForm] = useState<Partial<StaffInput>>(BLANK);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const { lookup: lookupCep, loading: cepLoading } = useCepLookup();

  // Grant/revoke state
  const [grantRole, setGrantRole] = useState<'coordinator' | 'teacher' | 'user'>('user');
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantResult, setGrantResult] = useState<{ temp_password: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('pessoal');
    setError('');
    setSaved(false);
    setGrantResult(null);
    if (staff) {
      const { id: _id, profile_id: _pid, created_by: _cb, created_at: _ca, updated_at: _ua, ...rest } = staff;
      setForm(rest);
    } else {
      setForm(BLANK);
    }
  }, [open, staff]);

  function set<K extends keyof StaffInput>(k: K, v: StaffInput[K] | null) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleCepBlur(raw: string) {
    const addr = await lookupCep(raw);
    if (!addr) return;
    setForm((f) => ({
      ...f,
      address_street: addr.logradouro || f.address_street || null,
      address_neighborhood: addr.bairro || f.address_neighborhood || null,
      address_city: addr.municipio || f.address_city || null,
      address_state: addr.uf || f.address_state || null,
      address_zip: addr.cep || f.address_zip || null,
    }));
  }

  async function handleSave() {
    if (!form.full_name?.trim()) {
      setError('Nome é obrigatório.');
      setTab('pessoal');
      return;
    }
    if (!form.position?.trim()) {
      setError('Cargo é obrigatório.');
      setTab('profissional');
      return;
    }
    if (!form.hire_date) {
      setError('Data de admissão é obrigatória.');
      setTab('profissional');
      return;
    }
    if (!form.employment_type) {
      setError('Vínculo é obrigatório.');
      setTab('profissional');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Partial<StaffInput> = {
        ...form,
        full_name: form.full_name?.trim(),
        position: form.position?.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        cpf: form.cpf?.replace(/\D/g, '') || null,
      };
      if (staff) {
        const updated = await updateStaff(staff.id, payload as StaffInput);
        logAudit({
          action: 'update',
          module: 'rh-colaboradores',
          recordId: updated.id,
          description: `Colaborador atualizado: ${updated.full_name}`,
        });
      } else {
        const created = await createStaff(payload);
        logAudit({
          action: 'create',
          module: 'rh-colaboradores',
          recordId: created.id,
          description: `Colaborador criado: ${created.full_name}`,
        });
      }
      setSaving(false);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onSaved();
        onClose();
      }, 900);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Erro ao salvar colaborador.');
    }
  }

  async function handleDelete() {
    if (!staff) return;
    if (!confirm(`Excluir colaborador "${staff.full_name}"? Esta ação não pode ser desfeita.`)) return;
    setSaving(true);
    try {
      await deleteStaff(staff.id);
      logAudit({
        action: 'delete',
        module: 'rh-colaboradores',
        recordId: staff.id,
        description: `Colaborador excluído: ${staff.full_name}`,
      });
      onSaved();
      onClose();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  }

  async function handleGrant() {
    if (!staff) return;
    setGrantBusy(true);
    setError('');
    try {
      const res = await grantStaffAccess(staff.id, grantRole);
      logAudit({
        action: 'create',
        module: 'users',
        recordId: res.profile_id,
        description: `Acesso criado para colaborador ${staff.full_name} (role=${res.role})`,
      });
      setGrantResult({ temp_password: res.temp_password, email: res.email });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar acesso.');
    } finally {
      setGrantBusy(false);
    }
  }

  async function handleRevoke() {
    if (!staff?.profile_id) return;
    if (!confirm(`Remover acesso ao sistema de "${staff.full_name}"? O colaborador continuará cadastrado no RH, mas não poderá mais entrar no sistema.`)) return;
    setGrantBusy(true);
    setError('');
    try {
      const res = await revokeStaffAccess(staff.id);
      logAudit({
        action: 'update',
        module: 'users',
        recordId: res.revoked_profile_id,
        description: `Acesso revogado do colaborador ${staff.full_name}`,
      });
      onSaved();
      // Precisamos recarregar o objeto staff — fecha drawer por simplicidade.
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao remover acesso.');
    } finally {
      setGrantBusy(false);
    }
  }

  function copyPassword() {
    if (!grantResult) return;
    navigator.clipboard.writeText(grantResult.temp_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasAccess = !!staff?.profile_id;
  const isNew = !staff;

  const tabs: { key: TabKey; label: string; icon: typeof User }[] = [
    { key: 'pessoal',      label: 'Pessoal',      icon: User },
    { key: 'profissional', label: 'Profissional', icon: Briefcase },
    { key: 'endereco',     label: 'Endereço',     icon: MapPin },
    ...(!isNew ? [{ key: 'acesso' as const, label: 'Acesso', icon: ShieldCheck }] : []),
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isNew ? 'Novo colaborador' : staff!.full_name}
      icon={Briefcase}
      width="w-[520px]"
      badge={hasAccess ? (
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-100 text-[10px] font-semibold uppercase tracking-wide">
          Tem acesso
        </span>
      ) : null}
      headerExtra={(
        <div className="flex items-center gap-3 pr-1">
          <Toggle
            checked={form.is_active ?? true}
            onChange={(v) => set('is_active', v)}
            onColor="bg-emerald-500"
          />
        </div>
      )}
      footer={(
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
            {saving ? 'Salvando…' : saved ? 'Salvo!' : isNew ? 'Criar colaborador' : 'Salvar alterações'}
          </button>
        </div>
      )}
    >
      {/* Tab rail */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700 mb-3">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-brand-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Dados pessoais ────────────────────────────────────────── */}
      {tab === 'pessoal' && (
        <DrawerCard title="Dados pessoais" icon={User}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nome completo *</label>
              <input
                type="text"
                value={form.full_name ?? ''}
                onChange={(e) => set('full_name', e.target.value)}
                className={inputCls}
                placeholder="Maria da Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>CPF</label>
                <input
                  type="text"
                  value={form.cpf ? maskCpf(form.cpf) : ''}
                  onChange={(e) => set('cpf', e.target.value.replace(/\D/g, ''))}
                  className={inputCls}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className={labelCls}>RG</label>
                <input
                  type="text"
                  value={form.rg ?? ''}
                  onChange={(e) => set('rg', e.target.value || null)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Data de nascimento</label>
              <input
                type="date"
                value={form.birth_date ?? ''}
                onChange={(e) => set('birth_date', e.target.value || null)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value || null)}
                className={inputCls}
                placeholder="maria@escola.com"
              />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => set('phone', maskPhone(e.target.value))}
                className={inputCls}
                placeholder="(81) 99999-9999"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Contato de emergência</label>
                <input
                  type="text"
                  value={form.emergency_contact_name ?? ''}
                  onChange={(e) => set('emergency_contact_name', e.target.value || null)}
                  className={inputCls}
                  placeholder="Nome"
                />
              </div>
              <div>
                <label className={labelCls}>Telefone emergência</label>
                <input
                  type="tel"
                  value={form.emergency_contact_phone ?? ''}
                  onChange={(e) => set('emergency_contact_phone', maskPhone(e.target.value))}
                  className={inputCls}
                  placeholder="(81) 99999-9999"
                />
              </div>
            </div>
          </div>
        </DrawerCard>
      )}

      {/* ── Dados profissionais ───────────────────────────────────── */}
      {tab === 'profissional' && (
        <DrawerCard title="Dados profissionais" icon={Briefcase}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Cargo *</label>
              <input
                type="text"
                value={form.position ?? ''}
                onChange={(e) => set('position', e.target.value)}
                className={inputCls}
                placeholder="Professor, Auxiliar, Zelador…"
              />
            </div>
            <div>
              <label className={labelCls}>Departamento</label>
              <input
                type="text"
                value={form.department ?? ''}
                onChange={(e) => set('department', e.target.value || null)}
                className={inputCls}
                placeholder="Pedagógico, Administrativo, Serviços gerais…"
              />
            </div>
            <SelectDropdown
              label="Vínculo *"
              value={form.employment_type ?? 'clt'}
              onChange={(e) => set('employment_type', e.target.value as EmploymentType)}
            >
              {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((k) => (
                <option key={k} value={k}>{EMPLOYMENT_LABELS[k]}</option>
              ))}
            </SelectDropdown>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Admissão *</label>
                <input
                  type="date"
                  value={form.hire_date ?? ''}
                  onChange={(e) => set('hire_date', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Desligamento</label>
                <input
                  type="date"
                  value={form.termination_date ?? ''}
                  onChange={(e) => set('termination_date', e.target.value || null)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Observações</label>
              <textarea
                value={form.notes ?? ''}
                onChange={(e) => set('notes', e.target.value || null)}
                className={`${inputCls} min-h-[80px] resize-y`}
                placeholder="Anotações internas…"
              />
            </div>
          </div>
        </DrawerCard>
      )}

      {/* ── Endereço ──────────────────────────────────────────────── */}
      {tab === 'endereco' && (
        <DrawerCard title="Endereço" icon={MapPin}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>CEP</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.address_zip ? maskCep(form.address_zip) : ''}
                  onChange={(e) => set('address_zip', e.target.value.replace(/\D/g, ''))}
                  onBlur={(e) => handleCepBlur(e.target.value)}
                  className={inputCls}
                  placeholder="00000-000"
                />
                {cepLoading && (
                  <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>Logradouro</label>
              <input
                type="text"
                value={form.address_street ?? ''}
                onChange={(e) => set('address_street', e.target.value || null)}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Número</label>
                <input
                  type="text"
                  value={form.address_number ?? ''}
                  onChange={(e) => set('address_number', e.target.value || null)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Complemento</label>
                <input
                  type="text"
                  value={form.address_complement ?? ''}
                  onChange={(e) => set('address_complement', e.target.value || null)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Bairro</label>
              <input
                type="text"
                value={form.address_neighborhood ?? ''}
                onChange={(e) => set('address_neighborhood', e.target.value || null)}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-[1fr,80px] gap-3">
              <div>
                <label className={labelCls}>Cidade</label>
                <input
                  type="text"
                  value={form.address_city ?? ''}
                  onChange={(e) => set('address_city', e.target.value || null)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>UF</label>
                <input
                  type="text"
                  maxLength={2}
                  value={form.address_state ?? ''}
                  onChange={(e) => set('address_state', e.target.value.toUpperCase() || null)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </DrawerCard>
      )}

      {/* ── Acesso ao sistema ────────────────────────────────────── */}
      {tab === 'acesso' && staff && (
        <DrawerCard title="Acesso ao sistema" icon={ShieldCheck}>
          {!canEditAccess ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Você não tem permissão para gerenciar acessos. Requer <strong>users.can_create</strong> + <strong>rh-colaboradores.can_edit</strong>.
            </p>
          ) : hasAccess ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  Colaborador possui acesso ao sistema
                </div>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                  Perfil vinculado: <code className="font-mono">{staff.profile_id}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={grantBusy}
                className="w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {grantBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remover acesso
              </button>
            </div>
          ) : grantResult ? (
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                  Acesso criado para {grantResult.email}
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mb-2">
                  Envie a senha temporária abaixo ao colaborador — ela deve ser alterada no primeiro acesso.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-lg font-mono font-bold text-amber-800 dark:text-amber-200 tracking-widest">
                    {grantResult.temp_password}
                  </code>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-800/30 text-amber-600 dark:text-amber-400 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGrantResult(null)}
                className="w-full px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Concluir
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Criar um login para este colaborador. Um usuário em <code className="font-mono">auth.users</code> será criado com senha temporária e obrigatoriedade de troca no primeiro acesso.
              </p>
              {!staff.email && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs rounded-lg px-3 py-2">
                  Preencha o e-mail do colaborador (aba Pessoal) antes de criar acesso.
                </div>
              )}
              <SelectDropdown
                label="Função do novo usuário"
                value={grantRole}
                onChange={(e) => setGrantRole(e.target.value as 'coordinator' | 'teacher' | 'user')}
              >
                {GRANT_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </SelectDropdown>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <KeyRound className="w-3 h-3 flex-shrink-0" />
                Admin/super_admin não são criados por esta rota — use a página Usuários.
              </p>
              <button
                type="button"
                onClick={handleGrant}
                disabled={grantBusy || !staff.email}
                className="w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {grantBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Criar acesso
              </button>
            </div>
          )}
        </DrawerCard>
      )}
    </Drawer>
  );
}
