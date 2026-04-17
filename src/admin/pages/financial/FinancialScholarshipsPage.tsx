import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type {
  FinancialScholarship,
  ScholarshipType,
  ScholarshipStatus,
} from '../../types/admin.types';
import {
  SCHOLARSHIP_STATUS_LABELS,
  SCHOLARSHIP_STATUS_COLORS,
  SCHOLARSHIP_TYPE_LABELS,
  SCHOLARSHIP_CATEGORY_LABELS,
} from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  GraduationCap, Loader2, Pencil, Trash2, X, Save, Check,
  Tag, Calendar, FileText, User as UserIcon, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { SelectDropdown, SearchableSelect } from '../../components/FormField';

const CURRENT_YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);
const NEXT_YEAR_END = `${CURRENT_YEAR}-12-31`;

type Student = { id: string; full_name: string };

const EMPTY: Omit<FinancialScholarship, 'id' | 'created_at' | 'updated_at'> = {
  student_id: '',
  name: '',
  description: null,
  scholarship_type: 'percentage',
  scholarship_value: 50,
  valid_from: TODAY,
  valid_until: NEXT_YEAR_END,
  category: 'social',
  justification: null,
  document_url: null,
  status: 'pending',
  approved_by: null,
  approved_at: null,
  rejection_reason: null,
  school_year: CURRENT_YEAR,
  is_renewable: false,
  renewed_from: null,
  created_by: null,
};

