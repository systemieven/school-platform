import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type {
  FinancialDiscount,
  FinancialPlan,
  DiscountScope,
  DiscountType,
  ProgressiveDiscountRule,
} from '../../types/admin.types';
import { DISCOUNT_SCOPE_LABELS, DISCOUNT_SCOPE_COLORS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Percent, Loader2, Pencil, Trash2, X, Save, Check,
  Tag, Info, Calendar, Globe, Users, User, Layers, Clock, Plus, TrendingDown,
} from 'lucide-react';
import { SelectDropdown, SearchableSelect } from '../../components/FormField';

const CURRENT_YEAR = new Date().getFullYear();

type Segment = { id: string; name: string };
type SchoolSeriesLite = { id: string; name: string; segment_id: string };
type SchoolClass = { id: string; name: string; series_id: string | null; school_year: number };
type Student = { id: string; full_name: string };

const EMPTY: Omit<FinancialDiscount, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: null,
  scope: 'global',
  plan_id: null,
  segment_id: null,
  series_id: null,
  class_id: null,
  student_id: null,
  discount_type: 'percentage',
  discount_value: 0,
  progressive_rules: [],
  valid_from: null,
  valid_until: null,
  reason: null,
  priority: 0,
  is_cumulative: false,
  school_year: CURRENT_YEAR,
  is_active: true,
  created_by: null,
};

