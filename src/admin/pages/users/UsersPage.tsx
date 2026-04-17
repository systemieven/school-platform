import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type { Profile, Role } from '../../types/admin.types';
import { ROLE_LABELS, ROLES } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  Users, Search, Loader2, ShieldCheck, UserCheck,
  X, ChevronDown, Pencil, Copy, Check, MessageCircle, KeyRound, Trash2, AlertTriangle, UserPlus,
} from 'lucide-react';
import { SettingsCard } from '../../components/SettingsCard';
import { SelectDropdown } from '../../components/FormField';
import { Toggle } from '../../components/Toggle';
import { sendWhatsAppText, sendWhatsAppTemplate, checkWhatsAppNumber } from '../../lib/whatsapp-api';
import { loadTemplateBySlug, WHATSAPP_TEMPLATE_SLUGS } from '../../lib/whatsappTemplateIds';
import { useBranding } from '../../../contexts/BrandingContext';

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  admin:       'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  coordinator: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  teacher:     'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  student:     'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  user:        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

// ── Quick Permissions: module groups matching sidebar navigation ──────────────
type QuickActionPerms = {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_import: boolean;
};
const DEFAULT_ACTION_PERMS: QuickActionPerms = {
  can_view: false, can_create: false, can_edit: false,
  can_delete: false, can_import: false,
};
const FULL_ACCESS_PERMS: QuickActionPerms = {
  can_view: true, can_create: true, can_edit: true,
  can_delete: false, can_import: false,
};
const QUICK_ACTIONS: { key: keyof QuickActionPerms; label: string }[] = [
  { key: 'can_view',   label: 'Visualizar' },
  { key: 'can_create', label: 'Criar' },
  { key: 'can_edit',   label: 'Editar' },
  { key: 'can_delete', label: 'Excluir' },
  { key: 'can_import', label: 'Importar' },
];

