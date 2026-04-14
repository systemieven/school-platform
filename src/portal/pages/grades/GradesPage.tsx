import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { Loader2, Star, TrendingUp } from 'lucide-react';

interface Grade {
  id: string; subject: string; period: string; score: number; max_score: number;
  notes: string | null; activity?: { title: string } | null;
}

type ResultStatus = 'approved' | 'recovery' | 'failed_grade' | 'failed_attendance' | 'in_progress';

interface StudentResult {
  id: string;
  discipline: { name: string } | null;
  period1_avg: number | null;
  period2_avg: number | null;
  period3_avg: number | null;
  period4_avg: number | null;
  final_avg: number | null;
  attendance_pct: number | null;
  result: ResultStatus;
}

const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  approved: 'Aprovado',
  recovery: 'Recuperação',
  failed_grade: 'Reprovado (nota)',
  failed_attendance: 'Reprovado (falta)',
  in_progress: 'Em andamento',
};

const RESULT_STATUS_COLORS: Record<ResultStatus, string> = {
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  recovery: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  failed_grade: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  failed_attendance: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function GradesPage() {
  const { student } = useStudentAuth();
  const [grades,    setGrades]    = useState<Grade[]>([]);
  const [results,   setResults]   = useState<StudentResult[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState('');

  useEffect(() => {
    if (!student) { setLoading(false); return; }

    const gradesPromise = supabase.from('grades')
      .select('id, subject, period, score, max_score, notes, activity:activities(title)')
      .eq('student_id', student.id)
      .order('period').order('subject');

    const resultsPromise = supabase.from('student_results')
      .select('id, period1_avg, period2_avg, period3_avg, period4_avg, final_avg, attendance_pct, result, discipline:disciplines(name)')
      .eq('student_id', student.id)
      .order('discipline(name)');

    Promise.all([gradesPromise, resultsPromise]).then(([gradesRes, resultsRes]) => {
      const rows = (gradesRes.data ?? []) as unknown as Grade[];
      setGrades(rows);
      setResults((resultsRes.data ?? []) as unknown as StudentResult[]);
      const periods = [...new Set(rows.map((g) => g.period))];
      if (periods.length) setPeriod(periods[0]);
      setLoading(false);
    });
  }, [student]);

  const periods   = [...new Set(grades.map((g) => g.period))];
  const filtered  = period ? grades.filter((g) => g.period === period) : grades;
  const subjects  = [...new Set(filtered.map((g) => g.subject))];

  const avg = (list: Grade[]) => {
    if (!list.length) return null;
    return (list.reduce((s, g) => s + g.score, 0) / list.length).toFixed(1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Star className="w-5 h-5 text-brand-primary dark:text-brand-secondary" /> Notas
        </h1>
      </div>

      {periods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-brand-primary text-white dark:bg-brand-secondary dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-primary dark:text-brand-secondary" /></div>
      ) : !filtered.length ? (
        <div className="text-center py-12 text-gray-400">
          <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma nota registrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subjects.map((subj) => {
            const subGrades = filtered.filter((g) => g.subject === subj);
            const average   = avg(subGrades);
            const isOk      = average != null && parseFloat(average) >= 6;
            return (
              <div key={subj} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{subj}</p>
                  {average != null && (
                    <span className={`text-sm font-bold ${isOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      Média: {average}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {subGrades.map((g) => (
                    <div key={g.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {(g.activity as { title: string } | null)?.title ?? 'Avaliação'}
                        </p>
                        {g.notes && <p className="text-xs text-gray-400 mt-0.5">{g.notes}</p>}
                      </div>
                      <span className={`text-sm font-bold ${g.score >= g.max_score * 0.6 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {g.score} <span className="text-gray-400 font-normal text-xs">/ {g.max_score}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Student Results (from student_results table) ── */}
      {results.length > 0 && (
        <div className="space-y-4 mt-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-primary dark:text-brand-secondary" /> Resultado Final
          </h2>
          {results.map((r) => {
            const pAvgs = [r.period1_avg, r.period2_avg, r.period3_avg, r.period4_avg].filter((v) => v != null) as number[];
            return (
              <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {r.discipline?.name ?? 'Disciplina'}
                  </p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_STATUS_COLORS[r.result]}`}>
                    {RESULT_STATUS_LABELS[r.result]}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {pAvgs.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {pAvgs.map((avg, i) => (
                        <div key={i} className="text-center">
                          <p className="text-[10px] text-gray-400 uppercase">P{i + 1}</p>
                          <p className={`text-sm font-bold ${avg >= 6 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {avg.toFixed(1)}
                          </p>
                        </div>
                      ))}
                      {r.final_avg != null && (
                        <div className="text-center border-l border-gray-200 dark:border-gray-600 pl-3">
                          <p className="text-[10px] text-gray-400 uppercase">Final</p>
                          <p className={`text-sm font-bold ${r.final_avg >= 6 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {r.final_avg.toFixed(1)}
                          </p>
                        </div>
                      )}
                      {r.attendance_pct != null && (
                        <div className="text-center border-l border-gray-200 dark:border-gray-600 pl-3">
                          <p className="text-[10px] text-gray-400 uppercase">Freq.</p>
                          <p className={`text-sm font-bold ${r.attendance_pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {r.attendance_pct.toFixed(0)}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
