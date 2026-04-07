import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { SchoolSegment, SchoolClass, Shift } from '../../types/admin.types';
import { SHIFT_LABELS } from '../../types/admin.types';
import {
  GraduationCap, Plus, Loader2, Pencil, Trash2, ChevronDown, ChevronRight,
  Users, Save, X, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ── Segment form ──────────────────────────────────────────────────────────────
interface SegmentForm {
  name: string;
  slug: string;
  description: string;
  position: number;
  is_active: boolean;
}

const emptySegmentForm = (): SegmentForm => ({
  name: '', slug: '', description: '', position: 0, is_active: true,
});

// ── Class form ────────────────────────────────────────────────────────────────
interface ClassForm {
  name: string;
  year: number;
  shift: Shift;
  max_students: string;
  is_active: boolean;
}

const emptyClassForm = (): ClassForm => ({
  name: '', year: new Date().getFullYear(), shift: 'morning', max_students: '', is_active: true,
});

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SegmentsPage() {
  const [segments, setSegments] = useState<SchoolSegment[]>([]);
  const [classMap, setClassMap] = useState<Record<string, SchoolClass[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Segment editing
  const [editSegId, setEditSegId]   = useState<string | null>(null);
  const [segForm, setSegForm]       = useState<SegmentForm>(emptySegmentForm());
  const [savingSeg, setSavingSeg]   = useState(false);

  // Class editing
  const [editClassSegId, setEditClassSegId] = useState<string | null>(null);
  const [editClassId, setEditClassId]       = useState<string | null>(null);
  const [classForm, setClassForm]           = useState<ClassForm>(emptyClassForm());
  const [savingClass, setSavingClass]       = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: segs }, { data: classes }] = await Promise.all([
      supabase.from('school_segments').select('*').order('position'),
      supabase.from('school_classes').select('*').order('name'),
    ]);
    setSegments((segs ?? []) as SchoolSegment[]);
    const map: Record<string, SchoolClass[]> = {};
    ((classes ?? []) as SchoolClass[]).forEach((c) => {
      (map[c.segment_id] ??= []).push(c);
    });
    setClassMap(map);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Segment CRUD ────────────────────────────────────────────────────────────
  function startNewSegment() {
    const form = emptySegmentForm();
    form.position = segments.length + 1;
    setSegForm(form);
    setEditSegId('new');
  }

  function startEditSegment(s: SchoolSegment) {
    setSegForm({
      name: s.name, slug: s.slug, description: s.description ?? '',
      position: s.position, is_active: s.is_active,
    });
    setEditSegId(s.id);
  }

  async function saveSegment() {
    setSavingSeg(true);
    const payload = {
      name: segForm.name,
      slug: segForm.slug || segForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: segForm.description || null,
      position: segForm.position,
      is_active: segForm.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editSegId === 'new') {
      await supabase.from('school_segments').insert(payload);
    } else {
      await supabase.from('school_segments').update(payload).eq('id', editSegId);
    }
    setEditSegId(null);
    setSavingSeg(false);
    await fetchAll();
  }

  async function deleteSegment(id: string) {
    await supabase.from('school_segments').delete().eq('id', id);
    await fetchAll();
  }

  // ── Class CRUD ──────────────────────────────────────────────────────────────
  function startNewClass(segmentId: string) {
    setClassForm(emptyClassForm());
    setEditClassSegId(segmentId);
    setEditClassId('new');
    setExpanded((prev) => new Set(prev).add(segmentId));
  }

  function startEditClass(c: SchoolClass) {
    setClassForm({
      name: c.name, year: c.year, shift: (c.shift ?? 'morning') as Shift,
      max_students: c.max_students?.toString() ?? '', is_active: c.is_active,
    });
    setEditClassSegId(c.segment_id);
    setEditClassId(c.id);
  }

  async function saveClass() {
    setSavingClass(true);
    const payload = {
      segment_id: editClassSegId!,
      name: classForm.name,
      year: classForm.year,
      shift: classForm.shift,
      max_students: classForm.max_students ? parseInt(classForm.max_students) : null,
      is_active: classForm.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editClassId === 'new') {
      await supabase.from('school_classes').insert(payload);
    } else {
      await supabase.from('school_classes').update(payload).eq('id', editClassId);
    }
    setEditClassId(null);
    setEditClassSegId(null);
    setSavingClass(false);
    await fetchAll();
  }

  async function deleteClass(id: string) {
    await supabase.from('school_classes').delete().eq('id', id);
    await fetchAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <GraduationCap className="w-8 h-8" />
            Segmentos e Turmas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie segmentos escolares e suas turmas.</p>
        </div>
        <button
          onClick={startNewSegment}
          className="flex items-center gap-2 px-4 py-2 bg-[#003876] text-white rounded-xl text-sm font-medium hover:bg-[#002a5c] transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Segmento
        </button>
      </div>

      {/* New segment form */}
      {editSegId === 'new' && (
        <SegmentFormCard
          form={segForm}
          onChange={setSegForm}
          onSave={saveSegment}
          onCancel={() => setEditSegId(null)}
          saving={savingSeg}
          isNew
        />
      )}

      {/* Segments */}
      <div className="space-y-3">
        {segments.map((seg) => {
          const isExpanded = expanded.has(seg.id);
          const classes = classMap[seg.id] ?? [];
          const isEditing = editSegId === seg.id;
          const activeCount = classes.filter((c) => c.is_active).length;

          return (
            <div key={seg.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {isEditing ? (
                <SegmentFormCard
                  form={segForm}
                  onChange={setSegForm}
                  onSave={saveSegment}
                  onCancel={() => setEditSegId(null)}
                  saving={savingSeg}
                />
              ) : (
                <>
                  {/* Segment header */}
                  <button
                    onClick={() => toggleExpand(seg.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{seg.name}</span>
                        {!seg.is_active && (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-full">Inativo</span>
                        )}
                      </div>
                      {seg.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{seg.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                      <Users className="w-3.5 h-3.5" />
                      {activeCount} turma{activeCount !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startEditSegment(seg)}
                        className="p-1.5 text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Editar segmento"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => startNewClass(seg.id)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Adicionar turma"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      {classes.length === 0 && (
                        <button
                          onClick={() => deleteSegment(seg.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Excluir segmento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </button>

                  {/* Classes list */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      {/* New class form */}
                      {editClassSegId === seg.id && editClassId === 'new' && (
                        <ClassFormRow
                          form={classForm}
                          onChange={setClassForm}
                          onSave={saveClass}
                          onCancel={() => { setEditClassId(null); setEditClassSegId(null); }}
                          saving={savingClass}
                        />
                      )}

                      {classes.length === 0 && editClassId !== 'new' && (
                        <div className="text-center py-6 text-gray-400 text-xs">
                          Nenhuma turma cadastrada.{' '}
                          <button onClick={() => startNewClass(seg.id)} className="text-[#003876] dark:text-[#ffd700] hover:underline">
                            Adicionar turma
                          </button>
                        </div>
                      )}

                      {classes.map((cls) => {
                        const isEditingClass = editClassId === cls.id;
                        return isEditingClass ? (
                          <ClassFormRow
                            key={cls.id}
                            form={classForm}
                            onChange={setClassForm}
                            onSave={saveClass}
                            onCancel={() => { setEditClassId(null); setEditClassSegId(null); }}
                            saving={savingClass}
                          />
                        ) : (
                          <div
                            key={cls.id}
                            className="flex items-center gap-3 px-4 py-3 pl-12 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors border-t border-gray-50 dark:border-gray-700/50"
                          >
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${cls.is_active ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 line-through'}`}>
                                {cls.name}
                              </span>
                              <span className="text-xs text-gray-400 ml-2">
                                {cls.year} · {SHIFT_LABELS[cls.shift as Shift] ?? cls.shift}
                                {cls.max_students != null && ` · Max ${cls.max_students}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => startEditClass(cls)}
                                className="p-1.5 text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteClass(cls.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {segments.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum segmento cadastrado.</p>
            <button onClick={startNewSegment} className="mt-3 text-sm text-[#003876] dark:text-[#ffd700] hover:underline">
              Cadastrar primeiro segmento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Segment form card ─────────────────────────────────────────────────────────
function SegmentFormCard({ form, onChange, onSave, onCancel, saving, isNew }: {
  form: SegmentForm;
  onChange: (f: SegmentForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border-2 border-[#003876]/20 dark:border-[#ffd700]/20 p-5 ${isNew ? 'mb-4' : ''}`}>
      <p className="text-sm font-bold text-[#003876] dark:text-[#ffd700] mb-3">{isNew ? 'Novo Segmento' : 'Editar Segmento'}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nome</label>
          <input
            type="text" value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            placeholder="Ex: Ensino Fundamental I"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Slug</label>
          <input
            type="text" value={form.slug}
            onChange={(e) => onChange({ ...form, slug: e.target.value })}
            className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            placeholder="fundamental-1"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Descrição</label>
          <input
            type="text" value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            placeholder="Ex: 1º ao 5º ano (6-10 anos)"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="block text-xs text-gray-500">Posição</label>
          <input
            type="number" value={form.position}
            onChange={(e) => onChange({ ...form, position: parseInt(e.target.value) || 0 })}
            className="w-20 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...form, is_active: !form.is_active })}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
              form.is_active
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
            }`}
          >
            {form.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {form.is_active ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="flex items-center gap-1 text-xs px-3 py-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={!form.name || saving}
          className="flex items-center gap-1 text-xs px-4 py-2 bg-[#003876] text-white rounded-lg hover:bg-[#002a5c] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Salvar
        </button>
      </div>
    </div>
  );
}

// ── Class inline form ─────────────────────────────────────────────────────────
function ClassFormRow({ form, onChange, onSave, onCancel, saving }: {
  form: ClassForm;
  onChange: (f: ClassForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 px-4 py-3 pl-12 bg-blue-50/50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/20">
      <div>
        <label className="block text-[10px] text-gray-500 mb-0.5">Nome</label>
        <input
          type="text" value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 w-36"
          placeholder="3º Ano A"
        />
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 mb-0.5">Ano</label>
        <input
          type="number" value={form.year}
          onChange={(e) => onChange({ ...form, year: parseInt(e.target.value) || 2026 })}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 w-20"
        />
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 mb-0.5">Turno</label>
        <select
          value={form.shift}
          onChange={(e) => onChange({ ...form, shift: e.target.value as Shift })}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
        >
          <option value="morning">Manhã</option>
          <option value="afternoon">Tarde</option>
          <option value="full">Integral</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 mb-0.5">Max alunos</label>
        <input
          type="number" value={form.max_students}
          onChange={(e) => onChange({ ...form, max_students: e.target.value })}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 w-20"
          placeholder="—"
        />
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onSave}
          disabled={!form.name || saving}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-[#003876] text-white rounded-lg hover:bg-[#002a5c] disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
