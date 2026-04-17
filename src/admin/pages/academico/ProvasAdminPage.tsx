import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Filter, Loader2, Eye,
  ChevronLeft, ChevronRight, ListChecks, Check, BookOpen,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import type { ClassExam, ExamStatus, ExamQuestion, QuestionType } from '../../types/admin.types';

// ── Colour maps ───────────────────────────────────────────────────────────────

const EXAM_STATUS_CLASSES: Record<ExamStatus, string> = {
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  published: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  applied:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  corrected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  draft:     'Rascunho',
  published: 'Publicada',
  applied:   'Aplicada',
  corrected: 'Corrigida',
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  dissertativa:     'Dissertativa',
  multipla_escolha: 'Múltipla escolha',
  verdadeiro_falso: 'V / F',
  associacao:       'Associação',
};

const PERIOD_OPTIONS = [
  '1º Bimestre',
  '2º Bimestre',
  '3º Bimestre',
  '4º Bimestre',
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolClass   { id: string; name: string; }
interface TeacherOption { id: string; full_name: string; }
interface SubjectOption { id: string; name: string; }

interface ExamRow extends ClassExam {
  class?:       { id: string; name: string } | null;
  subject?:     { id: string; name: string } | null;
  teacher?:     { id: string; full_name: string } | null;
  discipline?:  { id: string; name: string } | null;
  discipline_id?: string | null;
  period?:      string | null;
  question_count?: number;
}

interface ScoreRow {
  student_id: string;
  full_name: string;
  score: string;
  feedback: string;
}

const PAGE_SIZE = 20;

function currentMonthRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  return { from, to };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProvasAdminPage() {
  const { profile } = useAdminAuth();

  // List state
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const { from: defaultFrom, to: defaultTo } = currentMonthRange();
  const [filterFrom, setFilterFrom] = useState(defaultFrom);
  const [filterTo, setFilterTo] = useState(defaultTo);

  // Reference data
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);

  // KPIs
  const [kpiByStatus, setKpiByStatus] = useState<Record<string, number>>({});

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ExamRow | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Score entry state
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

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
  }, []);

  // ── Fetch list ──
  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('class_exams')
      .select(
        `*, class:school_classes(id,name), subject:school_subjects(id,name), teacher:profiles!teacher_id(id,full_name), discipline:disciplines(id,name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterClass)   q = q.eq('class_id', filterClass);
    if (filterTeacher) q = q.eq('teacher_id', filterTeacher);
    if (filterSubject) q = q.eq('subject_id', filterSubject);
    if (filterStatus)  q = q.eq('status', filterStatus);
    if (filterFrom)    q = q.gte('exam_date', filterFrom);
    if (filterTo)      q = q.lte('exam_date', filterTo);

    const { data, count } = await q;
    const exams = (data ?? []) as ExamRow[];

    // Count questions per exam
    if (exams.length > 0) {
      const ids = exams.map(e => e.id);
      const { data: qData } = await supabase
        .from('exam_questions')
        .select('exam_id')
        .in('exam_id', ids);
      const counts: Record<string, number> = {};
      (qData ?? []).forEach((q: { exam_id: string }) => {
        counts[q.exam_id] = (counts[q.exam_id] ?? 0) + 1;
      });
      exams.forEach(e => { e.question_count = counts[e.id] ?? 0; });
    }

    setRows(exams);
    setTotal(count ?? 0);

    // KPI by status (this month)
    const { data: kpiData } = await supabase
      .from('class_exams')
      .select('status')
      .gte('created_at', `${defaultFrom}T00:00:00`)
      .lte('created_at', `${defaultTo}T23:59:59`);
    const byStatus: Record<string, number> = {};
    (kpiData ?? []).forEach((e: { status: string }) => {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    });
    setKpiByStatus(byStatus);

    setLoading(false);
  }, [page, filterClass, filterTeacher, filterSubject, filterStatus, filterFrom, filterTo, defaultFrom, defaultTo]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Detail ──
  async function openDetail(row: ExamRow) {
    setDetailItem(row);
    setDetailOpen(true);
    setSaveState('idle');
    setQuestionsLoading(true);

    const needsScores = row.status === 'applied' || row.status === 'corrected';
    const [{ data: qData }] = await Promise.all([
      supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', row.id)
        .order('block_number')
        .order('question_number'),
      needsScores ? loadScores(row) : Promise.resolve(),
    ]);
    setQuestions((qData as ExamQuestion[]) ?? []);
    setQuestionsLoading(false);
  }

  async function loadScores(exam: ExamRow) {
    setScoresLoading(true);

    const [enrollRes, resultsRes] = await Promise.all([
      supabase
        .from('student_class_enrollments')
        .select('student_id, students(id, full_name)')
        .eq('class_id', exam.class_id)
        .eq('status', 'active'),
      supabase
        .from('exam_results')
        .select('*')
        .eq('exam_id', exam.id),
    ]);

    const resultMap: Record<string, { score: number | null; feedback: string | null }> = {};
    ((resultsRes.data ?? []) as Array<{ student_id: string; score: number | null; feedback: string | null }>).forEach(r => {
      resultMap[r.student_id] = { score: r.score, feedback: r.feedback };
    });

    const rows: ScoreRow[] = ((enrollRes.data ?? []) as Array<{
      student_id: string;
      students: { id: string; full_name: string } | null;
    }>).map(e => ({
      student_id: e.student_id,
      full_name: e.students?.full_name ?? e.student_id,
      score: resultMap[e.student_id]?.score != null ? String(resultMap[e.student_id].score) : '',
      feedback: resultMap[e.student_id]?.feedback ?? '',
    }));

    setScores(rows);
    setScoresLoading(false);
  }

  async function saveScores() {
    if (!detailItem || !profile) return;
    setSaveState('saving');

    const now = new Date().toISOString();
    const examResultsPayload = scores
      .filter(s => s.score !== '')
      .map(s => ({
        exam_id: detailItem.id,
        student_id: s.student_id,
        score: parseFloat(s.score),
        feedback: s.feedback || null,
        graded_at: now,
        graded_by: profile.id,
        updated_at: now,
      }));

    const { error: examErr } = await supabase
      .from('exam_results')
      .upsert(examResultsPayload, { onConflict: 'exam_id,student_id' });

    if (examErr) {
      setSaveState('idle');
      console.error('Erro ao salvar notas:', examErr);
      return;
    }

    // Upsert to grades if discipline_id and period are set
    if (detailItem.discipline_id && detailItem.period) {
      const gradesPayload = scores
        .filter(s => s.score !== '')
        .map(s => ({
          class_id: detailItem.class_id,
          student_id: s.student_id,
          discipline_id: detailItem.discipline_id,
          period: detailItem.period,
          score: parseFloat(s.score),
          max_score: detailItem.total_score,
          subject: detailItem.title,
          created_by: profile.id,
          updated_at: now,
        }));

      const { error: gradesErr } = await supabase
        .from('grades')
        .upsert(gradesPayload, { onConflict: 'student_id,class_id,discipline_id,period' });

      if (gradesErr) {
        console.warn('Notas salvas em exam_results, mas não propagadas para grades:', gradesErr);
      }
    }

    // Update exam status to corrected
    await supabase
      .from('class_exams')
      .update({ status: 'corrected', updated_at: now })
      .eq('id', detailItem.id);

    // Update local state
    setDetailItem(prev => prev ? { ...prev, status: 'corrected' } : prev);
    setRows(prev => prev.map(r => r.id === detailItem.id ? { ...r, status: 'corrected' } : r));

    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 900);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const kpiTotal = Object.values(kpiByStatus).reduce((a, b) => a + b, 0);
  const canEnterScores = detailItem?.status === 'applied' || detailItem?.status === 'corrected';

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Provas</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Visão consolidada de todas as provas criadas pelos professores
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800 dark:text-white">{kpiTotal}</p>
              <p className="text-xs text-gray-400">Total este mês</p>
            </div>
          </div>
        </div>
        {(['draft', 'published', 'applied', 'corrected'] as ExamStatus[]).map(s => (
          <div key={s} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${EXAM_STATUS_CLASSES[s]}`}>
                {EXAM_STATUS_LABELS[s]}
              </span>
              <span className="text-xl font-bold text-gray-800 dark:text-white">{kpiByStatus[s] ?? 0}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todas as disciplinas</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="">Todos os status</option>
            {(['draft', 'published', 'applied', 'corrected'] as ExamStatus[]).map(k => (
              <option key={k} value={k}>{EXAM_STATUS_LABELS[k]}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(0); }}
            title="Data da prova — início"
            className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(0); }}
            title="Data da prova — fim"
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
            <ClipboardList className="w-10 h-10 text-gray-200 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma prova encontrada</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Ajuste os filtros ou aguarde os professores criarem provas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Título', 'Professor', 'Turma', 'Disciplina', 'Período', 'Data', 'Status', 'Questões', 'Pontuação', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white max-w-[180px] truncate">
                      {row.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {row.teacher?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {row.class?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.discipline?.name ?? row.subject?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.period ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {row.exam_date ? new Date(row.exam_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${EXAM_STATUS_CLASSES[row.status]}`}>
                        {EXAM_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-200">
                      {row.question_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-200">
                      {row.total_score ?? '—'}
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
              {total} prova{total !== 1 ? 's' : ''} · página {page + 1} de {totalPages}
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

      {/* ── Detail Drawer ── */}
      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Detalhes da prova"
        icon={ClipboardList}
        width="w-[600px]"
      >
        {detailItem && (
          <>
            <DrawerCard title="Informações">
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Título',      value: detailItem.title },
                  { label: 'Professor',   value: detailItem.teacher?.full_name },
                  { label: 'Turma',       value: detailItem.class?.name },
                  { label: 'Disciplina',  value: detailItem.discipline?.name ?? detailItem.subject?.name },
                  { label: 'Período',     value: detailItem.period },
                  { label: 'Data',        value: detailItem.exam_date ? new Date(detailItem.exam_date).toLocaleDateString('pt-BR') : '—' },
                  { label: 'Status',      value: EXAM_STATUS_LABELS[detailItem.status] },
                  { label: 'Pontuação',   value: detailItem.total_score != null ? String(detailItem.total_score) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="font-medium text-gray-800 dark:text-white">{value ?? '—'}</span>
                  </div>
                ))}
              </div>
            </DrawerCard>

            {detailItem.instructions && (
              <DrawerCard title="Instruções">
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{detailItem.instructions}</p>
              </DrawerCard>
            )}

            <DrawerCard title={`Questões (${questions.length})`} icon={ListChecks}>
              {questionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : questions.length === 0 ? (
                <div className="flex flex-col items-center py-6 gap-2">
                  <ListChecks className="w-8 h-8 text-gray-200 dark:text-gray-600" />
                  <p className="text-sm text-gray-400">Nenhuma questão cadastrada</p>
                </div>
              ) : (
                <div className="space-y-4 -mx-4">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <span className="text-xs font-semibold text-gray-400">Q{idx + 1}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {QUESTION_TYPE_LABELS[q.type]}
                          </span>
                          <span className="text-xs font-semibold text-brand-primary">{q.score} pt{q.score !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-200">{q.stem}</p>
                      {q.options && q.options.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {q.options.map(opt => (
                            <li key={opt.key} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-gray-400">{opt.key})</span>
                              <span>{opt.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DrawerCard>

            {/* ── Lançar Notas ── */}
            {canEnterScores && (
              <DrawerCard title="Lançar Notas" icon={BookOpen}>
                {scoresLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : scores.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Nenhum aluno matriculado nesta turma</p>
                ) : (
                  <>
                    <div className="overflow-x-auto -mx-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Aluno</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">
                              Nota {detailItem.total_score != null ? `(0–${detailItem.total_score})` : ''}
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Observação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                          {scores.map((s, idx) => (
                            <tr key={s.student_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{s.full_name}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={detailItem.total_score ?? undefined}
                                  step="0.01"
                                  value={s.score}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setScores(prev => prev.map((r, i) => i === idx ? { ...r, score: val } : r));
                                  }}
                                  className="w-24 py-1 px-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={s.feedback}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setScores(prev => prev.map((r, i) => i === idx ? { ...r, feedback: val } : r));
                                  }}
                                  className="w-full py-1 px-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                  placeholder="Opcional"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer buttons */}
                    <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => loadScores(detailItem)}
                        disabled={saveState === 'saving'}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveScores}
                        disabled={saveState === 'saving' || saveState === 'saved'}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-xl text-white transition-colors disabled:opacity-70 ${
                          saveState === 'saved'
                            ? 'bg-emerald-500'
                            : 'bg-brand-primary hover:bg-brand-primary/90'
                        }`}
                      >
                        {saveState === 'saving' ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
                        ) : saveState === 'saved' ? (
                          <><Check className="w-4 h-4" /> Salvo!</>
                        ) : (
                          <><BookOpen className="w-4 h-4" /> Salvar Notas</>
                        )}
                      </button>
                    </div>

                    {detailItem.discipline_id == null || detailItem.period == null ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Defina disciplina e período na prova para propagar notas automaticamente ao boletim.
                      </p>
                    ) : null}
                  </>
                )}
              </DrawerCard>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
