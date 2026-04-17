import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Search, ChevronLeft, ChevronRight,
  Loader2, Check, Eye, Pencil, ShieldAlert, Filter,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { SelectDropdown } from '../../components/FormField';
import type {
  StudentOccurrence, OccurrenceType, OccurrenceSeverity, OccurrenceStatus,
} from '../../types/admin.types';
import {
  OCCURRENCE_TYPE_LABELS, OCCURRENCE_SEVERITY_LABELS, OCCURRENCE_STATUS_LABELS,
} from '../../types/admin.types';

// ── Colour maps (static objects — no dynamic class construction) ──────────────

const SEVERITY_CLASSES: Record<OccurrenceSeverity, string> = {
  info:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  warning:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const TYPE_CLASSES: Record<OccurrenceType, string> = {
  behavioral:            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  academic:              'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  health:                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  administrative:        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  commendation:          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  absence_justification: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const STATUS_CLASSES: Record<OccurrenceStatus, string> = {
  open:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  read:     'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolClass { id: string; name: string; }
interface StudentOption { id: string; full_name: string; class_id: string | null; class_name?: string; }

interface OccurrenceRow extends StudentOccurrence {
  student?: { id: string; full_name: string } | null;
  class?: { id: string; name: string } | null;
  creator?: { id: string; full_name: string } | null;
}

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  student_id: '',
  class_id: null as string | null,
  type: 'behavioral' as OccurrenceType,
  severity: 'info' as OccurrenceSeverity,
  title: '',
  occurrence_date: new Date().toISOString().slice(0, 10),
  description: '',
  visible_to_guardian: false,
  status: 'open' as OccurrenceStatus,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function OcorrenciasPage() {
  // List state
  const [rows, setRows] = useState<OccurrenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchStudent, setSearchStudent] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Reference data
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OccurrenceRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<OccurrenceRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Reference data ──
  useEffect(() => {
    supabase.from('school_classes').select('id, name').order('name').then(({ data }) => {
      if (data) setClasses(data);
    });
    supabase.from('students')
      .select('id, full_name, class_id, school_classes(name)')
      .order('full_name')
      .then(({ data }) => {
        if (data) {
          setStudents(data.map((s: any) => ({
            id: s.id,
            full_name: s.full_name,
            class_id: s.class_id,
            class_name: s.school_classes?.name ?? undefined,
          })));
        }
      });
  }, []);

  // ── Fetch list ──
  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('student_occurrences')
      .select(
        `*, student:students(id,full_name), class:school_classes(id,name), creator:profiles!created_by(id,full_name)`,
        { count: 'exact' },
      )
      .order('occurrence_date', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterClass)    q = q.eq('class_id', filterClass);
    if (filterType)     q = q.eq('type', filterType);
    if (filterSeverity) q = q.eq('severity', filterSeverity);
    if (filterStatus)   q = q.eq('status', filterStatus);
    if (filterFrom)     q = q.gte('occurrence_date', filterFrom);
    if (filterTo)       q = q.lte('occurrence_date', filterTo);

    if (searchStudent.trim()) {
      // Filter by student name via the students table join
      const { data: matched } = await supabase
        .from('students')
        .select('id')
        .ilike('full_name', `%${searchStudent.trim()}%`);
      const ids = (matched ?? []).map((s: any) => s.id);
      if (ids.length === 0) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      q = q.in('student_id', ids);
    }

    const { data, count } = await q;
    setRows((data as OccurrenceRow[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, searchStudent, filterClass, filterType, filterSeverity, filterStatus, filterFrom, filterTo]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Drawer helpers ──
  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setStudentSearch('');
    setDrawerOpen(true);
  }

  function openEdit(row: OccurrenceRow) {
    setEditing(row);
    setForm({
      student_id: row.student_id,
      class_id: row.class_id ?? null,
      type: row.type,
      severity: row.severity,
      title: row.title,
      occurrence_date: row.occurrence_date,
      description: row.description,
      visible_to_guardian: row.visible_to_guardian,
      status: row.status,
    });
    setStudentSearch(row.student?.full_name ?? '');
    setDrawerOpen(true);
  }

  function openDetail(row: OccurrenceRow) {
    setDetailItem(row);
    setDetailOpen(true);
  }

  function handleStudentSelect(student: StudentOption) {
    setForm(f => ({ ...f, student_id: student.id, class_id: student.class_id ?? null }));
    setStudentSearch(student.full_name);
  }

  async function handleSave() {
    if (!form.student_id || !form.title.trim()) return;
    setSaving(true);
    const payload = {
      student_id: form.student_id,
      class_id: form.class_id,
      type: form.type,
      severity: form.severity,
      title: form.title.trim(),
      occurrence_date: form.occurrence_date,
      description: form.description.trim(),
      visible_to_guardian: form.visible_to_guardian,
      status: form.status,
    };

    if (editing) {
      await supabase.from('student_occurrences').update(payload).eq('id', editing.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('student_occurrences').insert({ ...payload, created_by: user?.id ?? null });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setDrawerOpen(false);
      fetchRows();
    }, 900);
  }

  const filteredStudents = students.filter(s =>
    studentSearch.trim() === '' ? false : s.full_name.toLowerCase().includes(studentSearch.toLowerCase())
  ).slice(0, 8);

  const canSave = !!form.student_id && form.title.trim().length > 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Ocorrências</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registro e acompanhamento de ocorrências de alunos
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          Nova ocorrência
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Search by student name */}
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchStudent}
              onChange={e => { setSearchStudent(e.target.value); setPage(0); }}
              placeholder="Buscar aluno…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>

          <select
            value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todas as turmas</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todos os tipos</option>
            {(Object.keys(OCCURRENCE_TYPE_LABELS) as OccurrenceType[]).map(k => (
              <option key={k} value={k}>{OCCURRENCE_TYPE_LABELS[k]}</option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={e => { setFilterSeverity(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Toda severidade</option>
            {(Object.keys(OCCURRENCE_SEVERITY_LABELS) as OccurrenceSeverity[]).map(k => (
              <option key={k} value={k}>{OCCURRENCE_SEVERITY_LABELS[k]}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todos os status</option>
            {(Object.keys(OCCURRENCE_STATUS_LABELS) as OccurrenceStatus[]).map(k => (
              <option key={k} value={k}>{OCCURRENCE_STATUS_LABELS[k]}</option>
            ))}
          </select>

          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
            placeholder="De"
            title="Data inicial"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
            placeholder="Até"
            title="Data final"
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
            <AlertTriangle className="w-10 h-10 text-gray-200 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma ocorrência encontrada</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Ajuste os filtros ou crie uma nova ocorrência</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Data', 'Aluno', 'Turma', 'Tipo', 'Severidade', 'Título', 'Status', 'Criado por', ''].map(h => (
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
                      {new Date(row.occurrence_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">
                      {row.student?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.class?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_CLASSES[row.type]}`}>
                        {OCCURRENCE_TYPE_LABELS[row.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_CLASSES[row.severity]}`}>
                        {OCCURRENCE_SEVERITY_LABELS[row.severity]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 max-w-[200px] truncate">
                      {row.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[row.status]}`}>
                        {OCCURRENCE_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.creator?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetail(row)}
                          className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(row)}
                          className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {total} ocorrência{total !== 1 ? 's' : ''} · página {page + 1} de {totalPages}
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

      {/* ── Create / Edit Drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar ocorrência' : 'Nova ocorrência'}
        icon={AlertTriangle}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setDrawerOpen(false)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
              }`}
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved
                  ? <Check className="w-4 h-4" />
                  : <ShieldAlert className="w-4 h-4" />}
              {saving ? 'Salvando…' : saved ? 'Salvo!' : editing ? 'Salvar alterações' : 'Criar ocorrência'}
            </button>
          </div>
        }
      >
        {/* Card 1 — Aluno */}
        <DrawerCard title="Aluno" icon={Search}>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Buscar aluno *</label>
            <div className="relative">
              <input
                value={studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setForm(f => ({ ...f, student_id: '', class_id: null })); }}
                placeholder="Digite o nome do aluno…"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
              {filteredStudents.length > 0 && !form.student_id && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg mt-1 overflow-hidden max-h-48 overflow-y-auto">
                  {filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleStudentSelect(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="font-medium text-gray-800 dark:text-white">{s.full_name}</span>
                      {s.class_name && (
                        <span className="ml-2 text-xs text-gray-400">{s.class_name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.class_id && (
              <p className="text-xs text-gray-400">
                Turma: {classes.find(c => c.id === form.class_id)?.name ?? form.class_id}
              </p>
            )}
          </div>
        </DrawerCard>

        {/* Card 2 — Ocorrência */}
        <DrawerCard title="Ocorrência" icon={AlertTriangle}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectDropdown label="Tipo *" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as OccurrenceType }))}>
                {(Object.keys(OCCURRENCE_TYPE_LABELS) as OccurrenceType[]).map(k => (
                  <option key={k} value={k}>{OCCURRENCE_TYPE_LABELS[k]}</option>
                ))}
              </SelectDropdown>
              <SelectDropdown label="Severidade *" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as OccurrenceSeverity }))}>
                {(Object.keys(OCCURRENCE_SEVERITY_LABELS) as OccurrenceSeverity[]).map(k => (
                  <option key={k} value={k}>{OCCURRENCE_SEVERITY_LABELS[k]}</option>
                ))}
              </SelectDropdown>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Título *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Título breve da ocorrência"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Data da ocorrência</label>
              <input
                type="date"
                value={form.occurrence_date}
                onChange={e => setForm(f => ({ ...f, occurrence_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
              />
            </div>
          </div>
        </DrawerCard>

        {/* Card 3 — Descrição */}
        <DrawerCard title="Descrição">
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={4}
            placeholder="Descreva a ocorrência com detalhes…"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
          />
        </DrawerCard>

        {/* Card 4 — Configurações */}
        <DrawerCard title="Configurações">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, visible_to_guardian: !f.visible_to_guardian }))}
                className={`relative w-9 h-5 rounded-full transition-colors ${form.visible_to_guardian ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.visible_to_guardian ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-200">Visível ao responsável</span>
            </label>

            {editing && (
              <SelectDropdown label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as OccurrenceStatus }))}>
                {(Object.keys(OCCURRENCE_STATUS_LABELS) as OccurrenceStatus[]).map(k => (
                  <option key={k} value={k}>{OCCURRENCE_STATUS_LABELS[k]}</option>
                ))}
              </SelectDropdown>
            )}
          </div>
        </DrawerCard>
      </Drawer>

      {/* ── Detail Drawer (read-only) ── */}
      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Detalhes da ocorrência"
        icon={Eye}
      >
        {detailItem && (
          <>
            <DrawerCard title="Identificação">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Aluno</span>
                  <span className="font-medium text-gray-800 dark:text-white">{detailItem.student?.full_name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Turma</span>
                  <span className="text-gray-700 dark:text-gray-200">{detailItem.class?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Data</span>
                  <span className="text-gray-700 dark:text-gray-200">{new Date(detailItem.occurrence_date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Criado por</span>
                  <span className="text-gray-700 dark:text-gray-200">{detailItem.creator?.full_name ?? '—'}</span>
                </div>
              </div>
            </DrawerCard>
            <DrawerCard title="Ocorrência">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_CLASSES[detailItem.type]}`}>
                    {OCCURRENCE_TYPE_LABELS[detailItem.type]}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_CLASSES[detailItem.severity]}`}>
                    {OCCURRENCE_SEVERITY_LABELS[detailItem.severity]}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[detailItem.status]}`}>
                    {OCCURRENCE_STATUS_LABELS[detailItem.status]}
                  </span>
                </div>
                <p className="font-semibold text-gray-800 dark:text-white">{detailItem.title}</p>
              </div>
            </DrawerCard>
            <DrawerCard title="Descrição">
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{detailItem.description || '—'}</p>
            </DrawerCard>
            {detailItem.guardian_response && (
              <DrawerCard title="Resposta do responsável">
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{detailItem.guardian_response}</p>
                {detailItem.guardian_responded_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    Em {new Date(detailItem.guardian_responded_at).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </DrawerCard>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
