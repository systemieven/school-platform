import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { StudentResult, StudentResultStatus, ClassDiscipline } from '../../types/admin.types';
import {
  RESULT_STATUS_LABELS,
  RESULT_STATUS_COLORS,
} from '../../types/admin.types';
import {
  Award, Loader2, Lock, Users, CheckCircle2, RefreshCw, XCircle, Filter,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface StudentRow {
  id: string;
  full_name: string;
  enrollment_number: string;
}

interface ClassOption {
  id: string;
  name: string;
  school_year: number;
  segment_name: string;
  series_name: string;
}

type FilterMode = 'all' | 'at_risk' | 'failed';

// ── Helpers ──────────────────────────────────────────────────────────────────

function overallStatus(
  studentId: string,
  disciplines: ClassDiscipline[],
  results: StudentResult[],
): StudentResultStatus {
  const studentResults = results.filter((r) => r.student_id === studentId);
  if (studentResults.length === 0) return 'in_progress';

  const statuses = disciplines.map((cd) => {
    const r = studentResults.find((sr) => sr.discipline_id === cd.discipline_id);
    return r?.result ?? 'in_progress';
  });

  if (statuses.some((s) => s === 'failed_grade' || s === 'failed_attendance')) return 'failed_grade';
  if (statuses.some((s) => s === 'recovery')) return 'recovery';
  if (statuses.every((s) => s === 'approved')) return 'approved';
  return 'in_progress';
}

function statusIcon(status: StudentResultStatus) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'recovery':
      return <RefreshCw className="w-4 h-4 text-amber-500" />;
    case 'failed_grade':
    case 'failed_attendance':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <span className="w-4 h-4 inline-block rounded-full bg-gray-300 dark:bg-gray-600" />;
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ResultadoFinalPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [disciplines, setDisciplines] = useState<ClassDiscipline[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [closing, setClosing] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');

  const schoolYear = new Date().getFullYear();

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('school_classes')
      .select('id, name, school_year, segment:school_segments(name), series:school_series(name)')
      .eq('is_active', true)
      .order('name');

    if (error) console.error('Erro ao carregar turmas');
    setClasses(
      (data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        school_year: c.school_year,
        segment_name: c.segment?.name ?? '',
        series_name: c.series?.name ?? '',
      })),
    );
    setLoading(false);
  }, []);

  const fetchData = useCallback(async (classId: string) => {
    if (!classId) {
      setStudents([]);
      setDisciplines([]);
      setResults([]);
      return;
    }
    setLoadingData(true);
    const [sRes, dRes, rRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, full_name, enrollment_number')
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('full_name'),
      supabase
        .from('class_disciplines')
        .select('*, discipline:disciplines(id, name, code, color)')
        .eq('class_id', classId),
      supabase
        .from('student_results')
        .select('*')
        .eq('class_id', classId)
        .eq('school_year', schoolYear),
    ]);

    setStudents(sRes.data ?? []);
    setDisciplines(dRes.data ?? []);
    setResults(rRes.data ?? []);
    setLoadingData(false);
  }, [schoolYear]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);
  useEffect(() => { if (selectedClassId) fetchData(selectedClassId); }, [selectedClassId, fetchData]);

  // ── KPI calculations ───────────────────────────────────────────────────────
  const studentStatuses = students.map((st) => ({
    ...st,
    status: overallStatus(st.id, disciplines, results),
  }));

  const approvedCount = studentStatuses.filter((s) => s.status === 'approved').length;
  const recoveryCount = studentStatuses.filter((s) => s.status === 'recovery').length;
  const failedCount = studentStatuses.filter(
    (s) => s.status === 'failed_grade' || s.status === 'failed_attendance',
  ).length;

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filteredStudents = studentStatuses.filter((s) => {
    if (filter === 'at_risk') return s.status === 'recovery';
    if (filter === 'failed') return s.status === 'failed_grade' || s.status === 'failed_attendance';
    return true;
  });

  // ── Close year ──────────────────────────────────────────────────────────────
  async function handleCloseYear() {
    if (!selectedClassId) return;
    setClosing(true);
    try {
      const { error } = await supabase.functions.invoke('calculate-grades', {
        body: { class_id: selectedClassId, school_year: schoolYear },
      });
      if (error) throw error;
      console.log('Resultado final calculado');
      fetchData(selectedClassId);
    } catch {
      console.error('Erro ao calcular resultado final');
    }
    setClosing(false);
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
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 w-64"
        >
          <option value="">Selecione uma turma</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.series_name ? `${c.series_name} ` : ''}{c.name} {c.school_year}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        {selectedClassId && (
          <button
            onClick={handleCloseYear}
            disabled={closing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Fechar Ano
          </button>
        )}
      </div>

      {/* Empty state */}
      {!selectedClassId && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
          <Award className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Selecione uma turma para ver o resultado final</p>
        </div>
      )}

      {selectedClassId && loadingData && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {selectedClassId && !loadingData && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Alunos', value: students.length, icon: Users, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800/50' },
              { label: 'Aprovados', value: approvedCount, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Recuperação', value: recoveryCount, icon: RefreshCw, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { label: 'Reprovados', value: failedCount, icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={`rounded-2xl border border-gray-100 dark:border-gray-700 p-4 ${kpi.bg}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{kpi.label}</span>
                </div>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            {(['all', 'at_risk', 'failed'] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  filter === f
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-brand-primary/50'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'at_risk' ? 'Em risco' : 'Reprovados'}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                    Aluno
                  </th>
                  {disciplines.map((cd) => (
                    <th
                      key={cd.id}
                      className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap"
                    >
                      {cd.discipline?.code ?? ''}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 && (
                  <tr>
                    <td
                      colSpan={disciplines.length + 2}
                      className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                    >
                      Nenhum aluno encontrado
                    </td>
                  </tr>
                )}
                {filteredStudents.map((st) => {
                  return (
                    <tr key={st.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                        {st.full_name}
                      </td>
                      {disciplines.map((cd) => {
                        const r = results.find(
                          (x) => x.student_id === st.id && x.discipline_id === cd.discipline_id,
                        );
                        const discStatus: StudentResultStatus = r?.result ?? 'in_progress';
                        return (
                          <td
                            key={cd.id}
                            className="px-3 py-2 text-center border-b border-gray-100 dark:border-gray-700"
                          >
                            <div className="flex items-center justify-center" title={RESULT_STATUS_LABELS[discStatus]}>
                              {statusIcon(discStatus)}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-center">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${RESULT_STATUS_COLORS[st.status]}`}>
                            {RESULT_STATUS_LABELS[st.status]}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
