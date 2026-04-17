import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Filter, Loader2, Eye, AlertCircle, Users, CalendarDays,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import type {
  ClassDiaryEntry, DiaryAttendance, DiaryEntryType,
} from '../../types/admin.types';
import {
  DIARY_ENTRY_TYPE_LABELS, ATTENDANCE_STATUS_LABELS,
} from '../../types/admin.types';

// ── Colour maps ───────────────────────────────────────────────────────────────

const ATTENDANCE_CLASSES: Record<string, string> = {
  present:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  absent:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  justified: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  late:      'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolClass { id: string; name: string; }
interface TeacherOption { id: string; full_name: string; }
interface NamedOption { id: string; name: string; }

interface DiaryEntryRow extends ClassDiaryEntry {
  has_attendance?: boolean;
}

interface DiaryEntryDetail extends DiaryEntryRow {
  attendance?: (DiaryAttendance & { student?: { id: string; full_name: string } | null })[];
}

const PAGE_SIZE = 20;

// ── Helper ────────────────────────────────────────────────────────────────────

function currentMonthRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  return { from, to };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiarioAdminPage() {
  // List state
  const [rows, setRows] = useState<DiaryEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterDisciplineId, setFilterDisciplineId] = useState('');
  const [filterType, setFilterType] = useState('');
  const { from: defaultFrom, to: defaultTo } = currentMonthRange();
  const [filterFrom, setFilterFrom] = useState(defaultFrom);
  const [filterTo, setFilterTo] = useState(defaultTo);

  // Reference
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subjects, setSubjects] = useState<NamedOption[]>([]);
  const [disciplines, setDisciplines] = useState<NamedOption[]>([]);

  // KPIs
  const [kpiTotal, setKpiTotal] = useState(0);
  const [kpiNoAttendance, setKpiNoAttendance] = useState(0);
  const [kpiClassesWithLessonToday, setKpiClassesWithLessonToday] = useState(0);
  const [kpiTotalClasses, setKpiTotalClasses] = useState(0);

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<DiaryEntryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Reference data ──
  useEffect(() => {
    supabase.from('school_classes').select('id, name').order('name').then(({ data }) => {
      if (data) setClasses(data);
    });
    supabase.from('profiles').select('id, full_name').eq('role', 'teacher').order('full_name').then(({ data }) => {
      if (data) setTeachers(data);
    });
    supabase.from('school_subjects').select('id, name').order('name').then(({ data }) => {
      if (data) setSubjects(data);
    });
    supabase.from('disciplines').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setDisciplines(data);
    });
    supabase.from('school_classes').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setKpiTotalClasses(count ?? 0);
    });
  }, []);

  // ── Fetch list ──
  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('class_diary_entries')
      .select(
        `*, class:school_classes(id,name), subject:school_subjects(id,name), discipline:disciplines(id,name), teacher:profiles!teacher_id(id,full_name)`,
        { count: 'exact' },
      )
      .order('entry_date', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterClass)        q = q.eq('class_id', filterClass);
    if (filterTeacher)      q = q.eq('teacher_id', filterTeacher);
    if (filterSubject)      q = q.eq('subject_id', filterSubject);
    if (filterDisciplineId) q = q.eq('discipline_id', filterDisciplineId);
    if (filterType)         q = q.eq('type', filterType);
    if (filterFrom)         q = q.gte('entry_date', filterFrom);
    if (filterTo)           q = q.lte('entry_date', filterTo);

    const { data, count } = await q;
    const entries = (data ?? []) as DiaryEntryRow[];

    // Check which entries have attendance
    if (entries.length > 0) {
      const ids = entries.map(e => e.id);
      const { data: attData } = await supabase
        .from('diary_attendance')
        .select('diary_entry_id')
        .in('diary_entry_id', ids);
      const attSet = new Set((attData ?? []).map((a: any) => a.diary_entry_id));
      entries.forEach(e => { e.has_attendance = attSet.has(e.id); });
    }

    setRows(entries);
    setTotal(count ?? 0);

    // KPIs
    const { count: totalMonth } = await supabase
      .from('class_diary_entries')
      .select('*', { count: 'exact', head: true })
      .gte('entry_date', defaultFrom)
      .lte('entry_date', defaultTo);
    setKpiTotal(totalMonth ?? 0);

    const today = new Date().toISOString().slice(0, 10);
    const { data: todayEntries } = await supabase
      .from('class_diary_entries')
      .select('class_id')
      .eq('entry_date', today);
    const todayClasses = new Set((todayEntries ?? []).map((e: any) => e.class_id));
    setKpiClassesWithLessonToday(todayClasses.size);

    // Entries without attendance this month
    const { data: allMonthIds } = await supabase
      .from('class_diary_entries')
      .select('id')
      .gte('entry_date', defaultFrom)
      .lte('entry_date', defaultTo);
    const monthIds = (allMonthIds ?? []).map((e: any) => e.id);
    if (monthIds.length > 0) {
      const { data: monthAtt } = await supabase
        .from('diary_attendance')
        .select('diary_entry_id')
        .in('diary_entry_id', monthIds);
      const attIds = new Set((monthAtt ?? []).map((a: any) => a.diary_entry_id));
      setKpiNoAttendance(monthIds.filter(id => !attIds.has(id)).length);
    } else {
      setKpiNoAttendance(0);
    }

    setLoading(false);
  }, [page, filterClass, filterTeacher, filterSubject, filterDisciplineId, filterType, filterFrom, filterTo, defaultFrom, defaultTo]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Detail ──
  async function openDetail(row: DiaryEntryRow) {
    setDetailItem(row as DiaryEntryDetail);
    setDetailOpen(true);
    setDetailLoading(true);
    const { data } = await supabase
      .from('diary_attendance')
      .select('*, student:students(id,full_name)')
      .eq('diary_entry_id', row.id)
      .order('student(full_name)');
    setDetailItem({ ...row, attendance: (data ?? []) as any[] });
    setDetailLoading(false);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const todayPct = kpiTotalClasses > 0
    ? Math.round((kpiClassesWithLessonToday / kpiTotalClasses) * 100)
    : 0;

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Diário de Classe</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Visão consolidada das aulas registradas por todos os professores
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aulas este mês', value: kpiTotal, icon: BookOpen, color: 'text-brand-primary' },
          { label: 'Turmas com aula hoje', value: `${kpiClassesWithLessonToday} (${todayPct}%)`, icon: CalendarDays, color: 'text-green-600' },
          { label: 'Aulas sem presença', value: kpiNoAttendance, icon: AlertCircle, color: kpiNoAttendance > 0 ? 'text-amber-500' : 'text-gray-400' },
          { label: 'Total de turmas', value: kpiTotalClasses, icon: Users, color: 'text-purple-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-800 dark:text-white">{kpi.value}</p>
                <p className="text-xs text-gray-400 truncate">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <select
            value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todas as turmas</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterTeacher}
            onChange={e => { setFilterTeacher(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todos os professores</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <select
            value={filterDisciplineId}
            onChange={e => { setFilterDisciplineId(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todas as disciplinas</option>
            {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todos os assuntos</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todos os tipos</option>
            {(Object.keys(DIARY_ENTRY_TYPE_LABELS) as DiaryEntryType[]).map(k => (
              <option key={k} value={k}>{DIARY_ENTRY_TYPE_LABELS[k]}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(0); }}
            title="Data inicial"
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(0); }}
            title="Data final"
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          />
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
            <BookOpen className="w-10 h-10 text-gray-200 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma entrada de diário</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Ajuste os filtros ou aguarde os professores registrarem aulas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Data', 'Turma', 'Professor', 'Disciplina', 'Tipo', 'Conteúdo', 'Presença', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {new Date(row.entry_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                      {row.class?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                      {row.teacher?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.discipline?.name ?? row.subject?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary dark:text-brand-secondary">
                        {DIARY_ENTRY_TYPE_LABELS[row.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-gray-700 dark:text-gray-200">
                      {row.content}
                    </td>
                    <td className="px-4 py-3">
                      {row.has_attendance ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <Users className="w-3 h-3" /> Registrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          <AlertCircle className="w-3 h-3" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(row)}
                        className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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
              {total} entrada{total !== 1 ? 's' : ''} · página {page + 1} de {totalPages}
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

      {/* ── Detail Drawer (read-only) ── */}
      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Detalhes da aula"
        icon={BookOpen}
        width="w-[520px]"
      >
        {detailItem && (
          <>
            <DrawerCard title="Informações">
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Turma',       value: detailItem.class?.name },
                  { label: 'Professor',   value: detailItem.teacher?.full_name },
                  { label: 'Disciplina',  value: detailItem.discipline?.name ?? detailItem.subject?.name },
                  { label: 'Data',        value: new Date(detailItem.entry_date).toLocaleDateString('pt-BR') },
                  { label: 'Tipo',        value: DIARY_ENTRY_TYPE_LABELS[detailItem.type] },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="font-medium text-gray-800 dark:text-white">{value ?? '—'}</span>
                  </div>
                ))}
              </div>
            </DrawerCard>

            <DrawerCard title="Conteúdo">
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{detailItem.content || '—'}</p>
            </DrawerCard>

            {detailItem.objectives && (
              <DrawerCard title="Objetivos">
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{detailItem.objectives}</p>
              </DrawerCard>
            )}

            {detailItem.materials && (
              <DrawerCard title="Materiais">
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{detailItem.materials}</p>
              </DrawerCard>
            )}

            <DrawerCard title="Presença">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : !detailItem.attendance || detailItem.attendance.length === 0 ? (
                <div className="flex flex-col items-center py-6 gap-2">
                  <Users className="w-8 h-8 text-gray-200 dark:text-gray-600" />
                  <p className="text-sm text-gray-400">Presença não registrada</p>
                </div>
              ) : (
                <div className="space-y-1 -mx-4">
                  {detailItem.attendance.map(att => (
                    <div key={att.id} className="flex items-center justify-between px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{att.student?.full_name ?? att.student_id}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ATTENDANCE_CLASSES[att.status]}`}>
                        {ATTENDANCE_STATUS_LABELS[att.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}
