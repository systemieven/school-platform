import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type { FinancialContract, FinancialPlan, FinancialContractStatus } from '../../types/admin.types';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Loader2, Search, ChevronDown, Play, Pause, X as XIcon,
  Save, Check, FileSignature, User, Calendar, Tag, Percent,
} from 'lucide-react';

export default function FinancialContractsPage() {
  const { profile } = useAdminAuth();
  const [contracts, setContracts] = useState<FinancialContract[]>([]);
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string; enrollment_number: string; class_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FinancialContractStatus | 'all'>('all');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New contract form
  const [newStudentId, setNewStudentId] = useState('');
  const [newPlanId, setNewPlanId] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'percentage' | 'fixed' | ''>('');
  const [newDiscountValue, setNewDiscountValue] = useState(0);
  const [newNotes, setNewNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, pRes, sRes] = await Promise.all([
      supabase.from('financial_contracts')
        .select('*, student:students(full_name, enrollment_number, class_id), plan:financial_plans(name, amount, installments)')
        .order('created_at', { ascending: false }),
      supabase.from('financial_plans').select('*').eq('is_active', true).order('name'),
      supabase.from('students').select('id, full_name, enrollment_number, class_id').eq('status', 'active').order('full_name'),
    ]);
    setContracts((cRes.data ?? []) as unknown as FinancialContract[]);
    setPlans((pRes.data ?? []) as FinancialPlan[]);
    setStudents((sRes.data ?? []) as typeof students);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contracts.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = c.student?.full_name?.toLowerCase() || '';
      const enroll = c.student?.enrollment_number?.toLowerCase() || '';
      if (!name.includes(q) && !enroll.includes(q)) return false;
    }
    return true;
  });

  function fmt(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  async function handleCreate() {
    if (!newStudentId || !newPlanId || !profile) return;
    setSaving(true);

    const payload = {
      student_id: newStudentId,
      plan_id: newPlanId,
      school_year: new Date().getFullYear(),
      status: 'draft' as const,
      discount_type: newDiscountType || null,
      discount_value: newDiscountValue,
      notes: newNotes || null,
      created_by: profile.id,
    };

    const { error } = await supabase.from('financial_contracts').insert(payload);
    if (!error) {
      logAudit({ action: 'create', module: 'financial-contracts', description: 'Contrato criado', newData: payload });
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => { setSaved(false); closeDrawer(); load(); }, 1200);
    }
    setSaving(false);
  }

  async function activateContract(id: string) {
    await supabase.from('financial_contracts').update({ status: 'active', activated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    await supabase.rpc('generate_installments_for_contract', { p_contract_id: id });
    logAudit({ action: 'update', module: 'financial-contracts', description: 'Contrato ativado + parcelas geradas', newData: { id } });
    load();
  }

  async function suspendContract(id: string) {
    await supabase.from('financial_contracts').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', id);
    logAudit({ action: 'update', module: 'financial-contracts', description: 'Contrato suspenso', newData: { id } });
    load();
  }

  async function cancelContract(id: string) {
    await supabase.from('financial_contracts').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('financial_installments').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('contract_id', id).in('status', ['pending', 'overdue']);
    logAudit({ action: 'update', module: 'financial-contracts', description: 'Contrato cancelado + parcelas pendentes canceladas', newData: { id } });
    load();
  }

  function closeDrawer() {
    setShowNew(false);
    setNewStudentId('');
    setNewPlanId('');
    setNewDiscountType('');
    setNewDiscountValue(0);
    setNewNotes('');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{contracts.length} contrato{contracts.length !== 1 && 's'}</p>
        <PermissionGate moduleKey="financial-contracts" action="create">
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors shadow-lg shadow-brand-primary/20">
            <FileSignature className="w-4 h-4" /> Novo Contrato
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por aluno..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FinancialContractStatus | 'all')}
            className="appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
            <option value="all">Todos os status</option>
            {(['draft', 'active', 'suspended', 'cancelled', 'concluded'] as FinancialContractStatus[]).map((s) => (
              <option key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Contracts list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileSignature className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhum contrato encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">{c.student?.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{c.student?.enrollment_number} · {c.plan?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${CONTRACT_STATUS_COLORS[c.status]}`}>
                    {CONTRACT_STATUS_LABELS[c.status]}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{c.net_amount ? fmt(c.net_amount) : c.plan ? fmt(c.plan.amount) : '—'}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3" /> {c.school_year}</p>
                  </div>
                </div>
              </div>

              {c.discount_value > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                  Desconto: {c.discount_type === 'percentage' ? `${c.discount_value}%` : fmt(c.discount_value)}
                </p>
              )}

              <PermissionGate moduleKey="financial-contracts" action="edit">
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  {c.status === 'draft' && (
                    <button onClick={() => activateContract(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors font-medium">
                      <Play className="w-3 h-3" /> Ativar + Gerar Parcelas
                    </button>
                  )}
                  {c.status === 'active' && (
                    <button onClick={() => suspendContract(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors font-medium">
                      <Pause className="w-3 h-3" /> Suspender
                    </button>
                  )}
                  {(c.status === 'draft' || c.status === 'active' || c.status === 'suspended') && (
                    <button onClick={() => cancelContract(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <XIcon className="w-3 h-3" /> Cancelar
                    </button>
                  )}
                </div>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}

      {/* Drawer: New Contract */}
      <Drawer
        open={showNew}
        onClose={closeDrawer}
        title="Novo Contrato"
        icon={FileSignature}
        width="w-[440px]"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={closeDrawer} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancelar</button>
            <button onClick={handleCreate} disabled={!newStudentId || !newPlanId || saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Criando...' : saved ? 'Criado!' : 'Criar Contrato'}
            </button>
          </div>
        }
      >
        <DrawerCard title="Aluno e Plano" icon={User}>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Aluno *</label>
            <select value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
              <option value="">Selecione o aluno</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.enrollment_number})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Plano *</label>
            <select value={newPlanId} onChange={(e) => setNewPlanId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
              <option value="">Selecione o plano</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.amount)}</option>)}
            </select>
          </div>
        </DrawerCard>

        <DrawerCard title="Desconto" icon={Percent}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tipo</label>
              <select value={newDiscountType} onChange={(e) => setNewDiscountType(e.target.value as 'percentage' | 'fixed' | '')}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
                <option value="">Sem desconto</option>
                <option value="percentage">Percentual (%)</option>
                <option value="fixed">Fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor</label>
              <input type="number" step="0.01" min="0" value={newDiscountValue || ''} onChange={(e) => setNewDiscountValue(Number(e.target.value))}
                disabled={!newDiscountType}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none disabled:opacity-50" />
            </div>
          </div>
        </DrawerCard>

        <DrawerCard title="Observações" icon={Tag}>
          <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} placeholder="Observações sobre o contrato..."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none resize-none" />
        </DrawerCard>
      </Drawer>
    </div>
  );
}