export default function FinancialScholarshipsPage() {
  const { profile } = useAdminAuth();
  usePermissions();
  const [scholarships, setScholarships] = useState<FinancialScholarship[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FinancialScholarship | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ScholarshipStatus | 'all'>('all');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, stuRes] = await Promise.all([
      supabase.from('financial_scholarships').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name').eq('status', 'active').order('full_name').limit(500),
    ]);
    setScholarships((sRes.data ?? []) as FinancialScholarship[]);
    setStudents((stuRes.data ?? []) as Student[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing({ ...EMPTY, id: '', created_at: '', updated_at: '' } as FinancialScholarship);
    setIsNew(true);
  }

  function openEdit(item: FinancialScholarship) {
    setEditing({ ...item });
    setIsNew(false);
  }

  function close() {
    setEditing(null);
    setIsNew(false);
  }

  function updateField<K extends keyof FinancialScholarship>(field: K, value: FinancialScholarship[K]) {
    setEditing((prev) => prev ? { ...prev, [field]: value } : null);
  }

  async function handleSave() {
    if (!editing || !profile) return;
    if (!editing.student_id) return;
    setSaving(true);

    const payload = {
      student_id: editing.student_id,
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      scholarship_type: editing.scholarship_type,
      scholarship_value: Number(editing.scholarship_value),
      valid_from: editing.valid_from,
      valid_until: editing.valid_until,
      category: editing.category,
      justification: editing.justification?.trim() || null,
      document_url: editing.document_url?.trim() || null,
      status: editing.status,
      school_year: Number(editing.school_year),
      is_renewable: editing.is_renewable,
    };

    if (isNew) {
      const { error } = await supabase.from('financial_scholarships').insert({ ...payload, created_by: profile.id });
      if (!error) logAudit({ action: 'create', module: 'financial-scholarships', description: `Bolsa criada: ${payload.name}`, newData: payload });
    } else {
      const { error } = await supabase.from('financial_scholarships').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (!error) logAudit({ action: 'update', module: 'financial-scholarships', description: `Bolsa atualizada: ${payload.name}`, newData: payload });
    }

    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { setSaved(false); close(); load(); }, 1200);
  }

  async function handleDelete(id: string) {
    const item = scholarships.find((s) => s.id === id);
    await supabase.from('financial_scholarships').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'financial-scholarships', description: `Bolsa excluída: ${item?.name}` });
    setDeleteId(null);
    load();
  }

  async function handleApproval(id: string, approved: boolean) {
    if (!profile) return;
    const update: Partial<FinancialScholarship> = {
      status: approved ? 'approved' : 'rejected',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    };
    await supabase.from('financial_scholarships').update({ ...update, updated_at: new Date().toISOString() }).eq('id', id);
    logAudit({
      action: 'update',
      module: 'financial-scholarships',
      description: `Bolsa ${approved ? 'aprovada' : 'rejeitada'}`,
    });
    load();
  }

  function formatValue(s: FinancialScholarship) {
    if (s.scholarship_type === 'full') return '100%';
    if (s.scholarship_type === 'percentage') return `${s.scholarship_value}%`;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.scholarship_value);
  }

  function studentName(id: string): string {
    return students.find((s) => s.id === id)?.full_name || 'Aluno';
  }

  const filtered = filterStatus === 'all' ? scholarships : scholarships.filter((s) => s.status === filterStatus);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} bolsa{filtered.length !== 1 && 's'}
          </p>
          <div className="flex items-center gap-1 ml-3">
            {(['all', 'pending', 'approved', 'rejected', 'expired'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filterStatus === s
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s === 'all' ? 'Todas' : SCHOLARSHIP_STATUS_LABELS[s as ScholarshipStatus]}
              </button>
            ))}
          </div>
        </div>
        <PermissionGate moduleKey="financial-scholarships" action="create">
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors shadow-lg shadow-brand-primary/20">
            <GraduationCap className="w-4 h-4" /> Nova Bolsa
          </button>
        </PermissionGate>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma bolsa cadastrada</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Cadastre bolsas de estudo com validade e aprovação</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div key={s.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate">{s.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate flex items-center gap-1">
                    <UserIcon className="w-3 h-3" /> {studentName(s.student_id)}
                  </p>
                </div>
                <span className="text-lg font-bold text-brand-primary dark:text-brand-secondary ml-2">
                  {formatValue(s)}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2 mb-3 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SCHOLARSHIP_STATUS_COLORS[s.status]}`}>
                  {SCHOLARSHIP_STATUS_LABELS[s.status]}
                </span>
                <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {SCHOLARSHIP_CATEGORY_LABELS[s.category] || s.category}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-3">
                <Calendar className="w-3 h-3" />
                {new Date(s.valid_from).toLocaleDateString('pt-BR')} → {new Date(s.valid_until).toLocaleDateString('pt-BR')}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                {s.status === 'pending' ? (
                  <div className="flex gap-1">
                    <button onClick={() => handleApproval(s.id, true)} className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors" title="Aprovar">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleApproval(s.id, false)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Rejeitar">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400">
                    {s.approved_at && `Aprovada em ${new Date(s.approved_at).toLocaleDateString('pt-BR')}`}
                  </span>
                )}
                <div className="flex gap-1">
                  <PermissionGate moduleKey="financial-scholarships" action="edit">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-white dark:hover:bg-gray-800 rounded transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </PermissionGate>
                  <PermissionGate moduleKey="financial-scholarships" action="delete">
                    {deleteId === s.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(s.id)} className="px-2 py-1 text-[10px] bg-red-500 text-white rounded">OK</button>
                        <button onClick={() => setDeleteId(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
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
        title={isNew ? 'Nova Bolsa' : 'Editar Bolsa'}
        icon={GraduationCap}
        width="w-[440px]"
        footer={
          <div className="flex gap-3">
            <button onClick={close} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancelar</button>
            <button onClick={handleSave} disabled={!editing?.name.trim() || !editing?.student_id || saving}
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
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome da bolsa *</label>
                <input value={editing.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Ex: Bolsa Mérito 2026"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm" />
              </div>
              <SearchableSelect
                label="Aluno *"
                value={editing.student_id}
                onChange={(val) => updateField('student_id', val)}
                options={students.map((s) => ({ value: s.id, label: s.full_name }))}
                placeholder="Selecione o aluno..."
              />
              <SelectDropdown label="Categoria *" value={editing.category} onChange={(e) => updateField('category', e.target.value)}>
                {Object.entries(SCHOLARSHIP_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </SelectDropdown>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição</label>
                <textarea value={editing.description || ''} onChange={(e) => updateField('description', e.target.value || null)} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm resize-none" />
              </div>
            </DrawerCard>

            <DrawerCard title="Valor e Vigência" icon={Calendar}>
              <div className="grid grid-cols-2 gap-3">
                <SelectDropdown label="Tipo *" value={editing.scholarship_type} onChange={(e) => updateField('scholarship_type', e.target.value as ScholarshipType)}>
                  {Object.entries(SCHOLARSHIP_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </SelectDropdown>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor</label>
                  <input type="number" step="0.01" min="0" disabled={editing.scholarship_type === 'full'}
                    value={editing.scholarship_type === 'full' ? 100 : editing.scholarship_value || ''}
                    onChange={(e) => updateField('scholarship_value', Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm disabled:opacity-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Válida a partir de *</label>
                  <input type="date" value={editing.valid_from} onChange={(e) => updateField('valid_from', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Válida até *</label>
                  <input type="date" value={editing.valid_until} onChange={(e) => updateField('valid_until', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Ano letivo *</label>
                <input type="number" min="2024" max="2030" value={editing.school_year} onChange={(e) => updateField('school_year', Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none text-sm" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${editing.is_renewable ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                  onClick={() => updateField('is_renewable', !editing.is_renewable)}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editing.is_renewable ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Renovável automaticamente</span>
              </label>
            </DrawerCard>

            <DrawerCard title="Justificativa e Documentos" icon={FileText}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Justificativa</label>
                <textarea value={editing.justification || ''} onChange={(e) => updateField('justification', e.target.value || null)} rows={3}
                  placeholder="Motivo da concessão, critérios atendidos, etc."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">URL do documento</label>
                <input type="url" value={editing.document_url || ''} onChange={(e) => updateField('document_url', e.target.value || null)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm" />
              </div>
              <SelectDropdown label="Status" value={editing.status} onChange={(e) => updateField('status', e.target.value as ScholarshipStatus)}>
                {Object.entries(SCHOLARSHIP_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </SelectDropdown>
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}
