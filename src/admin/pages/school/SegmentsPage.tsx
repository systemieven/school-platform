import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type { SchoolSegment, SchoolSeries, SchoolClass, Shift } from '../../types/admin.types';
import { SHIFT_LABELS } from '../../types/admin.types';
import {
  GraduationCap, Plus, Loader2, Pencil, Trash2, ChevronDown, ChevronRight,
  Users, X, BookOpen, Check, Layers,
} from 'lucide-react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';

// ── Forms ─────────────────────────────────────────────────────────────────────
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

interface SeriesForm {
  name: string;
  short_name: string;
  order_index: number;
  is_active: boolean;
}
const emptySeriesForm = (): SeriesForm => ({
  name: '', short_name: '', order_index: 0, is_active: true,
});

interface ClassForm {
  name: string;
  school_year: number;
  shift: Shift;
  max_students: string;
  is_active: boolean;
  teacher_ids: string[];
}
const emptyClassForm = (): ClassForm => ({
  name: '', school_year: new Date().getFullYear(), shift: 'morning', max_students: '', is_active: true, teacher_ids: [],
});

// ── Staff profile ────────────────────────────────────────────────────────────
interface StaffProfile { id: string; full_name: string; role: string; }

type SaveState = 'idle' | 'saving' | 'saved';

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SegmentsPage() {
  const [segments, setSegments]       = useState<SchoolSegment[]>([]);
  const [seriesMap, setSeriesMap]     = useState<Record<string, SchoolSeries[]>>({});  // keyed by segment_id
  const [classMap, setClassMap]       = useState<Record<string, SchoolClass[]>>({});   // keyed by series_id
  const [loading, setLoading]         = useState(true);
  const [expandedSeg, setExpandedSeg] = useState<Set<string>>(new Set());
  const [expandedSer, setExpandedSer] = useState<Set<string>>(new Set());
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);

  // Segment editing
  const [editSegId, setEditSegId]   = useState<string | null>(null);
  const [segForm, setSegForm]       = useState<SegmentForm>(emptySegmentForm());
  const [segState, setSegState]     = useState<SaveState>('idle');

  // Series editing
  const [editSeriesSegId, setEditSeriesSegId] = useState<string | null>(null);
  const [editSeriesId, setEditSeriesId]       = useState<string | null>(null);
  const [seriesForm, setSeriesForm]           = useState<SeriesForm>(emptySeriesForm());
  const [seriesState, setSeriesState]         = useState<SaveState>('idle');

  // Class editing
  const [editClassSegId, setEditClassSegId]       = useState<string | null>(null);
  const [editClassSeriesId, setEditClassSeriesId] = useState<string | null>(null);
  const [editClassId, setEditClassId]             = useState<string | null>(null);
  const [classForm, setClassForm]                 = useState<ClassForm>(emptyClassForm());
  const [classState, setClassState]               = useState<SaveState>('idle');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: segs }, { data: series }, { data: classes }, { data: staff }] = await Promise.all([
      supabase.from('school_segments').select('*').order('position'),
      supabase.from('school_series').select('*').order('order_index'),
      supabase.from('school_classes').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, role').in('role', ['coordinator', 'teacher', 'admin', 'super_admin']).eq('is_active', true).order('full_name'),
    ]);
    setSegments((segs ?? []) as SchoolSegment[]);
    setStaffProfiles((staff ?? []) as StaffProfile[]);

    const sMap: Record<string, SchoolSeries[]> = {};
    ((series ?? []) as SchoolSeries[]).forEach((s) => {
      (sMap[s.segment_id] ??= []).push(s);
    });
    setSeriesMap(sMap);

    const cMap: Record<string, SchoolClass[]> = {};
    ((classes ?? []) as SchoolClass[]).forEach((c) => {
      (cMap[c.series_id] ??= []).push(c);
    });
    setClassMap(cMap);

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function toggleSeg(id: string) {
    setExpandedSeg((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSer(id: string) {
    setExpandedSer((prev) => {
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
    setSegState('saving');
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
      logAudit({ action: 'create', module: 'segments', description: `Segmento "${payload.name}" criado`, newData: payload });
    } else {
      await supabase.from('school_segments').update(payload).eq('id', editSegId);
      logAudit({ action: 'update', module: 'segments', recordId: editSegId!, description: `Segmento "${payload.name}" atualizado`, newData: payload });
    }
    setSegState('saved');
    await fetchAll();
    setTimeout(() => { setEditSegId(null); setSegState('idle'); }, 900);
  }
  async function deleteSegment(id: string) {
    await supabase.from('school_segments').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'segments', recordId: id, description: 'Segmento excluído' });
    await fetchAll();
  }

  // ── Series CRUD ─────────────────────────────────────────────────────────────
  function startNewSeries(segmentId: string) {
    const form = emptySeriesForm();
    form.order_index = (seriesMap[segmentId]?.length ?? 0) + 1;
    setSeriesForm(form);
    setEditSeriesSegId(segmentId);
    setEditSeriesId('new');
    setExpandedSeg((prev) => new Set(prev).add(segmentId));
  }
  function startEditSeries(s: SchoolSeries) {
    setSeriesForm({
      name: s.name,
      short_name: s.short_name ?? '',
      order_index: s.order_index,
      is_active: s.is_active,
    });
    setEditSeriesSegId(s.segment_id);
    setEditSeriesId(s.id);
  }
  async function saveSeries() {
    setSeriesState('saving');
    const payload = {
      segment_id: editSeriesSegId!,
      name: seriesForm.name,
      short_name: seriesForm.short_name || null,
      order_index: seriesForm.order_index,
      is_active: seriesForm.is_active,
      updated_at: new Date().toISOString(),
    };
    if (editSeriesId === 'new') {
      await supabase.from('school_series').insert(payload);
      logAudit({ action: 'create', module: 'segments', description: `Série "${payload.name}" criada`, newData: payload as Record<string, unknown> });
    } else {
      await supabase.from('school_series').update(payload).eq('id', editSeriesId);
      logAudit({ action: 'update', module: 'segments', recordId: editSeriesId!, description: `Série "${payload.name}" atualizada`, newData: payload as Record<string, unknown> });
    }
    setSeriesState('saved');
    await fetchAll();
    setTimeout(() => {
      setEditSeriesId(null);
      setEditSeriesSegId(null);
      setSeriesState('idle');
    }, 900);
  }
  async function deleteSeries(id: string) {
    await supabase.from('school_series').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'segments', recordId: id, description: 'Série excluída' });
    await fetchAll();
  }

  // ── Class CRUD ──────────────────────────────────────────────────────────────
  function startNewClass(segmentId: string, seriesId: string) {
    setClassForm(emptyClassForm());
    setEditClassSegId(segmentId);
    setEditClassSeriesId(seriesId);
    setEditClassId('new');
    setExpandedSer((prev) => new Set(prev).add(seriesId));
  }
  function startEditClass(c: SchoolClass) {
    setClassForm({
      name: c.name,
      school_year: c.school_year,
      shift: (c.shift ?? 'morning') as Shift,
      max_students: c.max_students?.toString() ?? '',
      is_active: c.is_active,
      teacher_ids: c.teacher_ids ?? [],
    });
    setEditClassSegId(c.segment_id);
    setEditClassSeriesId(c.series_id);
    setEditClassId(c.id);
  }
  async function saveClass() {
    setClassState('saving');
    const payload = {
      segment_id: editClassSegId!,
      series_id: editClassSeriesId!,
      name: classForm.name,
      school_year: classForm.school_year,
      shift: classForm.shift,
      max_students: classForm.max_students ? parseInt(classForm.max_students) : null,
      is_active: classForm.is_active,
      teacher_ids: classForm.teacher_ids,
      updated_at: new Date().toISOString(),
    };
    if (editClassId === 'new') {
      await supabase.from('school_classes').insert(payload);
      logAudit({ action: 'create', module: 'segments', description: `Turma "${payload.name}" criada`, newData: payload as Record<string, unknown> });
    } else {
      await supabase.from('school_classes').update(payload).eq('id', editClassId);
      logAudit({ action: 'update', module: 'segments', recordId: editClassId!, description: `Turma "${payload.name}" atualizada`, newData: payload as Record<string, unknown> });
    }
    setClassState('saved');
    await fetchAll();
    setTimeout(() => {
      setEditClassId(null);
      setEditClassSegId(null);
      setEditClassSeriesId(null);
      setClassState('idle');
    }, 900);
  }
  async function deleteClass(id: string) {
    await supabase.from('school_classes').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'segments', recordId: id, description: 'Turma excluída' });
    await fetchAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex justify-end mb-6">
        <button
          onClick={startNewSegment}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-[#002a5c] transition-colors"
        >
          <GraduationCap className="w-4 h-4" /> Novo Segmento
        </button>
      </div>

      {/* Segments */}
      <div className="space-y-3">
        {segments.map((seg) => {
          const isOpen = expandedSeg.has(seg.id);
          const seriesList = seriesMap[seg.id] ?? [];
          const totalClasses = seriesList.reduce(
            (acc, s) => acc + (classMap[s.id]?.filter((c) => c.is_active).length ?? 0),
            0,
          );

          return (
            <div key={seg.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* Segment header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleSeg(seg.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSeg(seg.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
              >
                {isOpen
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
                  <Layers className="w-3.5 h-3.5" />
                  {seriesList.length} série{seriesList.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                  <Users className="w-3.5 h-3.5" />
                  {totalClasses} turma{totalClasses !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => startEditSegment(seg)}
                    className="p-1.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Editar segmento"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => startNewSeries(seg.id)}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Adicionar série"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  {seriesList.length === 0 && (
                    <button
                      onClick={() => deleteSegment(seg.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Excluir segmento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Series list */}
              {isOpen && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {seriesList.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-xs">
                      Nenhuma série cadastrada.{' '}
                      <button onClick={() => startNewSeries(seg.id)} className="text-brand-primary dark:text-brand-secondary hover:underline">
                        Adicionar série
                      </button>
                    </div>
                  )}
                  {seriesList.map((ser) => {
                    const isSerOpen = expandedSer.has(ser.id);
                    const classes = classMap[ser.id] ?? [];
                    const activeCount = classes.filter((c) => c.is_active).length;
                    return (
                      <div key={ser.id} className="border-t border-gray-50 dark:border-gray-700/50 first:border-t-0">
                        <button
                          onClick={() => toggleSer(ser.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 pl-10 text-left hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                        >
                          {isSerOpen
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                          <Layers className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${ser.is_active ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 line-through'}`}>
                              {ser.name}
                            </span>
                            {ser.short_name && (
                              <span className="text-xs text-gray-400 ml-2">({ser.short_name})</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                            <Users className="w-3 h-3" />
                            {activeCount}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => startEditSeries(ser)}
                              className="p-1.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Editar série"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => startNewClass(seg.id, ser.id)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Adicionar turma"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            {classes.length === 0 && (
                              <button
                                onClick={() => deleteSeries(ser.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Excluir série"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </button>

                        {isSerOpen && (
                          <div className="bg-gray-50/50 dark:bg-gray-900/30">
                            {classes.length === 0 && (
                              <div className="text-center py-4 text-gray-400 text-xs">
                                Nenhuma turma.{' '}
                                <button onClick={() => startNewClass(seg.id, ser.id)} className="text-brand-primary dark:text-brand-secondary hover:underline">
                                  Adicionar turma
                                </button>
                              </div>
                            )}
                            {classes.map((cls) => (
                              <div
                                key={cls.id}
                                className="flex items-center gap-3 px-4 py-2.5 pl-16 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
                              >
                                <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm font-medium ${cls.is_active ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 line-through'}`}>
                                    {cls.name}
                                  </span>
                                  <span className="text-xs text-gray-400 ml-2">
                                    {cls.school_year} · {SHIFT_LABELS[cls.shift as Shift] ?? cls.shift}
                                    {cls.max_students != null && ` · Máx ${cls.max_students}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => startEditClass(cls)}
                                    className="p-1.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                </div>
              )}
            </div>
          );
        })}

        {segments.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum segmento cadastrado.</p>
            <button onClick={startNewSegment} className="mt-3 text-sm text-brand-primary dark:text-brand-secondary hover:underline">
              Cadastrar primeiro segmento
            </button>
          </div>
        )}
      </div>

      {/* Drawers */}
      {editSegId !== null && (
        <SegmentDrawer
          isNew={editSegId === 'new'}
          form={segForm}
          onChange={setSegForm}
          onSave={saveSegment}
          onCancel={() => setEditSegId(null)}
          state={segState}
          staffProfiles={staffProfiles}
        />
      )}

      {editSeriesId !== null && (
        <SeriesDrawer
          isNew={editSeriesId === 'new'}
          segmentName={segments.find((s) => s.id === editSeriesSegId)?.name ?? ''}
          form={seriesForm}
          onChange={setSeriesForm}
          onSave={saveSeries}
          onCancel={() => { setEditSeriesId(null); setEditSeriesSegId(null); }}
          state={seriesState}
        />
      )}

      {editClassId !== null && (
        <ClassDrawer
          isNew={editClassId === 'new'}
          segmentName={segments.find((s) => s.id === editClassSegId)?.name ?? ''}
          seriesName={seriesMap[editClassSegId ?? '']?.find((s) => s.id === editClassSeriesId)?.name ?? ''}
          form={classForm}
          onChange={setClassForm}
          onSave={saveClass}
          onCancel={() => { setEditClassId(null); setEditClassSegId(null); setEditClassSeriesId(null); }}
          state={classState}
          staffProfiles={staffProfiles}
        />
      )}
    </div>
  );
}

// ── Shared input styles ───────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

// ── PrimaryButton (3-state: idle / saving / saved) ───────────────────────────
function PrimaryButton({ state, disabled, icon: Icon, label, onClick }: {
  state: SaveState;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  const isSaved = state === 'saved';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state !== 'idle'}
      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-white ${
        isSaved ? 'bg-emerald-500 hover:bg-emerald-500' : 'bg-brand-primary hover:bg-brand-primary-dark'
      }`}
    >
      {state === 'saving' && <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</>}
      {state === 'saved'  && <><Check className="w-4 h-4" />Salvo!</>}
      {state === 'idle'   && <><Icon className="w-4 h-4" />{label}</>}
    </button>
  );
}

// ── Segment Drawer ────────────────────────────────────────────────────────────
function SegmentDrawer({ isNew, form, onChange, onSave, onCancel, state, staffProfiles }: {
  isNew: boolean;
  form: SegmentForm;
  onChange: (f: SegmentForm) => void;
  onSave: () => void;
  onCancel: () => void;
  state: SaveState;
  staffProfiles: StaffProfile[];
}) {
  const coordinators = staffProfiles.filter((p) => ['coordinator', 'admin', 'super_admin'].includes(p.role));
  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onCancel} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            <h2 className="font-semibold text-sm">{isNew ? 'Novo Segmento' : 'Editar Segmento'}</h2>
          </div>
          <button onClick={onCancel} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

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
                          ? 'bg-brand-primary text-white'
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

        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <PrimaryButton state={state} disabled={!form.name} icon={GraduationCap} label="Salvar segmento" onClick={onSave} />
        </div>
      </aside>
    </>
  );
}

// ── Series Drawer ─────────────────────────────────────────────────────────────
function SeriesDrawer({ isNew, segmentName, form, onChange, onSave, onCancel, state }: {
  isNew: boolean;
  segmentName: string;
  form: SeriesForm;
  onChange: (f: SeriesForm) => void;
  onSave: () => void;
  onCancel: () => void;
  state: SaveState;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onCancel} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <div>
              <h2 className="font-semibold text-sm">{isNew ? 'Nova Série' : 'Editar Série'}</h2>
              {segmentName && <p className="text-[11px] text-white/60">{segmentName}</p>}
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <SettingsCard title="Identificação">
            <div>
              <label className={labelCls}>Nome</label>
              <input
                type="text" value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                className={inputCls} placeholder="Ex: 1º Ano"
              />
              <p className="text-[11px] text-gray-400 mt-1">A série é permanente — atravessa anos letivos.</p>
            </div>
            <div>
              <label className={labelCls}>Sigla (opcional)</label>
              <input
                type="text" value={form.short_name}
                onChange={(e) => onChange({ ...form, short_name: e.target.value })}
                className={inputCls} placeholder="Ex: 1A"
              />
            </div>
            <div>
              <label className={labelCls}>Ordem</label>
              <input
                type="number" value={form.order_index}
                onChange={(e) => onChange({ ...form, order_index: parseInt(e.target.value) || 0 })}
                className={inputCls}
              />
              <p className="text-[11px] text-gray-400 mt-1">Define a sequência de progressão (1º → 2º → 3º…).</p>
            </div>
          </SettingsCard>

          <SettingsCard title="Status">
            <Toggle
              checked={form.is_active}
              onChange={(v) => onChange({ ...form, is_active: v })}
              label={form.is_active ? 'Série ativa' : 'Série inativa'}
              description={form.is_active ? 'Visível no sistema' : 'Oculta no sistema'}
              onColor="bg-emerald-500"
            />
          </SettingsCard>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <PrimaryButton state={state} disabled={!form.name} icon={Layers} label="Salvar série" onClick={onSave} />
        </div>
      </aside>
    </>
  );
}

// ── Class Drawer ──────────────────────────────────────────────────────────────
function ClassDrawer({ isNew, segmentName, seriesName, form, onChange, onSave, onCancel, state, staffProfiles }: {
  isNew: boolean;
  segmentName: string;
  seriesName: string;
  form: ClassForm;
  onChange: (f: ClassForm) => void;
  onSave: () => void;
  onCancel: () => void;
  state: SaveState;
  staffProfiles: StaffProfile[];
}) {
  const teachers = staffProfiles.filter((p) => ['teacher', 'coordinator', 'admin', 'super_admin'].includes(p.role));
  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onCancel} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <div>
              <h2 className="font-semibold text-sm">{isNew ? 'Nova Turma' : 'Editar Turma'}</h2>
              {(segmentName || seriesName) && (
                <p className="text-[11px] text-white/60">
                  {segmentName}{seriesName ? ` → ${seriesName}` : ''}
                </p>
              )}
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <SettingsCard title="Identificação">
            <div>
              <label className={labelCls}>Nome da turma</label>
              <input
                type="text" value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                className={inputCls} placeholder="A"
              />
              <p className="text-[11px] text-gray-400 mt-1">Apenas o identificador da turma (ex.: A, B, Manhã).</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ano letivo</label>
                <input
                  type="number" value={form.school_year}
                  onChange={(e) => onChange({ ...form, school_year: parseInt(e.target.value) || 2026 })}
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
                          ? 'bg-brand-primary text-white'
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

        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <PrimaryButton state={state} disabled={!form.name} icon={BookOpen} label="Salvar turma" onClick={onSave} />
        </div>
      </aside>
    </>
  );
}
