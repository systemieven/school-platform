import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { SchoolClass, ClassSchedule, Discipline, ClassDiscipline } from '../../types/admin.types';
import { DAY_OF_WEEK_SHORT } from '../../types/admin.types';
import {
  CalendarClock, Check, Clock, AlertTriangle, Loader2, Save, Trash2,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../components/Drawer';

// ── Time slots ───────────────────────────────────────────────────────────────

interface TimeSlot {
  start: string;
  end: string;
  label: string;
  isBreak?: boolean;
}

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { start: '07:00', end: '07:50', label: '07:00 – 07:50' },
  { start: '07:50', end: '08:40', label: '07:50 – 08:40' },
  { start: '08:40', end: '09:00', label: 'Intervalo', isBreak: true },
  { start: '09:00', end: '09:50', label: '09:00 – 09:50' },
  { start: '09:50', end: '10:40', label: '09:50 – 10:40' },
  { start: '10:40', end: '11:30', label: '10:40 – 11:30' },
  { start: '11:30', end: '12:20', label: '11:30 – 12:20' },
];

const WEEKDAYS = [1, 2, 3, 4, 5]; // Seg-Sex

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GradeHorariaPage() {
  const [classes, setClasses] = useState<(SchoolClass & { segment_name?: string; series_name?: string })[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [classDisciplines, setClassDisciplines] = useState<ClassDiscipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDay, setDrawerDay] = useState<number>(1);
  const [drawerSlot, setDrawerSlot] = useState<TimeSlot | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [formDisciplineId, setFormDisciplineId] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);

  // ── Fetch classes ───────────────────────────────────────────────────────────
  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('school_classes')
      .select('*, segment:school_segments(name), series:school_series(name)')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Erro ao carregar turmas');
      setLoading(false);
      return;
    }
    const mapped = (data ?? []).map((c: any) => ({
      ...c,
      segment_name: c.segment?.name ?? '',
      series_name: c.series?.name ?? '',
    }));
    setClasses(mapped);
    setLoading(false);
  }, []);

  // ── Fetch schedule for selected class ───────────────────────────────────────
  const fetchSchedule = useCallback(async (classId: string) => {
    if (!classId) {
      setSchedules([]);
      return;
    }
    setLoadingSchedule(true);
    const { data, error } = await supabase
      .from('class_schedules')
      .select('*, discipline:disciplines(*), teacher:profiles(id, full_name)')
      .eq('class_id', classId);

    if (error) {
      console.error('Erro ao carregar grade horária');
    } else {
      setSchedules(data ?? []);
    }
    setLoadingSchedule(false);
  }, []);

  // ── Fetch disciplines + teachers ────────────────────────────────────────────
  const fetchDisciplines = useCallback(async () => {
    const { data } = await supabase
      .from('disciplines')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setDisciplines(data ?? []);
  }, []);

  const fetchTeachers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('full_name');
    setTeachers(data ?? []);
  }, []);

  const fetchClassDisciplines = useCallback(async (classId: string) => {
    if (!classId) {
      setClassDisciplines([]);
      return;
    }
    const { data } = await supabase
      .from('class_disciplines')
      .select('*, discipline:disciplines(*), teacher:profiles(id, full_name)')
      .eq('class_id', classId);
    setClassDisciplines(data ?? []);
  }, []);

  useEffect(() => {
    fetchClasses();
    fetchDisciplines();
    fetchTeachers();
  }, [fetchClasses, fetchDisciplines, fetchTeachers]);

  useEffect(() => {
    if (selectedClassId) {
      fetchSchedule(selectedClassId);
      fetchClassDisciplines(selectedClassId);
    } else {
      setSchedules([]);
      setClassDisciplines([]);
    }
  }, [selectedClassId, fetchSchedule, fetchClassDisciplines]);

  // ── Schedule lookup ─────────────────────────────────────────────────────────
  function findSchedule(day: number, slot: TimeSlot): ClassSchedule | undefined {
    return schedules.find(
      (s) =>
        s.day_of_week === day &&
        s.start_time.slice(0, 5) === slot.start &&
        s.end_time.slice(0, 5) === slot.end,
    );
  }

  // ── Open drawer ─────────────────────────────────────────────────────────────
  function openCell(day: number, slot: TimeSlot) {
    const existing = findSchedule(day, slot);
    setDrawerDay(day);
    setDrawerSlot(slot);
    setEditingSchedule(existing ?? null);
    setFormDisciplineId(existing?.discipline_id ?? '');
    setFormTeacherId(existing?.teacher_id ?? '');
    setDrawerOpen(true);
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedClassId || !drawerSlot) return;
    if (!formDisciplineId || !formTeacherId) {
      console.error('Selecione disciplina e professor');
      return;
    }

    setSaving(true);

    // Conflict detection
    const { data: conflicts } = await supabase
      .from('class_schedules')
      .select('id, class_id')
      .eq('teacher_id', formTeacherId)
      .eq('day_of_week', drawerDay)
      .eq('start_time', `${drawerSlot.start}:00`)
      .eq('end_time', `${drawerSlot.end}:00`)
      .neq('class_id', selectedClassId);

    if (conflicts && conflicts.length > 0) {
      console.error('Conflito: professor já possui aula em outra turma neste horário');
      setSaving(false);
      return;
    }

    const payload = {
      class_id: selectedClassId,
      discipline_id: formDisciplineId,
      teacher_id: formTeacherId,
      day_of_week: drawerDay,
      start_time: `${drawerSlot.start}:00`,
      end_time: `${drawerSlot.end}:00`,
    };

    let error;
    if (editingSchedule) {
      ({ error } = await supabase
        .from('class_schedules')
        .update(payload)
        .eq('id', editingSchedule.id));
    } else {
      ({ error } = await supabase.from('class_schedules').insert(payload));
    }

    if (error) {
      console.error('Erro ao salvar horário');
    } else {
      setSaved(true);
      fetchSchedule(selectedClassId);
      setTimeout(() => { setSaved(false); setDrawerOpen(false); }, 900);
    }
    setSaving(false);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!editingSchedule) return;
    setSaving(true);
    const { error } = await supabase
      .from('class_schedules')
      .delete()
      .eq('id', editingSchedule.id);

    if (error) {
      console.error('Erro ao remover horário');
    } else {
      console.log('Horário removido');
      setDrawerOpen(false);
      fetchSchedule(selectedClassId);
    }
    setSaving(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 w-72"
          >
            <option value="">Selecione uma turma</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.series_name ? `${c.series_name} ` : ''}{c.name} {c.school_year}{c.segment_name ? ` · ${c.segment_name}` : ''}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Empty state */}
      {!selectedClassId && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
          <CalendarClock className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Selecione uma turma para visualizar a grade horária</p>
        </div>
      )}

      {/* Loading schedule */}
      {selectedClassId && loadingSchedule && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* Schedule grid */}
      {selectedClassId && !loadingSchedule && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  Horário
                </th>
                {WEEKDAYS.map((d) => (
                  <th
                    key={d}
                    className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700"
                  >
                    {DAY_OF_WEEK_SHORT[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEFAULT_TIME_SLOTS.map((slot) => {
                if (slot.isBreak) {
                  return (
                    <tr key={slot.start}>
                      <td
                        colSpan={6}
                        className="px-3 py-1.5 text-center text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 italic"
                      >
                        {slot.label}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={slot.start}>
                    <td className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 font-medium whitespace-nowrap">
                      {slot.label}
                    </td>
                    {WEEKDAYS.map((day) => {
                      const sch = findSchedule(day, slot);
                      return (
                        <td
                          key={day}
                          onClick={() => openCell(day, slot)}
                          className="px-1 py-1 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-brand-primary/5 dark:hover:bg-brand-primary/10 transition-colors text-center"
                        >
                          {sch ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: sch.discipline?.color ?? '#6366f1' }}
                                />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                  {sch.discipline?.code?.slice(0, 3).toUpperCase() ?? '---'}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                {sch.teacher?.full_name ? getInitials(sch.teacher.full_name) : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingSchedule ? 'Editar Horário' : 'Novo Horário'}
        icon={CalendarClock}
        footer={
          <div className="flex items-center gap-2">
            {editingSchedule && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => { setSaved(false); setDrawerOpen(false); }}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" />
               : saved  ? <Check className="w-4 h-4" />
                        : <Save className="w-4 h-4" />}
              {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        }
      >
        <DrawerCard title="Detalhes" icon={Clock}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {drawerSlot ? `${DAY_OF_WEEK_SHORT[drawerDay]} — ${drawerSlot.label}` : ''}
          </p>

          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            Disciplina
          </label>
          <select
            value={formDisciplineId}
            onChange={(e) => {
              setFormDisciplineId(e.target.value);
              // Auto-fill teacher if class_discipline has it
              const cd = classDisciplines.find((x) => x.discipline_id === e.target.value);
              if (cd) setFormTeacherId(cd.teacher_id);
            }}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 mb-3"
          >
            <option value="">Selecione</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            Professor
          </label>
          <select
            value={formTeacherId}
            onChange={(e) => setFormTeacherId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="">Selecione</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </DrawerCard>

        {editingSchedule && (
          <div className="flex items-center gap-2 px-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Alterar aqui não remove a atribuição na aba Disciplinas.</span>
          </div>
        )}
      </Drawer>
    </div>
  );
}