export default function FinancialDiscountsPage() {
  const { profile } = useAdminAuth();
  usePermissions();
  const [discounts, setDiscounts] = useState<FinancialDiscount[]>([]);
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [seriesList, setSeriesList] = useState<SchoolSeriesLite[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FinancialDiscount | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<DiscountScope | 'all'>('all');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [dRes, pRes, segRes, serRes, classRes, stuRes] = await Promise.all([
      supabase.from('financial_discounts').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('financial_plans').select('*').eq('is_active', true).order('name'),
      supabase.from('school_segments').select('id, name').order('position'),
      supabase.from('school_series').select('id, name, segment_id').eq('is_active', true).order('order_index'),
      supabase.from('school_classes').select('id, name, series_id, school_year').order('school_year', { ascending: false }).order('name'),
      supabase.from('students').select('id, full_name').eq('status', 'active').order('full_name').limit(500),
    ]);
    setDiscounts((dRes.data ?? []) as FinancialDiscount[]);
    setPlans((pRes.data ?? []) as FinancialPlan[]);
    setSegments((segRes.data ?? []) as Segment[]);
    setSeriesList((serRes.data ?? []) as SchoolSeriesLite[]);
    setClasses((classRes.data ?? []) as SchoolClass[]);
    setStudents((stuRes.data ?? []) as Student[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing({ ...EMPTY, id: '', created_at: '', updated_at: '' } as FinancialDiscount);
    setIsNew(true);
  }

  function openEdit(item: FinancialDiscount) {
    setEditing({ ...item });
    setIsNew(false);
  }

  function close() {
    setEditing(null);
    setIsNew(false);
  }

  function updateField<K extends keyof FinancialDiscount>(field: K, value: FinancialDiscount[K]) {
    setEditing((prev) => prev ? { ...prev, [field]: value } : null);
  }

  function handleScopeChange(scope: DiscountScope) {
    setEditing((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        scope,
        plan_id: null,
        segment_id: null,
        series_id: null,
        class_id: null,
        student_id: null,
      };
    });
  }

  async function handleSave() {
    if (!editing || !profile) return;
    setSaving(true);

    const sortedRules = [...(editing.progressive_rules || [])]
      .filter((r) => r.days_before_due >= 0 && r.percentage > 0)
      .sort((a, b) => b.days_before_due - a.days_before_due);

    const payload = {
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      scope: editing.scope,
      plan_id: editing.scope === 'group' ? editing.plan_id : null,
      segment_id: editing.scope === 'group' ? editing.segment_id : null,
      series_id: editing.scope === 'group' ? editing.series_id : null,
      class_id: editing.scope === 'group' ? editing.class_id : null,
      student_id: editing.scope === 'student' ? editing.student_id : null,
      discount_type: editing.discount_type,
      discount_value: sortedRules.length > 0 ? 0 : Number(editing.discount_value),
      progressive_rules: sortedRules,
      valid_from: editing.valid_from || null,
      valid_until: editing.valid_until || null,
      reason: editing.reason?.trim() || null,
      priority: Number(editing.priority),
      is_cumulative: editing.is_cumulative,
      school_year: editing.school_year ? Number(editing.school_year) : null,
      is_active: editing.is_active,
    };

    if (isNew) {
      const { error } = await supabase.from('financial_discounts').insert({ ...payload, created_by: profile.id });
      if (!error) logAudit({ action: 'create', module: 'financial-discounts', description: `Desconto criado: ${payload.name}`, newData: payload });
    } else {
      const { error } = await supabase.from('financial_discounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (!error) logAudit({ action: 'update', module: 'financial-discounts', description: `Desconto atualizado: ${payload.name}`, newData: payload });
    }

    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { setSaved(false); close(); load(); }, 1200);
  }

  async function handleDelete(id: string) {
    const item = discounts.find((d) => d.id === id);
    await supabase.from('financial_discounts').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'financial-discounts', description: `Desconto excluído: ${item?.name}` });
    setDeleteId(null);
    load();
  }

  function formatValue(d: FinancialDiscount) {
    if ((d.progressive_rules?.length ?? 0) > 0) {
      const best = d.progressive_rules.reduce((max, r) => (r.percentage > max ? r.percentage : max), 0);
      return `até ${best}%`;
    }
    if (d.discount_type === 'percentage') return `${d.discount_value}%`;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.discount_value);
  }

  const isProgressive = (editing?.progressive_rules?.length ?? 0) > 0;

  function addProgressiveRule() {
    if (!editing) return;
    const existing = editing.progressive_rules || [];
    const defaultDays = existing.length === 0 ? 10 : Math.max(0, (existing[existing.length - 1]?.days_before_due ?? 10) - 5);
    updateField('progressive_rules', [...existing, { days_before_due: defaultDays, percentage: 5 }]);
  }

  function updateProgressiveRule(idx: number, patch: Partial<ProgressiveDiscountRule>) {
    if (!editing) return;
    const next = [...(editing.progressive_rules || [])];
    next[idx] = { ...next[idx], ...patch };
    updateField('progressive_rules', next);
  }

  function removeProgressiveRule(idx: number) {
    if (!editing) return;
    const next = (editing.progressive_rules || []).filter((_, i) => i !== idx);
    updateField('progressive_rules', next);
  }

  function toggleProgressive() {
    if (!editing) return;
    if (isProgressive) {
      updateField('progressive_rules', []);
    } else {
      updateField('progressive_rules', [{ days_before_due: 10, percentage: 5 }]);
    }
  }

  function scopeTargetLabel(d: FinancialDiscount): string {
    if (d.scope === 'global') return 'Todos os alunos';
    if (d.scope === 'student') {
      const s = students.find((x) => x.id === d.student_id);
      return s ? s.full_name : 'Aluno';
    }
    // group
    const parts: string[] = [];
    if (d.plan_id) parts.push(plans.find((p) => p.id === d.plan_id)?.name || 'Plano');
    if (d.segment_id) parts.push(segments.find((s) => s.id === d.segment_id)?.name || 'Segmento');
    if (d.series_id) parts.push(seriesList.find((s) => s.id === d.series_id)?.name || 'Série');
    if (d.class_id) parts.push(classes.find((c) => c.id === d.class_id)?.name || 'Turma');
    return parts.join(' · ') || 'Grupo';
  }

  const filtered = filterScope === 'all' ? discounts : discounts.filter((d) => d.scope === filterScope);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const ScopeIcon = ({ scope }: { scope: DiscountScope }) => {
    if (scope === 'global') return <Globe className="w-3.5 h-3.5" />;
    if (scope === 'group') return <Users className="w-3.5 h-3.5" />;
    return <User className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} desconto{filtered.length !== 1 && 's'}
          </p>
          <div className="flex items-center gap-1 ml-3">
            {(['all', 'global', 'group', 'student'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterScope(s)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filterScope === s
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s === 'all' ? 'Todos' : DISCOUNT_SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <PermissionGate moduleKey="financial-discounts" action="create">
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors shadow-lg shadow-brand-primary/20">
            <Percent className="w-4 h-4" /> Novo Desconto
          </button>
        </PermissionGate>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Percent className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhum desconto cadastrado</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Crie descontos com escopo global, por grupo ou por aluno</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <div key={d.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate">{d.name}</h3>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${DISCOUNT_SCOPE_COLORS[d.scope]}`}>
                      <ScopeIcon scope={d.scope} />
                      {DISCOUNT_SCOPE_LABELS[d.scope]}
                    </span>
                    {(d.progressive_rules?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <TrendingDown className="w-3 h-3" />
                        Progressivo
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-lg font-bold text-brand-primary dark:text-brand-secondary ml-2 whitespace-nowrap">
                  {formatValue(d)}
                </span>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">{scopeTargetLabel(d)}</p>

              <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
                {d.valid_from && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(d.valid_from).toLocaleDateString('pt-BR')}</span>
                )}
                {d.valid_until && <span>→ {new Date(d.valid_until).toLocaleDateString('pt-BR')}</span>}
                {!d.valid_from && !d.valid_until && <span>Permanente</span>}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${d.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                  {d.is_active ? 'Ativo' : 'Inativo'}
                </span>
                <div className="flex gap-1">
                  <PermissionGate moduleKey="financial-discounts" action="edit">
                    <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-white dark:hover:bg-gray-800 rounded transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </PermissionGate>
                  <PermissionGate moduleKey="financial-discounts" action="delete">
                    {deleteId === d.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(d.id)} className="px-2 py-1 text-[10px] bg-red-500 text-white rounded">OK</button>
                        <button onClick={() => setDeleteId(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(d.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </PermissionGate>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={!!editing}
        onClose={close}
        title={isNew ? 'Novo Desconto' : 'Editar Desconto'}
        icon={Percent}
        width="w-[440px]"
        footer={
          <div className="flex gap-3">
            <button onClick={close} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancelar</button>
            <button onClick={handleSave} disabled={!editing?.name.trim() || (!isProgressive && (editing?.discount_value ?? 0) <= 0) || (isProgressive && (editing?.progressive_rules?.length ?? 0) === 0) || saving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
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
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome *</label>
                <input value={editing.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Ex: Desconto Irmão"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Motivo</label>
                <input value={editing.reason || ''} onChange={(e) => updateField('reason', e.target.value || null)} placeholder="Ex: Comercial, Irmão, Funcionário"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição</label>
                <textarea value={editing.description || ''} onChange={(e) => updateField('description', e.target.value || null)} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm resize-none" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${editing.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  onClick={() => updateField('is_active', !editing.is_active)}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editing.is_active ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">{editing.is_active ? 'Desconto ativo' : 'Desconto inativo'}</span>
              </label>
            </DrawerCard>

            <DrawerCard title="Escopo" icon={Layers}>
              <div className="grid grid-cols-3 gap-2">
                {(['global', 'group', 'student'] as DiscountScope[]).map((s) => {
                  const Icon = s === 'global' ? Globe : s === 'group' ? Users : User;
                  const active = editing.scope === s;
                  return (
                    <button key={s} type="button" onClick={() => handleScopeChange(s)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        active
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px] font-semibold">{DISCOUNT_SCOPE_LABELS[s]}</span>
                    </button>
                  );
                })}
              </div>

              {editing.scope === 'global' && (
                <p className="text-[11px] text-gray-400">Desconto aplicado a todos os alunos com contratos ativos.</p>
              )}

              {editing.scope === 'group' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-400">Preencha ao menos um filtro. Múltiplos filtros se combinam (OR).</p>
                  <SelectDropdown label="Plano" value={editing.plan_id || ''} onChange={(e) => updateField('plan_id', e.target.value || null)}>
                    <option value="">— Qualquer plano —</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </SelectDropdown>
                  <SelectDropdown
                    label="Segmento"
                    value={editing.segment_id || ''}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      updateField('segment_id', next);
                      // Reset série/turma se o segmento mudou
                      if (editing.series_id) {
                        const ser = seriesList.find((s) => s.id === editing.series_id);
                        if (!next || ser?.segment_id !== next) updateField('series_id', null);
                      }
                    }}
                  >
                    <option value="">— Qualquer segmento —</option>
                    {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </SelectDropdown>
                  <SelectDropdown
                    label="Série"
                    hint="Mais específico que segmento, menos que turma."
                    value={editing.series_id || ''}
                    onChange={(e) => updateField('series_id', e.target.value || null)}
                  >
                    <option value="">— Qualquer série —</option>
                    {seriesList
                      .filter((s) => !editing.segment_id || s.segment_id === editing.segment_id)
                      .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </SelectDropdown>
                  <SearchableSelect
                    label="Turma"
                    value={editing.class_id || ''}
                    onChange={(val) => updateField('class_id', val || null)}
                    options={[
                      { value: '', label: '— Qualquer turma —' },
                      ...classes
                        .filter((c) => !editing.series_id || c.series_id === editing.series_id)
                        .map((c) => {
                          const ser = seriesList.find((s) => s.id === c.series_id);
                          return {
                            value: c.id,
                            label: `${ser ? `${ser.name} ${c.name}` : c.name} ${c.school_year}`,
                          };
                        }),
                    ]}
                    placeholder="— Qualquer turma —"
                  />
                </div>
              )}

              {editing.scope === 'student' && (
                <SearchableSelect
                  label="Aluno *"
                  value={editing.student_id || ''}
                  onChange={(val) => updateField('student_id', val || null)}
                  options={students.map((s) => ({ value: s.id, label: s.full_name }))}
                  placeholder="Selecione o aluno..."
                />
              )}
            </DrawerCard>

            <DrawerCard title="Valor" icon={Percent}>
              {/* Toggle: Fixo vs Progressivo */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => isProgressive && toggleProgressive()}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all text-left ${
                    !isProgressive
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide">Fixo</span>
                  </div>
                  <span className="text-[10px] opacity-70">Valor único</span>
                </button>
                <button type="button" onClick={() => !isProgressive && toggleProgressive()}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all text-left ${
                    isProgressive
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide">Progressivo</span>
                  </div>
                  <span className="text-[10px] opacity-70">Por antecedência</span>
                </button>
              </div>

              {!isProgressive && (
                <div className="grid grid-cols-2 gap-3">
                  <SelectDropdown label="Tipo *" value={editing.discount_type} onChange={(e) => updateField('discount_type', e.target.value as DiscountType)}>
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </SelectDropdown>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor *</label>
                    <input type="number" step="0.01" min="0" value={editing.discount_value || ''} onChange={(e) => updateField('discount_value', Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                  </div>
                </div>
              )}

              {isProgressive && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                    <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-snug">
                      Aplicado apenas no momento do pagamento. A maior regra que se encaixar no intervalo até o vencimento será aplicada.
                    </p>
                  </div>

                  {(editing.progressive_rules || []).map((rule, idx) => (
                    <div key={idx} className="flex items-end gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Dias antes do vencimento</label>
                        <div className="relative">
                          <input type="number" min="0" max="60" value={rule.days_before_due}
                            onChange={(e) => updateProgressiveRule(idx, { days_before_due: Number(e.target.value) })}
                            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                          <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Desconto</label>
                        <div className="relative">
                          <input type="number" step="0.1" min="0" max="100" value={rule.percentage}
                            onChange={(e) => updateProgressiveRule(idx, { percentage: Number(e.target.value) })}
                            className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                          <Percent className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                      <button type="button" onClick={() => removeProgressiveRule(idx)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button type="button" onClick={addProgressiveRule}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-brand-primary hover:text-brand-primary transition-colors text-sm font-medium">
                    <Plus className="w-4 h-4" /> Adicionar regra
                  </button>
                </div>
              )}
            </DrawerCard>

            <DrawerCard title="Vigência" icon={Calendar}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Válido a partir de</label>
                  <input type="date" value={editing.valid_from || ''} onChange={(e) => updateField('valid_from', e.target.value || null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Válido até</label>
                  <input type="date" value={editing.valid_until || ''} onChange={(e) => updateField('valid_until', e.target.value || null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Ano letivo</label>
                <input type="number" min="2024" max="2030" value={editing.school_year || ''} onChange={(e) => updateField('school_year', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                <p className="text-[11px] text-gray-400 mt-1">Deixe vazio para aplicar a qualquer ano.</p>
              </div>
            </DrawerCard>

            <DrawerCard title="Regras de Aplicação" icon={Info}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Prioridade</label>
                <input type="number" min="0" value={editing.priority} onChange={(e) => updateField('priority', Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                <p className="text-[11px] text-gray-400 mt-1">Maior prioridade = aplica primeiro em caso de conflito.</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <div className={`relative w-10 h-5 rounded-full transition-colors mt-0.5 ${editing.is_cumulative ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                  onClick={() => updateField('is_cumulative', !editing.is_cumulative)}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editing.is_cumulative ? 'translate-x-5' : ''}`} />
                </div>
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Cumulativo com outros descontos</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Se desligado, este desconto é exclusivo: não acumula com outros.
                  </p>
                </div>
              </label>
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}
