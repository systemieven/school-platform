import { useState, useEffect, useCallback } from 'react';
import {
  UserCheck, Search, ChevronLeft, ChevronRight, Loader2, Check,
  KeyRound, Filter, Mail, Receipt, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import type { GuardianProfile } from '../../types/admin.types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GuardianRow extends GuardianProfile {
  student_count?: number;
  students?: { id: string; full_name: string }[];
}

interface StudentGuardianLink {
  guardian_cpf: string;
  student_id: string;
  students?: { id: string; full_name: string };
}

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  cpf: '',
  email: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResponsaveisPage() {
  // List state
  const [rows, setRows] = useState<GuardianRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Create drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cpfSearching, setCpfSearching] = useState(false);
  const [linkedStudents, setLinkedStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [cpfNotFound, setCpfNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fiscal drawer
  const [fiscalTarget, setFiscalTarget] = useState<GuardianRow | null>(null);
  const [fiscalForm, setFiscalForm] = useState({
    cpf_cnpj: '', tipo_pessoa: 'fisica' as 'fisica' | 'juridica',
    logradouro_fiscal: '', numero_fiscal: '', complemento_fiscal: '',
    bairro_fiscal: '', cep_fiscal: '', municipio_fiscal: '', uf_fiscal: '', email_fiscal: '',
  });
  const [fiscalSaving, setFiscalSaving] = useState(false);
  const [fiscalSaved, setFiscalSaved] = useState(false);

  // Toggle active drawer
  const [toggleTarget, setToggleTarget] = useState<GuardianRow | null>(null);
  const [toggling, setToggling] = useState(false);

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // ── Fetch list ──
  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('guardian_profiles')
      .select('*', { count: 'exact' })
      .order('name')
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterActive === 'active')   q = q.eq('is_active', true);
    if (filterActive === 'inactive') q = q.eq('is_active', false);
    if (searchText.trim()) {
      q = q.or(`name.ilike.%${searchText.trim()}%,email.ilike.%${searchText.trim()}%,cpf.ilike.%${searchText.trim()}%`);
    }

    const { data, count } = await q;
    const guardians = (data as GuardianRow[]) ?? [];

    // Enrich with student count
    if (guardians.length > 0) {
      const cpfs = guardians.map(g => g.cpf).filter(Boolean) as string[];
      if (cpfs.length > 0) {
        const { data: links } = await supabase
          .from('student_guardians')
          .select('guardian_cpf, student_id, students(id,full_name)')
          .in('guardian_cpf', cpfs);

        const byCpf: Record<string, { id: string; full_name: string }[]> = {};
        ((links ?? []) as unknown as StudentGuardianLink[]).forEach(l => {
          if (!byCpf[l.guardian_cpf]) byCpf[l.guardian_cpf] = [];
          if (l.students) byCpf[l.guardian_cpf].push(l.students as any);
        });
        guardians.forEach(g => {
          if (g.cpf) {
            g.students = byCpf[g.cpf] ?? [];
            g.student_count = g.students.length;
          }
        });
      }
    }

    setRows(guardians);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, searchText, filterActive]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── CPF lookup ──
  async function lookupCpf() {
    if (!form.cpf.trim()) return;
    setCpfSearching(true);
    setCpfNotFound(false);
    setLinkedStudents([]);

    const cpfClean = form.cpf.replace(/\D/g, '');
    const { data } = await supabase
      .from('student_guardians')
      .select('guardian_cpf, student_id, students(id,full_name)')
      .eq('guardian_cpf', cpfClean);

    if (!data || data.length === 0) {
      setCpfNotFound(true);
    } else {
      const students = (data as unknown as StudentGuardianLink[])
        .filter(l => l.students)
        .map(l => l.students as { id: string; full_name: string });
      setLinkedStudents(students);
    }
    setCpfSearching(false);
  }

  // ── Create access ──
  async function handleCreateAccess() {
    if (!form.email.trim() || linkedStudents.length === 0) return;
    setSaving(true);

    // TODO: call edge function `create-guardian-user` when available.
    // The edge function should:
    //   1. supabase.auth.admin.createUser({ email, password: generated, email_confirm: true })
    //   2. Insert into guardian_profiles (name from student_guardians, cpf, email, is_active: true)
    //   3. Return the created user
    // For now we just insert the profile record assuming auth user exists or will be invited.
    const cpfClean = form.cpf.replace(/\D/g, '');
    await supabase.from('guardian_profiles').upsert({
      cpf: cpfClean,
      email: form.email.trim(),
      is_active: true,
      must_change_password: true,
    }, { onConflict: 'cpf' });

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setLinkedStudents([]);
      fetchRows();
    }, 900);
  }

  // ── Toggle active ──
  async function handleToggleActive(row: GuardianRow) {
    setToggling(true);
    await supabase.from('guardian_profiles').update({ is_active: !row.is_active }).eq('id', row.id);
    setToggling(false);
    setToggleTarget(null);
    fetchRows();
  }

  // ── Reset password ──
  async function handleResetPassword() {
    if (!resetEmail.trim()) return;
    setResetting(true);
    await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/portal/redefinir-senha`,
    });
    setResetting(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  }

  function openFiscalDrawer(row: GuardianRow) {
    setFiscalForm({
      cpf_cnpj:          (row as any).cpf_cnpj ?? '',
      tipo_pessoa:       (row as any).tipo_pessoa ?? 'fisica',
      logradouro_fiscal: (row as any).logradouro_fiscal ?? '',
      numero_fiscal:     (row as any).numero_fiscal ?? '',
      complemento_fiscal:(row as any).complemento_fiscal ?? '',
      bairro_fiscal:     (row as any).bairro_fiscal ?? '',
      cep_fiscal:        (row as any).cep_fiscal ?? '',
      municipio_fiscal:  (row as any).municipio_fiscal ?? '',
      uf_fiscal:         (row as any).uf_fiscal ?? '',
      email_fiscal:      (row as any).email_fiscal ?? '',
    });
    setFiscalTarget(row);
    setFiscalSaved(false);
  }

  async function handleFiscalSave() {
    if (!fiscalTarget) return;
    setFiscalSaving(true);
    await supabase.from('guardian_profiles').update(fiscalForm).eq('id', fiscalTarget.id);
    setFiscalSaving(false);
    setFiscalSaved(true);
    setTimeout(() => {
      setFiscalSaved(false);
      setFiscalTarget(null);
      fetchRows();
    }, 900);
  }

  function openCreateDrawer() {
    setForm(EMPTY_FORM);
    setLinkedStudents([]);
    setCpfNotFound(false);
    setDrawerOpen(true);
  }

  const canSave = linkedStudents.length > 0 && form.email.trim().length > 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Responsáveis</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gestão de acessos ao portal do responsável
          </p>
        </div>
        <button
          onClick={openCreateDrawer}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl transition-colors"
        >
          <UserCheck className="w-4 h-4" />
          Criar acesso
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(0); }}
              placeholder="Nome, e-mail ou CPF…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>
          <select
            value={filterActive}
            onChange={e => { setFilterActive(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <UserCheck className="w-10 h-10 text-gray-200 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum responsável cadastrado</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Crie o primeiro acesso clicando em "Criar acesso"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Nome', 'CPF', 'E-mail', 'Telefone', 'Filhos', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {row.cpf ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {row.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 text-center">
                      {row.student_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {row.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openFiscalDrawer(row)}
                          className="p-1.5 rounded-lg transition-colors"
                          title="Dados Fiscais"
                          style={{ color: (row as any).fiscal_data_complete ? '#10b981' : '#f59e0b' }}
                        >
                          {(row as any).fiscal_data_complete
                            ? <Receipt className="w-4 h-4" />
                            : <AlertCircle className="w-4 h-4" />}
                        </button>
                        {row.email && (
                          <button
                            onClick={() => { setResetEmail(row.email!); setResetDone(false); }}
                            className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Resetar senha"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setToggleTarget(row)}
                          disabled={toggling}
                          className="px-2 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          {row.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {total} responsável{total !== 1 ? 'is' : ''} · página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create access Drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Criar acesso de responsável"
        icon={UserCheck}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setDrawerOpen(false)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateAccess}
              disabled={saving || !canSave}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
              }`}
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved
                  ? <Check className="w-4 h-4" />
                  : <UserCheck className="w-4 h-4" />}
              {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Criar acesso'}
            </button>
          </div>
        }
      >
        {/* Card 1 — CPF */}
        <DrawerCard title="Buscar por CPF" icon={Search}>
          <div className="space-y-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">CPF do responsável *</label>
            <div className="flex gap-2">
              <input
                value={form.cpf}
                onChange={e => {
                  setForm(f => ({ ...f, cpf: e.target.value }));
                  setLinkedStudents([]);
                  setCpfNotFound(false);
                }}
                placeholder="000.000.000-00"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
              <button
                onClick={lookupCpf}
                disabled={cpfSearching || !form.cpf.trim()}
                className="px-3 py-2 bg-brand-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {cpfSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </button>
            </div>

            {cpfNotFound && (
              <p className="text-xs text-red-500">
                Nenhum aluno vinculado a este CPF encontrado em student_guardians.
              </p>
            )}

            {linkedStudents.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Alunos vinculados</p>
                {linkedStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">{s.full_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerCard>

        {/* Card 2 — E-mail */}
        <DrawerCard title="Acesso" icon={Mail}>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">E-mail de acesso *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="responsavel@email.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
            <p className="text-xs text-gray-400">
              O responsável receberá um convite por e-mail para definir sua senha.
            </p>
          </div>
        </DrawerCard>
      </Drawer>

      {/* ── Confirm toggle active ── */}
      {toggleTarget && (
        <>
          <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40" onClick={() => setToggleTarget(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                {toggleTarget.is_active ? 'Desativar acesso?' : 'Reativar acesso?'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {toggleTarget.is_active
                  ? `${toggleTarget.name} não conseguirá mais fazer login no portal do responsável.`
                  : `${toggleTarget.name} voltará a ter acesso ao portal do responsável.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setToggleTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleToggleActive(toggleTarget)}
                  disabled={toggling}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                    toggleTarget.is_active
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-brand-primary hover:bg-brand-primary-dark'
                  }`}
                >
                  {toggling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (toggleTarget.is_active ? 'Desativar' : 'Reativar')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Fiscal data Drawer ── */}
      <Drawer
        open={!!fiscalTarget}
        onClose={() => setFiscalTarget(null)}
        title="Dados Fiscais"
        icon={Receipt}
        badge={fiscalTarget && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            (fiscalTarget as any).fiscal_data_complete
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {(fiscalTarget as any).fiscal_data_complete ? 'Completo' : 'Incompleto'}
          </span>
        )}
        width="w-[460px]"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setFiscalTarget(null)} disabled={fiscalSaving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleFiscalSave} disabled={fiscalSaving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${fiscalSaved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {fiscalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : fiscalSaved ? <Check className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
              {fiscalSaving ? 'Salvando…' : fiscalSaved ? 'Salvo!' : 'Salvar Dados Fiscais'}
            </button>
          </div>
        }
      >
        {fiscalTarget && (
          <>
            <DrawerCard title="Identificação Fiscal" icon={Receipt}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">CPF / CNPJ *</label>
                  <input value={fiscalForm.cpf_cnpj} onChange={e => setFiscalForm(f => ({ ...f, cpf_cnpj: e.target.value }))}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tipo de Pessoa</label>
                  <select value={fiscalForm.tipo_pessoa} onChange={e => setFiscalForm(f => ({ ...f, tipo_pessoa: e.target.value as 'fisica' | 'juridica' }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none">
                    <option value="fisica">Pessoa Física</option>
                    <option value="juridica">Pessoa Jurídica</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">E-mail Fiscal</label>
                  <input type="email" value={fiscalForm.email_fiscal} onChange={e => setFiscalForm(f => ({ ...f, email_fiscal: e.target.value }))}
                    placeholder="fiscal@empresa.com.br"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
                </div>
              </div>
            </DrawerCard>

            <DrawerCard title="Endereço Fiscal" icon={Receipt}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Logradouro *</label>
                  <input value={fiscalForm.logradouro_fiscal} onChange={e => setFiscalForm(f => ({ ...f, logradouro_fiscal: e.target.value }))}
                    placeholder="Rua, Avenida…"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Número</label>
                  <input value={fiscalForm.numero_fiscal} onChange={e => setFiscalForm(f => ({ ...f, numero_fiscal: e.target.value }))}
                    placeholder="123"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Complemento</label>
                  <input value={fiscalForm.complemento_fiscal} onChange={e => setFiscalForm(f => ({ ...f, complemento_fiscal: e.target.value }))}
                    placeholder="Apto, Sala…"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Bairro</label>
                  <input value={fiscalForm.bairro_fiscal} onChange={e => setFiscalForm(f => ({ ...f, bairro_fiscal: e.target.value }))}
                    placeholder="Centro"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">CEP</label>
                  <input value={fiscalForm.cep_fiscal} onChange={e => setFiscalForm(f => ({ ...f, cep_fiscal: e.target.value }))}
                    placeholder="00000-000"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Município *</label>
                  <input value={fiscalForm.municipio_fiscal} onChange={e => setFiscalForm(f => ({ ...f, municipio_fiscal: e.target.value }))}
                    placeholder="São Paulo"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">UF *</label>
                  <input value={fiscalForm.uf_fiscal} onChange={e => setFiscalForm(f => ({ ...f, uf_fiscal: e.target.value.toUpperCase().slice(0, 2) }))}
                    placeholder="PE"
                    maxLength={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none uppercase" />
                </div>
              </div>
            </DrawerCard>
          </>
        )}
      </Drawer>

      {/* ── Reset password inline panel ── */}
      {resetEmail && (
        <>
          <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40" onClick={() => { setResetEmail(''); setResetDone(false); }} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-brand-primary" />
                </div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">Resetar senha</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Um link de redefinição de senha será enviado para:
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-white break-all">{resetEmail}</p>
              {resetDone && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">E-mail enviado com sucesso!</span>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setResetEmail(''); setResetDone(false); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Fechar
                </button>
                {!resetDone && (
                  <button
                    onClick={handleResetPassword}
                    disabled={resetting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {resetting ? 'Enviando…' : 'Enviar link'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
