import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

import type { StudentResult, ClassDiscipline } from '../../types/admin.types';
import {
  FileText, Loader2, Lock,
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
  segment_name: string;
}

type PeriodKey = 'period1_avg' | 'period2_avg' | 'period3_avg' | 'period4_avg' | 'final_avg';

const PERIODS: { label: string; key: PeriodKey; number: number | null }[] = [
  { label: '1o Bimestre', key: 'period1_avg', number: 1 },
  { label: '2o Bimestre', key: 'period2_avg', number: 2 },
  { label: '3o Bimestre', key: 'period3_avg', number: 3 },
  { label: '4o Bimestre', key: 'period4_avg', number: 4 },
  { label: 'Final', key: 'final_avg', number: null },
];

const PASSING_GRADE = 7.0;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BoletimPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [disciplines, setDisciplines] = useState<ClassDiscipline[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [closing, setClosing] = useState(false);

  const currentPeriod = PERIODS[selectedPeriodIdx];
  const schoolYear = new Date().getFullYear();

  // ── Fetch classes ───────────────────────────────────────────────────────────
  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('school_classes')
      .select('id, name, segment:school_segments(name)')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Erro ao carregar turmas:', error);
    } else {
      setClasses(
        (data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          segment_name: c.segment?.name ?? '',
        })),
      );
    }
    setLoading(false);
  }, []);

  // ── Fetch data for selected class ───────────────────────────────────────────
  const fetchData = useCallback(async (classId: string) => {
    if (!classId) {
      setStudents([]);
      setDisciplines([]);
      setResults([]);
      return;
    }
    setLoadingData(true);

    const [studentsRes, discRes, resultsRes] = await Promise.all([
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

    if (studentsRes.error) console.error('Erro ao carregar alunos:', studentsRes.error);
    if (discRes.error) console.error('Erro ao carregar disciplinas:', discRes.error);
    if (resultsRes.error) console.error('Erro ao carregar resultados:', resultsRes.error);

    setStudents(studentsRes.data ?? []);
    setDisciplines(discRes.data ?? []);
    setResults(resultsRes.data ?? []);
    setLoadingData(false);
  }, [schoolYear]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClassId) fetchData(selectedClassId);
  }, [selectedClassId, fetchData]);

  // ── Lookup ──────────────────────────────────────────────────────────────────
  function getGrade(studentId: string, disciplineId: string): number | null {
    const r = results.find(
      (x) => x.student_id === studentId && x.discipline_id === disciplineId,
    );
    if (!r) return null;
    return r[currentPeriod.key] ?? null;
  }

  function gradeColor(val: number | null): string {
    if (val === null) return 'text-gray-300 dark:text-gray-600';
    if (val >= PASSING_GRADE) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-red-600 dark:text-red-400';
  }

  function gradeBg(val: number | null): string {
    if (val === null) return 'bg-gray-50 dark:bg-gray-800/50';
    if (val >= PASSING_GRADE) return 'bg-emerald-50/50 dark:bg-emerald-900/10';
    return 'bg-red-50/50 dark:bg-red-900/10';
  }

  // ── Close period ────────────────────────────────────────────────────────────
  async function handleClosePeriod() {
    if (!selectedClassId) return;
    setClosing(true);

    try {
      const body: Record<string, unknown> = {
        class_id: selectedClassId,
        school_year: schoolYear,
      };
      if (currentPeriod.number !== null) {
        body.period_number = currentPeriod.number;
      }

      const { error } = await supabase.functions.invoke('calculate-grades', { body });

      if (error) throw error;
      console.log('Notas calculadas com sucesso');
      fetchData(selectedClassId);
    } catch {
      console.error('Erro ao calcular notas');
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
      {/* Step selectors */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Class */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Turma</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 w-64"
          >
            <option value="">Selecione uma turma</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.segment_name ? `(${c.segment_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Period */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Período</label>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
            {PERIODS.map((p, i) => (
              <button
                key={p.key}
                onClick={() => setSelectedPeriodIdx(i)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  selectedPeriodIdx === i
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        {/* Close period */}
        {selectedClassId && (
          <button
            onClick={handleClosePeriod}
            disabled={closing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 self-end"
          >
            {closing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            Fechar Período
          </button>
        )}
      </div>

      {/* Empty state */}
      {!selectedClassId && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
          <FileText className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Selecione uma turma para visualizar o boletim</p>
        </div>
      )}

      {/* Loading */}
      {selectedClassId && loadingData && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* Grades table */}
      {selectedClassId && !loadingData && (
        <div className="overflow-x-auto">
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <FileText className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum aluno nesta turma</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10">
                    Aluno
                  </th>
                  {disciplines.map((cd) => (
                    <th
                      key={cd.id}
                      className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cd.discipline?.color ?? '#6366f1' }}
                        />
                        {cd.discipline?.code ?? ''}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10 whitespace-nowrap">
                      {st.full_name}
                    </td>
                    {disciplines.map((cd) => {
                      const grade = getGrade(st.id, cd.discipline_id);
                      return (
                        <td
                          key={cd.id}
                          className={`px-3 py-2 text-center text-sm font-semibold border-b border-gray-100 dark:border-gray-700 ${gradeColor(grade)} ${gradeBg(grade)}`}
                        >
                          {grade !== null ? grade.toFixed(1) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