const MODULE_GROUPS = [
  {
    label: 'Principal',
    modules: [{ key: 'dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Gestão',
    modules: [
      { key: 'appointments', label: 'Agendamentos' },
      { key: 'attendance', label: 'Atendimentos' },
      { key: 'contacts', label: 'Contatos' },
      { key: 'enrollments', label: 'Matrícula' },
    ],
  },
  {
    label: 'Financeiro',
    modules: [{ key: 'financial', label: 'Financeiro' }],
  },
  {
    label: 'Acadêmico',
    modules: [{ key: 'academico', label: 'Acadêmico' }],
  },
  {
    label: 'Secretaria',
    modules: [{ key: 'secretaria-declaracoes', label: 'Secretaria Digital' }],
  },
  {
    label: 'Instituição',
    modules: [
      { key: 'announcements', label: 'Comunicados' },
      { key: 'events', label: 'Eventos' },
      { key: 'segments', label: 'Segmentos e Turmas' },
      { key: 'teacher-area', label: 'Área do Professor' },
      { key: 'library', label: 'Biblioteca Virtual' },
    ],
  },
  {
    label: 'Ferramentas',
    modules: [
      { key: 'kanban', label: 'Kanban de Leads' },
      { key: 'reports', label: 'Relatórios' },
      { key: 'testimonials', label: 'Depoimentos' },
    ],
  },
  {
    label: 'Sistema',
    modules: [
      { key: 'settings', label: 'Configurações' },
      { key: 'users', label: 'Usuários' },
      { key: 'permissions', label: 'Permissões' },
      { key: 'audit', label: 'Auditoria' },
    ],
  },
];
const ALL_MODULE_KEYS = MODULE_GROUPS.flatMap(g => g.modules.map(m => m.key));

// ── Phone mask ────────────────────────────────────────────────────────────────
function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : '';
  if (d.length <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ── Temp Password Modal ───────────────────────────────────────────────────────
type WaStatus = 'sent' | 'no-wa' | 'no-phone' | 'error';

interface TempPasswordModalProps {
  profile: Profile;
  tempPassword: string;
  waStatus: WaStatus;
  sendError?: string;
  mode?: 'created' | 'reset';
  onClose: () => void;
}

function TempPasswordModal({ profile, tempPassword, waStatus, sendError, mode = 'created', onClose }: TempPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  function copyPassword() {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[61] p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-primary to-brand-primary-dark px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <KeyRound className="w-4 h-4" />
              <span className="font-semibold text-sm">{mode === 'reset' ? 'Senha Redefinida' : 'Usuário Criado'}</span>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/20 p-1 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">

            {/* ── Sent: clean success, no password shown ── */}
            {waStatus === 'sent' ? (
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                    {mode === 'reset' ? 'Senha redefinida com sucesso' : 'Usuário criado com sucesso'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    A senha temporária e as instruções de acesso foram enviadas para{' '}
                    <strong className="text-gray-700 dark:text-gray-300">{profile.phone}</strong> via WhatsApp.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {mode === 'reset'
                    ? <>A senha de <span className="font-semibold text-gray-800 dark:text-gray-200">{profile.full_name}</span> foi redefinida. Envie a senha temporária abaixo ao usuário — ela deve ser alterada no próximo acesso.</>
                    : <>O usuário <span className="font-semibold text-gray-800 dark:text-gray-200">{profile.full_name}</span> foi criado. Envie a senha temporária abaixo ao usuário — ela deve ser alterada no primeiro acesso.</>
                  }
                </p>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">Senha temporária</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-lg font-mono font-bold text-amber-800 dark:text-amber-200 tracking-widest">
                      {tempPassword}
                    </code>
                    <button onClick={copyPassword} className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-800/30 text-amber-600 dark:text-amber-400 transition-colors" title="Copiar senha">
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {waStatus === 'no-wa' && (
                  <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                    <MessageCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Número não possui WhatsApp. Envie a senha por outro canal (e-mail, SMS ou presencialmente).</span>
                  </div>
                )}
                {waStatus === 'error' && (
                  <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-500">
                    <MessageCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Falha ao enviar WhatsApp: {sendError}. Envie a senha manualmente.</span>
                  </div>
                )}
              </>
            )}

            <button onClick={onClose} className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors">
              Concluir
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────
interface SectorOption {
  key: string;
  label: string;
}

interface CreateModalProps {
  callerRole: Role;
  sectors: SectorOption[];
  onClose: () => void;
  onCreated: (p: Profile) => void;
}

function CreateUserDrawer({ callerRole, sectors, onClose, onCreated }: CreateModalProps) {
  const { profile: currentUser } = useAdminAuth();
  const { identity } = useBranding();
  const [form, setForm] = useState({ full_name: '', email: '', role: 'user' as Role, phone: '', sector_keys: [] as string[] });
  const [modulePerms, setModulePerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const [createdResult, setCreatedResult] = useState<{ profile: Profile; tempPassword: string; waStatus: WaStatus; sendError?: string } | null>(null);

  const allowedRoles = ROLES.filter((r) => {
    if (r === 'super_admin') return callerRole === 'super_admin';
    if (r === 'student') return false;
    return true;
  });

  function validateEmail(v: string) {
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setEmailError('E-mail inválido');
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name) {
      setError('Nome é obrigatório.');
      nameRef.current?.focus();
      return;
    }
    if (!form.email) {
      setError('E-mail é obrigatório.');
      emailRef.current?.focus();
      return;
    }
    if (!validateEmail(form.email)) { emailRef.current?.focus(); return; }
    setSaving(true);
    setError('');
    setEmailError('');
    setPhoneError('');

    // Check duplicate email
    const { data: emailDup } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', form.email.trim().toLowerCase())
      .maybeSingle();
    if (emailDup) {
      setSaving(false);
      setEmailError('Já existe um usuário com este e-mail.');
      emailRef.current?.focus();
      return;
    }

    // Check duplicate phone (only if provided)
    const rawPhone = form.phone.replace(/\D/g, '');
    if (rawPhone.length >= 10) {
      const { data: phoneDup } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', form.phone)
        .maybeSingle();
      if (phoneDup) {
        setSaving(false);
        setPhoneError('Já existe um usuário com este telefone.');
        phoneRef.current?.focus();
        return;
      }
    }
    const { data, error: fnError } = await supabase.functions.invoke('create-admin-user', { body: form });
    if (fnError || data?.error) {
      let msg = data?.error ?? 'Erro ao criar usuário.';
      if (fnError) {
        try {
          const body = await (fnError as unknown as { context?: { json?: () => Promise<Record<string, string>> } }).context?.json?.();
          if (body?.error) msg = body.error;
          else if (body?.message) msg = body.message;
          else msg = fnError.message;
        } catch { msg = fnError.message; }
      }
      setSaving(false);
      setError(msg);
      return;
    }

    const profile = data.profile as Profile;
    const tempPassword = data.temp_password as string;

    logAudit({ action: 'create', module: 'users', recordId: profile.id, description: `Usuário ${profile.full_name} criado com role ${form.role}`, newData: { full_name: profile.full_name, email: form.email, role: form.role } });

    // Save module permission overrides — apenas linhas ADITIVAS (>=1 flag true).
    // user_permission_overrides é OR com role_permissions (migration 143);
    // gravar `false` viraria no-op e poluiria a tabela.
    const permOverrides = Object.entries(modulePerms)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => ({
        user_id: profile.id,
        module_key: key,
        can_view: true, can_create: true, can_edit: true,
        can_delete: false,
        granted_by: currentUser?.id ?? profile.id,
      }));
    if (permOverrides.length > 0) {
      await supabase.from('user_permission_overrides').insert(permOverrides);
    }

    // WhatsApp check + send (all before showing modal)
    let waStatus: WaStatus = 'no-phone';
    let sendError: string | undefined;

    if (profile.phone) {
      const { exists, error: checkErr } = await checkWhatsAppNumber(profile.phone);
      if (checkErr || !exists) {
        waStatus = 'no-wa';
      } else {
        try {
          const systemUrl = window.location.origin + '/admin/login';
          // Lookup por UUID (resolvido a partir do slug canônico) — imune a
          // renomeações no admin UI. Ver src/admin/lib/whatsappTemplateIds.ts.
          const tpl = await loadTemplateBySlug<{
            id: string;
            message_type: string;
            content: Record<string, unknown>;
            variables: string[] | null;
          }>(WHATSAPP_TEMPLATE_SLUGS.SENHA_TEMPORARIA);

          const templateVars = {
            user_name:    profile.full_name ?? 'usuário',
            temp_password: tempPassword,
            system_url:   systemUrl,
            school_name:  identity.school_name || '',
          };

          let result;
          if (tpl) {
            result = await sendWhatsAppTemplate({
              phone: profile.phone,
              template: tpl as { id: string; message_type: string; content: Record<string, unknown> },
              variables: templateVars,
              recipientName: profile.full_name ?? undefined,
              relatedModule: 'usuario',
              relatedRecordId: profile.id,
            });
          } else {
            // Fallback: template not found — send plain text
            const text = `Olá, ${profile.full_name ?? 'usuário'}! 👋\n\nSeu acesso ao *Painel Administrativo* do ${identity.school_name || ''} foi criado.\n\n🔑 *Senha temporária:* ${tempPassword}\n\n*Como acessar:*\n1. Acesse: ${systemUrl}\n2. Entre com seu e-mail e a senha acima\n3. Você será solicitado(a) a criar uma nova senha no primeiro acesso\n\n_Esta senha é pessoal e intransferível. Não a compartilhe._`;
            result = await sendWhatsAppText({
              phone: profile.phone,
              text,
              recipientName: profile.full_name ?? undefined,
              relatedModule: 'usuario',
              relatedRecordId: profile.id,
              variablesUsed: templateVars,
            });
          }

          if (result.success) {
            waStatus = 'sent';
          } else {
            waStatus = 'error';
            sendError = result.error ?? 'Erro ao enviar mensagem.';
          }
        } catch {
          waStatus = 'error';
          sendError = 'Erro inesperado ao enviar mensagem.';
        }
      }
    }

    setSaving(false);
    setCreatedResult({ profile, tempPassword, waStatus, sendError });
  }

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (createdResult) {
    return (
      <TempPasswordModal
        profile={createdResult.profile}
        tempPassword={createdResult.tempPassword}
        waStatus={createdResult.waStatus}
        sendError={createdResult.sendError}
        onClose={() => { onCreated(createdResult.profile); onClose(); }}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white flex-shrink-0">
          <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              <h2 className="font-semibold text-sm">Novo Usuário</h2>
            </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form id="create-user-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <SettingsCard title="Identidade">
            <div>
              <label className={labelCls}>Nome completo</label>
              <input ref={nameRef} type="text" placeholder="Maria da Silva" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input
                ref={emailRef}
                type="email"
                placeholder="maria@escola.com"
                value={form.email}
                onChange={(e) => { set('email', e.target.value); if (emailError) validateEmail(e.target.value); }}
                onBlur={(e) => validateEmail(e.target.value)}
                className={`${inputCls} ${emailError ? 'border-red-400 dark:border-red-500 focus:border-red-400' : ''}`}
                required
              />
              {emailError && <p className="text-[11px] text-red-500 mt-1">{emailError}</p>}
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input
                ref={phoneRef}
                type="tel"
                placeholder="(81) 99999-9999"
                value={form.phone}
                onChange={(e) => { set('phone', maskPhone(e.target.value)); if (phoneError) setPhoneError(''); }}
                className={`${inputCls} ${phoneError ? 'border-red-400 dark:border-red-500 focus:border-red-400' : ''}`}
              />
              {phoneError && <p className="text-[11px] text-red-500 mt-1">{phoneError}</p>}
            </div>
          </SettingsCard>

          <SettingsCard title="Perfil de Acesso">
            <SelectDropdown label="Função" value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </SelectDropdown>
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <KeyRound className="w-3 h-3 flex-shrink-0" />
              Uma senha temporária será gerada automaticamente no momento da criação.
            </p>
          </SettingsCard>

          <SettingsCard title="Permissões de Acesso" collapseId="drawer.create.permissions">
            <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1 mb-3">
              Conceda ou revogue acesso rápido aos módulos do sistema. Para permissões granulares, use o painel de <span className="font-medium text-brand-primary dark:text-brand-secondary">Permissões</span> em Configurações.
            </p>
            {MODULE_GROUPS.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{group.label}</p>
                <div className="space-y-1">
                  {group.modules.map((mod) => (
                    <Toggle
                      key={mod.key}
                      checked={modulePerms[mod.key] ?? false}
                      onChange={(v) => {
                        setModulePerms(p => {
                          const next = { ...p, [mod.key]: v };
                          // Atendimentos ON → auto-ativar Agendamentos (dependência)
                          if (mod.key === 'attendance' && v) next['appointments'] = true;
                          // Atendimentos OFF → limpar setores
                          if (mod.key === 'attendance' && !v) setForm(f => ({ ...f, sector_keys: [] }));
                          return next;
                        });
                      }}
                      label={mod.label}
                    />
                  ))}
                </div>
              </div>
            ))}
          </SettingsCard>

          {sectors.length > 0 && modulePerms['attendance'] && (
            <SettingsCard title="Setores de Atendimento">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Selecione os setores que este usuário poderá atender. Se nenhum for selecionado, o usuário não verá tickets no modo restrito.
              </p>
              <div className="flex flex-wrap gap-2">
                {sectors.map((s) => {
                  const active = form.sector_keys.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          sector_keys: active
                            ? f.sector_keys.filter((k) => k !== s.key)
                            : [...f.sector_keys, s.key],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        active
                          ? 'bg-brand-primary border-brand-primary text-white shadow-sm'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-brand-primary/40 dark:hover:border-brand-secondary/40'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </SettingsCard>
          )}
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="create-user-form" disabled={saving} className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Aguarde…</> : 'Criar Usuário'}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Edit Drawer ───────────────────────────────────────────────────────────────
interface EditDrawerProps {
  user: Profile;
  callerRole: Role;
  currentUserId: string;
  sectors: SectorOption[];
  onClose: () => void;
  onUpdated: (p: Profile) => void;
  onDeleted: (id: string) => void;
}

function EditUserDrawer({ user, callerRole, currentUserId, sectors, onClose, onUpdated, onDeleted }: EditDrawerProps) {
  const { identity } = useBranding();
  const [form, setForm] = useState({ full_name: user.full_name || '', phone: user.phone || '', role: user.role, is_active: user.is_active, sector_keys: user.sector_keys ?? [] });
  const [modulePerms, setModulePerms] = useState<Record<string, QuickActionPerms>>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const phoneEditRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ profile: Profile; tempPassword: string; waStatus: WaStatus; sendError?: string } | null>(null);

  const canDelete = callerRole === 'super_admin' && user.id !== currentUserId;
  const canReset = callerRole === 'super_admin';

  const allowedRoles = ROLES.filter((r) => {
    if (r === 'super_admin') return callerRole === 'super_admin';
    return true;
  });

  // Load current module permission overrides
  useEffect(() => {
    supabase
      .from('user_permission_overrides')
      .select('module_key, can_view, can_create, can_edit, can_delete, can_import')
      .eq('user_id', user.id)
      .in('module_key', ALL_MODULE_KEYS)
      .then(({ data }) => {
        const roleHasAccess = ['super_admin', 'admin', 'coordinator'].includes(user.role);
        const perms: Record<string, QuickActionPerms> = {};
        ALL_MODULE_KEYS.forEach(key => {
          perms[key] = roleHasAccess ? { ...FULL_ACCESS_PERMS } : { ...DEFAULT_ACTION_PERMS };
        });
        if (data && data.length > 0) {
          data.forEach(d => {
            perms[d.module_key] = {
              can_view:   d.can_view   ?? false,
              can_create: d.can_create ?? false,
              can_edit:   d.can_edit   ?? false,
              can_delete: d.can_delete ?? false,
              can_import: d.can_import ?? false,
            };
          });
        }
        setModulePerms(perms);
      });
  }, [user.id, user.role]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setPhoneError('');

    // Check duplicate phone (only if changed and provided)
    const rawPhone = form.phone.replace(/\D/g, '');
    if (rawPhone.length >= 10 && form.phone !== (user.phone || '')) {
      const { data: phoneDup } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', form.phone)
        .neq('id', user.id)
        .maybeSingle();
      if (phoneDup) {
        setSaving(false);
        setPhoneError('Já existe um usuário com este telefone.');
        phoneEditRef.current?.focus();
        return;
      }
    }

    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name, phone: form.phone || null, role: form.role, is_active: form.is_active, sector_keys: form.sector_keys })
      .eq('id', user.id);
    if (err) { setSaving(false); setError(err.message); return; }

    const roleChanged = form.role !== user.role;
    if (roleChanged) {
      logAudit({ action: 'role_change', module: 'users', recordId: user.id, description: `Role do usuário ${user.full_name} alterado de ${user.role} para ${form.role}`, oldData: { role: user.role }, newData: { role: form.role } });
    } else {
      logAudit({ action: 'update', module: 'users', recordId: user.id, description: `Dados do usuário ${user.full_name} atualizados`, oldData: { full_name: user.full_name, role: user.role, is_active: user.is_active }, newData: { full_name: form.full_name, role: form.role, is_active: form.is_active } });
    }

    // Update all module permission overrides
    await supabase
      .from('user_permission_overrides')
      .delete()
      .eq('user_id', user.id)
      .in('module_key', ALL_MODULE_KEYS);

    // Apenas linhas ADITIVAS (>=1 flag true). user_permission_overrides
    // funciona como OR com role_permissions (migration 143); um override
    // com tudo false vira no-op e só polui a tabela.
    const permOverrides = Object.entries(modulePerms)
      .filter(([, perms]) =>
        perms.can_view || perms.can_create || perms.can_edit || perms.can_delete || perms.can_import,
      )
      .map(([key, perms]) => ({
        user_id: user.id,
        module_key: key,
        can_view:   perms.can_view,
        can_create: perms.can_create,
        can_edit:   perms.can_edit,
        can_delete: perms.can_delete,
        can_import: perms.can_import,
        granted_by: currentUserId,
      }));
    if (permOverrides.length > 0) {
      await supabase.from('user_permission_overrides').insert(permOverrides);
    }

    setSaving(false);
    onUpdated({ ...user, ...form });
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('delete-admin-user', {
      body: { user_id: user.id },
    });
    setDeleting(false);
    if (fnError || data?.error) {
      let msg = data?.error ?? 'Erro ao excluir usuário.';
      if (fnError) {
        try {
          const body = await (fnError as unknown as { context?: { json?: () => Promise<Record<string, string>> } }).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { msg = fnError.message; }
      }
      setError(msg);
      setConfirmDelete(false);
      return;
    }
    logAudit({ action: 'delete', module: 'users', recordId: user.id, description: `Usuário ${user.full_name} excluído`, oldData: { full_name: user.full_name, role: user.role, email: user.email } });
    onDeleted(user.id);
    onClose();
  }

  async function handleReset() {
    setResetting(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('reset-user-password', {
      body: { user_id: user.id },
    });
    if (fnError || data?.error) {
      let msg = data?.error ?? 'Erro ao redefinir senha.';
      if (fnError) {
        try {
          const body = await (fnError as unknown as { context?: { json?: () => Promise<Record<string, string>> } }).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { msg = fnError.message; }
      }
      setResetting(false);
      setConfirmReset(false);
      setError(msg);
      return;
    }

    const profile = data.profile as Profile;
    const tempPassword = data.temp_password as string;
    const phone = form.phone || profile.phone;

    let waStatus: WaStatus = 'no-phone';
    let sendError: string | undefined;

    if (phone) {
      const { exists, error: checkErr } = await checkWhatsAppNumber(phone);
      if (checkErr || !exists) {
        waStatus = 'no-wa';
      } else {
        try {
          const systemUrl = window.location.origin + '/admin/login';
          // Lookup por UUID (resolvido a partir do slug canônico) — imune a
          // renomeações no admin UI. Ver src/admin/lib/whatsappTemplateIds.ts.
          const tpl = await loadTemplateBySlug<{
            id: string;
            message_type: string;
            content: Record<string, unknown>;
            variables: string[] | null;
          }>(WHATSAPP_TEMPLATE_SLUGS.REDEFINICAO_SENHA);

          const templateVars = {
            user_name:    profile.full_name ?? 'usuário',
            temp_password: tempPassword,
            system_url:   systemUrl,
            school_name:  identity.school_name || '',
          };

          let result;
          if (tpl) {
            result = await sendWhatsAppTemplate({
              phone,
              template: tpl as { id: string; message_type: string; content: Record<string, unknown> },
              variables: templateVars,
              recipientName: profile.full_name ?? undefined,
              relatedModule: 'usuario',
              relatedRecordId: profile.id,
            });
          } else {
            const text = `Olá, ${profile.full_name ?? 'usuário'}! 👋\n\nSua senha de acesso ao *Painel Administrativo* do ${identity.school_name || ''} foi redefinida por um administrador.\n\n🔑 *Nova senha temporária:* ${tempPassword}\n\n*Como acessar:*\n1. Acesse: ${systemUrl}\n2. Entre com seu e-mail e a senha acima\n3. Você será solicitado(a) a criar uma nova senha no próximo acesso\n\n_Se você não solicitou esta alteração, entre em contato com o administrador imediatamente._\n\n_Esta senha é pessoal e intransferível. Não a compartilhe._`;
            result = await sendWhatsAppText({
              phone,
              text,
              recipientName: profile.full_name ?? undefined,
              relatedModule: 'usuario',
              relatedRecordId: profile.id,
              variablesUsed: templateVars,
            });
          }

          waStatus = result.success ? 'sent' : 'error';
          if (!result.success) sendError = result.error ?? 'Erro ao enviar mensagem.';
        } catch {
          waStatus = 'error';
          sendError = 'Erro inesperado ao enviar mensagem.';
        }
      }
    }

    setResetting(false);
    setConfirmReset(false);
    setResetResult({ profile, tempPassword, waStatus, sendError });
  }

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (resetResult) {
    return (
      <TempPasswordModal
        profile={resetResult.profile}
        tempPassword={resetResult.tempPassword}
        waStatus={resetResult.waStatus}
        sendError={resetResult.sendError}
        mode="reset"
        onClose={() => setResetResult(null)}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-primary/10 dark:bg-white/10 rounded-full flex items-center justify-center">
              <Pencil className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{user.full_name || '—'}</p>
              <p className="text-xs text-gray-400">{user.id.slice(0, 8)}…</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Toggle
              checked={form.is_active}
              onChange={(v) => set('is_active', v)}
              onColor="bg-emerald-500"
            />
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <SettingsCard title="Dados">
            <div>
              <label className={labelCls}>Nome completo</label>
              <input type="text" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="email" value={user.email} readOnly className={`${inputCls} bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 cursor-not-allowed`} />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input
                ref={phoneEditRef}
                type="tel"
                value={form.phone}
                onChange={(e) => { set('phone', maskPhone(e.target.value)); if (phoneError) setPhoneError(''); }}
                placeholder="(81) 99999-9999"
                className={`${inputCls} ${phoneError ? 'border-red-400 dark:border-red-500 focus:border-red-400' : ''}`}
              />
              {phoneError && <p className="text-[11px] text-red-500 mt-1">{phoneError}</p>}
            </div>
            <SelectDropdown label="Função" value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </SelectDropdown>
          </SettingsCard>

          <SettingsCard title="Permissões de Acesso" collapseId="drawer.edit.permissions">
            <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1 mb-3">
              Conceda ou revogue acesso rápido aos módulos. Para permissões granulares, use o painel de <span className="font-medium text-brand-primary dark:text-brand-secondary">Permissões</span> em Configurações.
            </p>
            {MODULE_GROUPS.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{group.label}</p>
                <div className="space-y-1.5">
                  {group.modules.map((mod) => {
                    const perms = modulePerms[mod.key] ?? DEFAULT_ACTION_PERMS;
                    const masterOn = perms.can_view;
                    const isExpanded = expandedModules.has(mod.key);
                    const activeCount = QUICK_ACTIONS.filter(a => perms[a.key]).length;
                    return (
                      <div key={mod.key} className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <Toggle
                            checked={masterOn}
                            onChange={(v) => {
                              setModulePerms(p => {
                                const next = { ...p };
                                next[mod.key] = v ? { ...FULL_ACCESS_PERMS } : { ...DEFAULT_ACTION_PERMS };
                                if (mod.key === 'attendance' && v) next['appointments'] = { ...FULL_ACCESS_PERMS };
                                if (mod.key === 'attendance' && !v) setForm(f => ({ ...f, sector_keys: [] }));
                                return next;
                              });
                            }}
                            onColor="bg-emerald-500"
                          />
                          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{mod.label}</span>
                          {masterOn && activeCount > 0 && (
                            <span className="text-[10px] text-gray-400 tabular-nums">{activeCount}/5</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedModules(prev => {
                              const next = new Set(prev);
                              next.has(mod.key) ? next.delete(mod.key) : next.add(mod.key);
                              return next;
                            })}
                            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/40 flex flex-wrap gap-x-5 gap-y-2">
                            {QUICK_ACTIONS.map((action) => (
                              <label key={action.key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={perms[action.key] ?? false}
                                  onChange={(e) => setModulePerms(p => ({
                                    ...p,
                                    [mod.key]: { ...(p[mod.key] ?? DEFAULT_ACTION_PERMS), [action.key]: e.target.checked },
                                  }))}
                                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-brand-primary focus:ring-brand-primary"
                                />
                                {action.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </SettingsCard>

          {sectors.length > 0 && modulePerms['attendance']?.can_view && (
            <SettingsCard title="Setores de Atendimento">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Selecione os setores que este usuário poderá atender.
              </p>
              <div className="flex flex-wrap gap-2">
                {sectors.map((s) => {
                  const active = form.sector_keys.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          sector_keys: active
                            ? f.sector_keys.filter((k) => k !== s.key)
                            : [...f.sector_keys, s.key],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        active
                          ? 'bg-brand-primary border-brand-primary text-white shadow-sm'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-brand-primary/40 dark:hover:border-brand-secondary/40'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </SettingsCard>
          )}

          {canReset && (
            <SettingsCard title="Segurança">
              {confirmReset ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Redefinir a senha de <strong>{user.full_name}</strong>? Uma nova senha temporária será gerada e o usuário precisará alterá-la no próximo acesso.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      disabled={resetting}
                      className="flex-1 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={resetting}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {resetting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Redefinindo…</> : <><KeyRound className="w-3.5 h-3.5" />Confirmar</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Redefinir senha</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Gera uma nova senha temporária para o usuário</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Redefinir
                  </button>
                </div>
              )}
            </SettingsCard>
          )}
        </div>

        {/* Footer */}
        {confirmDelete ? (
          <div className="p-5 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">
                Excluir <strong>{user.full_name}</strong>? Esta ação é irreversível e remove todos os dados do usuário.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />Excluindo…</> : <><Trash2 className="w-4 h-4" />Excluir</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3">
            {canDelete && (
              <button onClick={() => setConfirmDelete(true)} className="p-2.5 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Excluir usuário">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : 'Salvar'}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage({ embedded = false }: { embedded?: boolean }) {
  const { profile: currentUser } = useAdminAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [sectors, setSectors] = useState<SectorOption[]>([]);

  useEffect(() => { fetchProfiles(); }, []);

  // Fetch visit reasons (sectors) from system_settings
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'visit')
      .eq('key', 'reasons')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && Array.isArray(data.value)) {
          setSectors(
            (data.value as { key: string; label: string; active?: boolean }[])
              .filter((r) => r.active !== false)
              .map((r) => ({ key: r.key, label: r.label })),
          );
        }
      });
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!error && data) setProfiles(data as Profile[]);
    setLoading(false);
  }

  const filtered = profiles.filter((p) =>
    (p.full_name || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      {/* Header (hidden when embedded in SettingsPage) */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-brand-primary dark:text-white flex items-center gap-3">
              <Users className="w-8 h-8" />
              Usuários
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie os usuários do sistema.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-brand-primary-dark transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>
      )}

      {/* Embedded: compact header with just the add button */}
      {embedded && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-brand-primary-dark transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all text-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Usuário</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Função</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Criado em</th>
                  <th className="py-3 px-5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setEditUser(p)}
                    className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-brand-primary/10 dark:bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-brand-primary dark:text-brand-secondary">
                            {p.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                            {p.full_name || '—'}
                            {p.id === currentUser?.id && (
                              <span className="text-[9px] font-semibold uppercase tracking-wide bg-brand-primary/10 dark:bg-white/10 text-brand-primary dark:text-brand-secondary px-1.5 py-0.5 rounded-full">Você</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{p.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] || ROLE_COLORS.user}`}>
                        {['super_admin', 'admin'].includes(p.role)
                          ? <ShieldCheck className="w-3.5 h-3.5" />
                          : <UserCheck className="w-3.5 h-3.5" />}
                        {ROLE_LABELS[p.role]}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full" />Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-500 text-xs font-medium">
                          <span className="w-2 h-2 bg-red-400 rounded-full" />Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-5">
                      <Pencil className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            {filtered.length} usuário{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && currentUser && (
        <CreateUserDrawer
          callerRole={currentUser.role}
          sectors={sectors}
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setProfiles((prev) => [p, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      {editUser && currentUser && (
        <EditUserDrawer
          user={editUser}
          callerRole={currentUser.role}
          currentUserId={currentUser.id}
          sectors={sectors}
          onClose={() => setEditUser(null)}
          onUpdated={(updated) => {
            setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditUser(null);
          }}
          onDeleted={(id) => {
            setProfiles((prev) => prev.filter((p) => p.id !== id));
            setEditUser(null);
          }}
        />
      )}
    </div>
  );
}
