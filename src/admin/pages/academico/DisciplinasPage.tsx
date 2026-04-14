import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type { Discipline, ClassDiscipline } from '../../types/admin.types';
import {
  BookOpen, Loader2, Pencil, Eye, EyeOff, Tag, Clock, Layers,
  ChevronDown, ChevronRight, Trash2,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { Toggle } from '../../components/Toggle';

// ── Types ────────────────────────────────────────────────────────────────────

interface Segment { id: string; name: string; }
interface SchoolClassOption { id: string; name: string; segment_id: string; segment_name?: string; }
interface TeacherOption { id: string; full_name: string; }

interface DisciplineForm {
  name: string;
  code: string;
  color: string;
  weekly_hours: number;
  segment_ids: string[];
  is_active: boolean;
}

const emptyForm = (): DisciplineForm => ({
  name: '', code: '', color: '#3B82F6', weekly_hours: 4, segment_ids: [], is_active: true,
});

const PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  '#84CC16', '#A855F7',
];

// ── Shared styles ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

// ── Main Page ────────────────────────────────────────────────────────────────

export default function DisciplinasPage() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [segments, setSegments]       = useState<Segment[]>([]);
  const [loading, setLoading]         = useState(true);

  // Drawer
  const [editId, setEditId]     = useState<string | null>(null); // null=closed, 'new'=create, uuid=edit
  const [form, setForm]         = useState<DisciplineForm>(emptyForm());
  const [saving, setSaving]     = useState(false);

  // Class disciplines section
  const [classesOpen, setClassesOpen]           = useState(false);
  const [classes, setClasses]                   = useState<SchoolClassOption[]>([]);
  const [teachers, setTeachers]                 = useState<TeacherOption[]>([]);
  const [selectedClassId, setSelectedClassId]   = useState('');
  const [classDisciplines, setClassDisciplines] = useState<ClassDiscipline[]>([]);
  const [loadingCD, setLoadingCD]               = useState(false);

  // ── Fetch disciplines + segments ─────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: discs }, { data: segs }] = await Promise.all([
        supabase.from('disciplines').select('*').order('name'),
        supabase.from('school_segments').select('id, name').eq('is_active', true).order('name'),
      ]);
      setDisciplines((discs ?? []) as Discipline[]);
      setSegments((segs ?? []) as Segment[]);
    } catch (err) {
      console.error('[DisciplinasPage] fetch error:', err);
      console.error('Erro ao carregar disciplinas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fetch classes + teachers (lazy, on section open) ─────────────────────

  const fetchClassesAndTeachers = useCallback(async () => {
    const [{ data: cls }, { data: tch }] = await Promise.all([
      supabase.from('school_classes').select('id, name, segment_id').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, full_name').in('role', ['teacher', 'coordinator']).eq('is_active', true).order('full_name'),
    ]);

    // Enrich classes with segment name
    const segMap = new Map(segments.map((s) => [s.id, s.name]));
    const enriched = ((cls ?? []) as SchoolClassOption[]).map((c) => ({
      ...c,
      segment_name: segMap.get(c.segment_id) ?? '',
    }));
    setClasses(enriched);
    setTeachers((tch ?? []) as TeacherOption[]);
  }, [segments]);

  useEffect(() => {
    if (classesOpen && classes.length === 0) {
      fetchClassesAndTeachers();
    }
  }, [classesOpen, classes.length, fetchClassesAndTeachers]);

  // ── Fetch class disciplines when class selected ──────────────────────────

  const fetchClassDisciplines = useCallback(async (classId: string) => {
    if (!classId) { setClassDisciplines([]); return; }
    setLoadingCD(true);
    try {
      const { data } = await supabase
        .from('class_disciplines')
        .select('*, discipline:disciplines(*), teacher:profiles(id, full_name, avatar_url)')
        .eq('class_id', classId);
      setClassDisciplines((data ?? []) as ClassDiscipline[]);
    } catch (err) {
      console.error('[DisciplinasPage] class_disciplines error:', err);
    } finally {
      setLoadingCD(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) fetchClassDisciplines(selectedClassId);
  }, [selectedClassId, fetchClassDisciplines]);

  // ── Discipline CRUD ──────────────────────────────────────────────────────

  function startNew() {
    setForm(emptyForm());
    setEditId('new');
  }

  function startEdit(d: Discipline) {
    setForm({
      name: d.name,
      code: d.code,
      color: d.color,
      weekly_hours: d.weekly_hours,
      segment_ids: d.segment_ids ?? [],
      is_active: d.is_active,
    });
    setEditId(d.id);
  }

  async function saveDiscipline() {
    if (!form.name.trim()) { console.error('Nome obrigatório.'); return; }
    if (!form.code.trim()) { console.error('Código obrigatório.'); return; }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      color: form.color,
      weekly_hours: form.weekly_hours,
      segment_ids: form.segment_ids,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editId === 'new') {
        const { data, error } = await supabase.from('disciplines').insert(payload).select('id').single();
        if (error) throw error;
        logAudit({ action: 'create', module: 'disciplines', recordId: data.id, description: `Disciplina "${payload.name}" criada`, newData: payload as Record<string, unknown> });
        console.log('Disciplina criada com sucesso.');
      } else {
        const { error } = await supabase.from('disciplines').update(payload).eq('id', editId!);
        if (error) throw error;
        logAudit({ action: 'update', module: 'disciplines', recordId: editId!, description: `Disciplina "${payload.name}" atualizada`, newData: payload as Record<string, unknown> });
        console.log('Disciplina atualizada.');
      }
      setEditId(null);
      await fetchData();
    } catch (err) {
      console.error('[DisciplinasPage] save error:', err);
      console.error('Erro ao salvar disciplina.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Discipline) {
    const next = !d.is_active;
    const { error } = await supabase.from('disciplines').update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', d.id);
    if (error) { console.error('Erro ao alterar status.'); return; }
    logAudit({ action: 'status_change', module: 'disciplines', recordId: d.id, description: `Disciplina "${d.name}" ${next ? 'ativada' : 'desativada'}` });
    console.log(next ? 'Disciplina ativada.' : 'Disciplina desativada.');
    await fetchData();
  }

  // ── Class discipline CRUD ────────────────────────────────────────────────

  async function addClassDiscipline(disciplineId: string) {
    if (!selectedClassId) return;
    const { error } = await supabase.from('class_disciplines').insert({
      class_id: selectedClassId,
      discipline_id: disciplineId,
      teacher_id: null,
    });
    if (error) {
      if (error.code === '23505') { console.error('Disciplina já atribuída a esta turma.'); return; }
      console.error('Erro ao adicionar disciplina.'); return;
    }
    logAudit({ action: 'create', module: 'class_disciplines', description: `Disciplina atribuída à turma` });
    console.log('Disciplina adicionada.');
    await fetchClassDisciplines(selectedClassId);
  }

  async function removeClassDiscipline(id: string) {
    const { error } = await supabase.from('class_disciplines').delete().eq('id', id);
    if (error) { console.error('Erro ao remover disciplina.'); return; }
    logAudit({ action: 'delete', module: 'class_disciplines', recordId: id, description: 'Disciplina removida da turma' });
    console.log('Disciplina removida.');
    await fetchClassDisciplines(selectedClassId);
  }

  async function updateTeacher(cdId: string, teacherId: string | null) {
    const { error } = await supabase.from('class_disciplines').update({ teacher_id: teacherId }).eq('id', cdId);
    if (error) { console.error('Erro ao atribuir professor.'); return; }
    logAudit({ action: 'update', module: 'class_disciplines', recordId: cdId, description: 'Professor atualizado' });
    console.log('Professor atualizado.');
    await fetchClassDisciplines(selectedClassId);
  }

  // ── Segment lookup helper ────────────────────────────────────────────────

  const segMap = new Map(segments.map((s) => [s.id, s.name]));

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  // Disciplines not yet assigned to the selected class
  const assignedIds = new Set(classDisciplines.map((cd) => cd.discipline_id));
  const unassignedDisciplines = disciplines.filter((d) => d.is_active && !assignedIds.has(d.id));

  return (
    <div className="space-y-6">
      {/* Header with action button */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-[#002a5c] transition-colors"
        >
          <BookOpen className="w-4 h-4" /> Nova Disciplina
        </button>
      </div>

      {/* Grid of discipline cards */}
      {disciplines.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhuma disciplina cadastrada.</p>
          <button onClick={startNew} className="mt-3 text-sm text-brand-primary dark:text-brand-secondary hover:underline">
            Cadastrar primeira disciplina
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {disciplines.map((d) => (
            <div
              key={d.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 transition-all hover:shadow-md ${
                !d.is_active ? 'opacity-60' : ''
              }`}
            >
              {/* Top row: color swatch + name + code */}
              <div className="flex items-start gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-white dark:ring-gray-800 shadow-sm"
                  style={{ backgroundColor: d.color || '#3B82F6' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{d.name}</h3>
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full font-mono">
                      {d.code}
                    </span>
                  </div>

                  {/* Weekly hours */}
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{d.weekly_hours}h/sem</span>
                  </div>

                  {/* Segment badges */}
                  {d.segment_ids && d.segment_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {d.segment_ids.map((sid) => (
                        <span
                          key={sid}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-brand-secondary font-medium"
                        >
                          {segMap.get(sid) ?? sid}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                <button
                  onClick={() => startEdit(d)}
                  className="p-1.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Editar disciplina"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toggleActive(d)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    d.is_active
                      ? 'text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                      : 'text-gray-400 hover:text-emerald-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={d.is_active ? 'Desativar' : 'Ativar'}
                >
                  {d.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Class Disciplines Section ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setClassesOpen(!classesOpen)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
        >
          {classesOpen
            ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <Layers className="w-4 h-4 text-brand-primary dark:text-brand-secondary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">Atribuição por Turma</span>
            <p className="text-xs text-gray-400 mt-0.5">Vincular disciplinas e professores a cada turma</p>
          </div>
        </button>

        {classesOpen && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 space-y-4">
            {/* Class selector */}
            <div>
              <label className={labelCls}>Selecionar turma</label>
              <div className="relative">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className={`${inputCls} appearance-none pr-9`}
                >
                  <option value="">-- Escolha uma turma --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.segment_name ? ` (${c.segment_name})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {selectedClassId && (
              <>
                {loadingCD ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Assigned disciplines table */}
                    {classDisciplines.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-700">
                              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Disciplina</th>
                              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Professor(a)</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {classDisciplines.map((cd) => (
                              <tr key={cd.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                <td className="py-2.5 px-2">
                                  <div className="flex items-center gap-2">
                                    {cd.discipline && (
                                      <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: cd.discipline.color || '#3B82F6' }}
                                      />
                                    )}
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                      {cd.discipline?.name ?? cd.discipline_id}
                                    </span>
                                    {cd.discipline?.code && (
                                      <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full font-mono">
                                        {cd.discipline.code}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-2">
                                  <div className="relative">
                                    <select
                                      value={cd.teacher_id || ''}
                                      onChange={(e) => updateTeacher(cd.id, e.target.value || null)}
                                      className={`${inputCls} appearance-none pr-9 max-w-xs`}
                                    >
                                      <option value="">-- Sem professor --</option>
                                      {teachers.map((t) => (
                                        <option key={t.id} value={t.id}>{t.full_name}</option>
                                      ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                  </div>
                                </td>
                                <td className="py-2.5 px-2">
                                  <button
                                    onClick={() => removeClassDiscipline(cd.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Remover da turma"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        Nenhuma disciplina atribuída a esta turma.
                      </div>
                    )}

                    {/* Add discipline dropdown */}
                    {unassignedDisciplines.length > 0 && (
                      <div>
                        <label className={labelCls}>Adicionar disciplina</label>
                        <div className="relative">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addClassDiscipline(e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className={`${inputCls} appearance-none pr-9`}
                          >
                            <option value="" disabled>-- Selecione uma disciplina --</option>
                            {unassignedDisciplines.map((d) => (
                              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Create/Edit Drawer ──────────────────────────────────────────────── */}
      <Drawer
        open={editId !== null}
        onClose={() => setEditId(null)}
        title={editId === 'new' ? 'Nova Disciplina' : 'Editar Disciplina'}
        icon={BookOpen}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEditId(null)}
              className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveDiscipline}
              disabled={!form.name || !form.code || saving}
              className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Salvar'}
            </button>
          </div>
        }
      >
        {/* Identification */}
        <DrawerCard title="Identificação" icon={Tag}>
          <div>
            <label className={labelCls}>Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
              placeholder="Ex: Matemática"
            />
          </div>
          <div>
            <label className={labelCls}>Código</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={inputCls}
              placeholder="MAT"
              maxLength={10}
            />
            <p className="text-[11px] text-gray-400 mt-1">Sigla curta (ex.: MAT, POR, HIS)</p>
          </div>
          <div>
            <label className={labelCls}>Cor</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-lg transition-all ${
                    form.color === c
                      ? 'ring-2 ring-offset-2 ring-brand-primary dark:ring-offset-gray-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
            />
          </div>
          <div>
            <label className={labelCls}>Carga horária semanal</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={40}
                value={form.weekly_hours}
                onChange={(e) => setForm({ ...form, weekly_hours: parseInt(e.target.value) || 1 })}
                className={`${inputCls} w-24`}
              />
              <span className="text-xs text-gray-400">horas/semana</span>
            </div>
          </div>
        </DrawerCard>

        {/* Segments */}
        <DrawerCard title="Segmentos" icon={Layers}>
          {segments.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum segmento ativo encontrado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {segments.map((s) => {
                const active = form.segment_ids.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? form.segment_ids.filter((id) => id !== s.id)
                        : [...form.segment_ids, s.id];
                      setForm({ ...form, segment_ids: next });
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      active
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </DrawerCard>

        {/* Status */}
        <DrawerCard title="Status" icon={Eye}>
          <Toggle
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
            label={form.is_active ? 'Disciplina ativa' : 'Disciplina inativa'}
            description={form.is_active ? 'Visível para atribuição' : 'Oculta no sistema'}
            onColor="bg-emerald-500"
          />
        </DrawerCard>
      </Drawer>
    </div>
  );
}
