import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type { FinancialPlan } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  FilePlus, Loader2, Pencil, Trash2, X, Save, Check,
  FileText, DollarSign, Calendar, Percent, Tag, Info,
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY: Omit<FinancialPlan, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: null,
  amount: 0,
  installments: 12,
  due_day: 10,
  punctuality_discount_pct: 0,
  late_fee_pct: 2,
  interest_rate_pct: 0.033,
  segment_ids: [],
  school_year: CURRENT_YEAR,
  is_active: true,
};

export default function FinancialPlansPage() {
  const { profile } = useAdminAuth();
  const { can } = usePermissions();
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FinancialPlan | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [plansRes, segRes] = await Promise.all([
      supabase.from('financial_plans').select('*').order('school_year', { ascending: false }).order('name'),
      supabase.from('school_segments').select('id, name').order('position'),
    ]);
    setPlans((plansRes.data ?? []) as FinancialPlan[]);
    setSegments((segRes.data ?? []) as { id: string; name: string }[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing({ ...EMPTY, id: '', created_at: '', updated_at: '' } as FinancialPlan);
    setIsNew(true);
  }

  function openEdit(plan: FinancialPlan) {
    setEditing({ ...plan });
    setIsNew(false);
  }

  function close() {
    setEditing(null);
    setIsNew(false);
  }

  function updateField<K extends keyof FinancialPlan>(field: K, value: FinancialPlan[K]) {
    setEditing((prev) => prev ? { ...prev, [field]: value } : null);
  }

  async function handleSave() {
    if (!editing || !profile) return;
    setSaving(true);

    const payload = {
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      amount: Number(editing.amount),
      installments: Number(editing.installments),
      due_day: Number(editing.due_day),
      punctuality_discount_pct: Number(editing.punctuality_discount_pct),
      late_fee_pct: Number(editing.late_fee_pct),
      interest_rate_pct: Number(editing.interest_rate_pct),
      segment_ids: editing.segment_ids,
      school_year: Number(editing.school_year),
      is_active: editing.is_active,
    };

    if (isNew) {
      const { error } = await supabase.from('financial_plans').insert(payload);
      if (!error) logAudit({ action: 'create', module: 'financial-plans', description: `Plano criado: ${payload.name}`, newData: payload });
    } else {
      const { error } = await supabase.from('financial_plans').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (!error) logAudit({ action: 'update', module: 'financial-plans', description: `Plano atualizado: ${payload.name}`, newData: payload });
    }

    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { setSaved(false); close(); load(); }, 1200);
  }

  async function handleDelete(id: string) {
    const plan = plans.find((p) => p.id === id);
    await supabase.from('financial_plans').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'financial-plans', description: `Plano excluído: ${plan?.name}` });
    setDeleteId(null);
    load();
  }

  function fmt(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {plans.length} plano{plans.length !== 1 && 's'} cadastrado{plans.length !== 1 && 's'}
        </p>
        <PermissionGate moduleKey="financial-plans" action="create">
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors shadow-lg shadow-brand-primary/20">
            <FilePlus className="w-4 h-4" /> Novo Plano
          </button>
        </PermissionGate>
      </div>

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhum plano cadastrado</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Crie o primeiro plano de mensalidade</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white">{plan.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{plan.school_year}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                  {plan.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Valor</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{fmt(plan.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Parcelas</span>
                  <span className="text-gray-700 dark:text-gray-300">{plan.installments}x de {fmt(plan.amount / plan.installments)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Desc. pontualidade</span>
                  <span className="text-gray-700 dark:text-gray-300">{plan.punctuality_discount_pct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Vencimento</span>
                  <span className="text-gray-700 dark:text-gray-300">Dia {plan.due_day}</span>
                </div>
              </div>

              {plan.segment_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {plan.segment_ids.map((sid) => {
                    const seg = segments.find((s) => s.id === sid);
                    return seg ? (
                      <span key={sid} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">{seg.name}</span>
                    ) : null;
                  })}
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <PermissionGate moduleKey="financial-plans" action="edit">
                  <button onClick={() => openEdit(plan)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                </PermissionGate>
                <PermissionGate moduleKey="financial-plans" action="delete">
                  {deleteId === plan.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(plan.id)} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Confirmar</button>
                      <button onClick={() => setDeleteId(null)} className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteId(plan.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                  )}
                </PermissionGate>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer: Create/Edit Plan */}
      <Drawer
        open={!!editing}
        onClose={close}
        title={isNew ? 'Novo Plano' : 'Editar Plano'}
        icon={FileText}
        width="w-[440px]"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={!editing?.name.trim() || (editing?.amount ?? 0) <= 0 || saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        }
      >
        {editing && (
          <>
            <DrawerCard title="Identificação" icon={Tag}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome do plano *</label>
                <input value={editing.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Ex: Mensalidade 2026 - Fundamental I"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição</label>
                <textarea value={editing.description || ''} onChange={(e) => updateField('description', e.target.value || null)} rows={2} placeholder="Observações sobre o plano..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm resize-none" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${editing.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  onClick={() => updateField('is_active', !editing.is_active)}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editing.is_active ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">{editing.is_active ? 'Plano ativo' : 'Plano inativo'}</span>
              </label>
            </DrawerCard>

            <DrawerCard title="Valores e Parcelas" icon={DollarSign}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor total (R$) *</label>
                  <input type="number" step="0.01" min="0" value={editing.amount || ''} onChange={(e) => updateField('amount', Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Parcelas *</label>
                  <input type="number" min="1" max="24" value={editing.installments} onChange={(e) => updateField('installments', Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Dia vencimento *</label>
                  <input type="number" min="1" max="28" value={editing.due_day} onChange={(e) => updateField('due_day', Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Ano letivo *</label>
                  <input type="number" min="2024" max="2030" value={editing.school_year} onChange={(e) => updateField('school_year', Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
              </div>

              {/* Preview */}
              {editing.amount > 0 && editing.installments > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Prévia</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    {editing.installments}x de {fmt(editing.amount / editing.installments)}
                    {editing.punctuality_discount_pct > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400"> — com desc: {fmt((editing.amount / editing.installments) * (1 - editing.punctuality_discount_pct / 100))}</span>
                    )}
                  </p>
                </div>
              )}
            </DrawerCard>

            <DrawerCard title="Multa e Juros" icon={Percent}>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Desc. pont. %</label>
                  <input type="number" step="0.1" min="0" max="100" value={editing.punctuality_discount_pct} onChange={(e) => updateField('punctuality_discount_pct', Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Multa %</label>
                  <input type="number" step="0.1" min="0" value={editing.late_fee_pct} onChange={(e) => updateField('late_fee_pct', Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Juros %/dia</label>
                  <input type="number" step="0.001" min="0" value={editing.interest_rate_pct} onChange={(e) => updateField('interest_rate_pct', Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
              </div>
            </DrawerCard>

            {segments.length > 0 && (
              <DrawerCard title="Segmentos" icon={Info}>
                <div className="flex flex-wrap gap-2">
                  {segments.map((seg) => {
                    const selected = editing.segment_ids.includes(seg.id);
                    return (
                      <button key={seg.id} type="button"
                        onClick={() => updateField('segment_ids', selected ? editing.segment_ids.filter((s) => s !== seg.id) : [...editing.segment_ids, seg.id])}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${selected ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-semibold' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
                      >
                        {seg.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Deixe vazio para aplicar a todos os segmentos</p>
              </DrawerCard>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
