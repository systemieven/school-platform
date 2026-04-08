import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { SchoolSegment, SchoolClass, Shift } from '../../types/admin.types';
import { SHIFT_LABELS } from '../../types/admin.types';
import {
  GraduationCap, Plus, Loader2, Pencil, Trash2, ChevronDown, ChevronRight,
  Users, X, BookOpen,
} from 'lucide-react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';

// ── Segment form ──────────────────────────────────────────────────────────────
interface SegmentForm {
  name: string;
  slug: string;
  description: string;
  position: number;
  is_active: boolean;
  coordinator_ids: string[];
}

const emptySegmentForm = (): SegmentForm => ({
  name: '', slug: '', description: '', position: 0, is_active: true, coordinator_ids: [],
});

// ── Class form ────────────────────────────────────────────────────────────────
interface ClassForm {
  name: string;
  year: number;
  shift: Shift;
  max_students: string;
  is_active: boolean;
  teacher_ids: string[];
}

const emptyClassForm = (): ClassForm => ({
  name: '', year: new Date().getFullYear(), shift: 'morning', max_students: '', is_active: true, teacher_ids: [],
});

// ── Staff profile (coordinator / teacher picker) ──────────────────────────────
interface StaffProfile { id: string; full_name: string; role: string; }

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SegmentsPage() {
  const [segments, setSegments]   = useState<SchoolSegment[]>([]);
  const [classMap, setClassMap]   = useState<Record<string, SchoolClass[]>>({});
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);

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
    const [{ data: segs }, { data: classes }, { data: staff }] = await Promise.all([
      supabase.from('school_segments').select('*').order('position'),
      supabase.from('school_classes').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, role').in('role', ['coordinator', 'teacher', 'admin', 'super_admin']).eq('is_active', true).order('full_name'),
    ]);
    setSegments((segs ?? []) as SchoolSegment[]);
    setStaffProfiles((staff ?? []) as StaffProfile[]);
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
      position: s.position, is_active: s.is_active, coordinator_ids: s.coordinator_ids ?? [],
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
      coordinator_ids: segForm.coordinator_ids,
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
      max_students: c.max_students?.toString() ?? '', is_active: c.is_active, teacher_ids: c.teacher_ids ?? [],
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
      teacher_ids: classForm.teacher_ids,
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

      {/* Segments */}
      <div className="space-y-3">
        {segments.map((seg) => {
          const isExpanded = expanded.has(seg.id);
          const classes = classMap[seg.id] ?? [];
          const activeCount = classes.filter((c) => c.is_active).length;

          return (
            <div key={seg.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
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
                  {classes.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-xs">
                      Nenhuma turma cadastrada.{' '}
                      <button onClick={() => startNewClass(seg.id)} className="text-[#003876] dark:text-[#ffd700] hover:underline">
                        Adicionar turma
                      </button>
                    </div>
                  )}
                  {classes.map((cls) => (
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
                  ))}
                </div>
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

      {/* Segment Drawer */}
      {editSegId !== null && (
        <SegmentDrawer
          isNew={editSegId === 'new'}
          form={segForm}
          onChange={setSegForm}
          onSave={saveSegment}
          onCancel={() => setEditSegId(null)}
          saving={savingSeg}
          staffProfiles={staffProfiles}
        />
      )}

      {/* Class Drawer */}
      {editClassId !== null && (
        <ClassDrawer
          isNew={editClassId === 'new'}
          segmentName={segments.find((s) => s.id === editClassSegId)?.name ?? ''}
          form={classForm}
          onChange={setClassForm}
          onSave={saveClass}
          onCancel={() => { setEditClassId(null); setEditClassSegId(null); }}
          saving={savingClass}
          staffProfiles={staffProfiles}
        />
      )}
    </div>
  );
}

// ── Shared input styles ───────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none text-sm transition-all';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

// ── Segment Drawer ────────────────────────────────────────────────────────────
function SegmentDrawer({ isNew, form, onChange, onSave, onCancel, saving, staffProfiles }: {
  isNew: boolean;
  form: SegmentForm;
  onChange: (f: SegmentForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  staffProfiles: StaffProfile[];
}) {
  const coordinators = staffProfiles.filter((p) => ['coordinator', 'admin', 'super_admin'].includes(p.role));
  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onCancel} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#003876] to-[#002255] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            <h2 className="font-semibold text-sm">{isNew ? 'Novo Segmento' : 'Editar Segmento'}</h2>
          </div>
          <button onClick={onCancel} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <SettingsCard title="Identificação">
            <div>
              <label className={labelCls}>Nome</label>
              <input
                type="text" value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                className={inputCls} placeholder="Ex: Ensino Fundamental I"
              />
            </div>
            <div>
              <label className={labelCls}>Slug</label>
              <input
                type="text" value={form.slug}
                onChange={(e) => onChange({ ...form, slug: e.target.value })}
                className={inputCls} placeholder="fundamental-1"
              />
              <p className="text-[11px] text-gray-400 mt-1">Gerado automaticamente se deixado em branco</p>
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <input
                type="text" value={form.description}
                onChange={(e) => onChange({ ...form, description: e.target.value })}
                className={inputCls} placeholder="Ex: 1º ao 5º ano (6-10 anos)"
              />
            </div>
            <div>
              <label className={labelCls}>Posição</label>
              <input
                type="number" value={form.position}
                onChange={(e) => onChange({ ...form, position: parseInt(e.target.value) || 0 })}
                className={inputCls}
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Status">
            <Toggle
              checked={form.is_active}
              onChange={(v) => onChange({ ...form, is_active: v })}
              label={form.is_active ? 'Segmento ativo' : 'Segmento inativo'}
              description={form.is_active ? 'Visível no sistema' : 'Oculto no sistema'}
              onColor="bg-emerald-500"
            />
          </SettingsCard>

          {coordinators.length > 0 && (
            <SettingsCard title="Coordenadores">
              <div className="flex flex-wrap gap-2">
                {coordinators.map((p) => {
                  const active = form.coordinator_ids.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? form.coordinator_ids.filter((id) => id !== p.id)
                          : [...form.coordinator_ids, p.id];
                        onChange({ ...form, coordinator_ids: next });
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        active
                          ? 'bg-[#003876] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {p.full_name}
                    </button>
                  );
                })}
              </div>
            </SettingsCard>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button
            type="button" onClick={onSave}
            disabled={!form.name || saving}
            className="flex-1 py-2.5 bg-[#003876] hover:bg-[#002855] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : 'Salvar'}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Class Drawer ──────────────────────────────────────────────────────────────
function ClassDrawer({ isNew, segmentName, form, onChange, onSave, onCancel, saving, staffProfiles }: {
  isNew: boolean;
  segmentName: string;
  form: ClassForm;
  onChange: (f: ClassForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  staffProfiles: StaffProfile[];
}) {
  const teachers = staffProfiles.filter((p) => ['teacher', 'coordinator', 'admin', 'super_admin'].includes(p.role));
  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onCancel} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#003876] to-[#002255] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <div>
              <h2 className="font-semibold text-sm">{isNew ? 'Nova Turma' : 'Editar Turma'}</h2>
              {segmentName && <p className="text-[11px] text-white/60">{segmentName}</p>}
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <SettingsCard title="Identificação">
            <div>
              <label className={labelCls}>Nome da turma</label>
              <input
                type="text" value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                className={inputCls} placeholder="3º Ano A"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ano letivo</label>
                <input
                  type="number" value={form.year}
                  onChange={(e) => onChange({ ...form, year: parseInt(e.target.value) || 2026 })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Turno</label>
                <div className="relative">
                  <select
                    value={form.shift}
                    onChange={(e) => onChange({ ...form, shift: e.target.value as Shift })}
                    className={`${inputCls} appearance-none pr-9`}
                  >
                    <option value="morning">Manhã</option>
                    <option value="afternoon">Tarde</option>
                    <option value="full">Integral</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Máx. alunos</label>
              <input
                type="number" value={form.max_students}
                onChange={(e) => onChange({ ...form, max_students: e.target.value })}
                className={inputCls} placeholder="Sem limite"
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Status">
            <Toggle
              checked={form.is_active}
              onChange={(v) => onChange({ ...form, is_active: v })}
              label={form.is_active ? 'Turma ativa' : 'Turma inativa'}
              description={form.is_active ? 'Visível no sistema' : 'Oculta no sistema'}
              onColor="bg-emerald-500"
            />
          </SettingsCard>

          {teachers.length > 0 && (
            <SettingsCard title="Professores">
              <div className="flex flex-wrap gap-2">
                {teachers.map((p) => {
                  const active = form.teacher_ids.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? form.teacher_ids.filter((id) => id !== p.id)
                          : [...form.teacher_ids, p.id];
                        onChange({ ...form, teacher_ids: next });
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        active
                          ? 'bg-[#003876] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {p.full_name}
                    </button>
                  );
                })}
              </div>
            </SettingsCard>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button
            type="button" onClick={onSave}
            disabled={!form.name || saving}
            className="flex-1 py-2.5 bg-[#003876] hover:bg-[#002855] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : 'Salvar'}
          </button>
        </div>
      </aside>
    </>
  );
}
