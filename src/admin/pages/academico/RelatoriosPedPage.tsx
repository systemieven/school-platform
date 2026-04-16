import { useEffect, useState } from 'react';
import { Loader2, BarChart3, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface SchoolClass {
  id: string;
  name: string;
}

interface Student {
  id: string;
  full_name: string;
}

interface StudentReport {
  id: string;
  full_name: string;
  freqPct: number;
  avgScore: number | null;
  atRisk: boolean;
}

interface ClassSummary {
  totalStudents: number;
  atRiskCount: number;
  avgFreq: number;
  avgScore: number | null;
}

function freqColor(pct: number): string {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-yellow-400';
  return 'bg-red-500';
}

function freqTextColor(pct: number): string {
  if (pct >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreTextColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 7) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

const NULL_UUID = '00000000-0000-0000-0000-000000000000';

export default function RelatoriosPedPage() {
  const [classes, setClasses]     = useState<SchoolClass[]>([]);
  const [classId, setClassId]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [students, setStudents]   = useState<StudentReport[]>([]);
  const [summary, setSummary]     = useState<ClassSummary | null>(null);

  useEffect(() => {
    supabase
      .from('school_classes')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setClasses((data as SchoolClass[]) ?? []));
  }, []);

  useEffect(() => {
    if (!classId) { setStudents([]); setSummary(null); return; }

    async function load() {
      setLoading(true);

      // Students
      const { data: studentData } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('full_name');

      const studs = (studentData as Student[]) ?? [];
      const studIds = studs.map((s) => s.id);

      // Diary entries
      const { data: entries } = await supabase
        .from('class_diary_entries')
        .select('id')
        .eq('class_id', classId);

      const entryIds = (entries ?? []).map((e: { id: string }) => e.id);

      // Attendance
      const { data: attendance } = await supabase
        .from('diary_attendance')
        .select('student_id, present')
        .in('diary_entry_id', entryIds.length > 0 ? entryIds : [NULL_UUID]);

      const totalEntries = entryIds.length;
      const presentMap: Record<string, number> = {};
      (attendance ?? []).forEach((a: { student_id: string; present: boolean }) => {
        if (!presentMap[a.student_id]) presentMap[a.student_id] = 0;
        if (a.present) presentMap[a.student_id]++;
      });

      // Activities
      const { data: activities } = await supabase
        .from('class_activities')
        .select('id, max_score')
        .eq('class_id', classId);

      const actIds = (activities ?? []).map((a: { id: string }) => a.id);
      const maxMap: Record<string, number> = {};
      (activities ?? []).forEach((a: { id: string; max_score: number }) => {
        maxMap[a.id] = a.max_score;
      });

      // Scores
      const { data: scores } = await supabase
        .from('activity_scores')
        .select('student_id, activity_id, score')
        .in('activity_id', actIds.length > 0 ? actIds : [NULL_UUID])
        .in('student_id', studIds.length > 0 ? studIds : [NULL_UUID]);

      // Map: studentId → [{ score, max }]
      const scoresByStudent: Record<string, { score: number; max: number }[]> = {};
      (scores ?? []).forEach((s: { student_id: string; activity_id: string; score: number | null }) => {
        if (s.score === null) return;
        const max = maxMap[s.activity_id] ?? 10;
        if (!scoresByStudent[s.student_id]) scoresByStudent[s.student_id] = [];
        scoresByStudent[s.student_id].push({ score: s.score, max });
      });

      // Build report per student
      const reports: StudentReport[] = studs.map((st) => {
        const present = presentMap[st.id] ?? 0;
        const freqPct = totalEntries > 0 ? Math.round((present / totalEntries) * 100) : 100;

        const studentScores = scoresByStudent[st.id] ?? [];
        let avgScore: number | null = null;
        if (studentScores.length > 0) {
          const totalWeighted = studentScores.reduce((acc, s) => acc + (s.score / s.max) * 10, 0);
          avgScore = Math.round((totalWeighted / studentScores.length) * 10) / 10;
        }

        const atRisk = freqPct < 75 || (avgScore !== null && avgScore < 5.0);

        return { id: st.id, full_name: st.full_name, freqPct, avgScore, atRisk };
      });

      // Summary
      const totalStudents = reports.length;
      const atRiskCount = reports.filter((r) => r.atRisk).length;
      const avgFreq = totalStudents > 0
        ? Math.round(reports.reduce((acc, r) => acc + r.freqPct, 0) / totalStudents)
        : 0;
      const withScores = reports.filter((r) => r.avgScore !== null);
      const avgScore = withScores.length > 0
        ? Math.round((withScores.reduce((acc, r) => acc + (r.avgScore as number), 0) / withScores.length) * 10) / 10
        : null;

      setStudents(reports);
      setSummary({ totalStudents, atRiskCount, avgFreq, avgScore });
      setLoading(false);
    }

    load();
  }, [classId]);

  return (
    <div className="space-y-6">
      {/* Select turma */}
      <div>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="">Selecione a turma...</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Empty state */}
      {!classId && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Selecione uma turma para visualizar os relatórios pedagógicos
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Frequência, notas médias e alunos em risco serão exibidos aqui.
          </p>
        </div>
      )}

      {/* Loading */}
      {classId && loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Content */}
      {classId && !loading && summary && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <Users className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{summary.totalStudents}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total de alunos</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1.5" />
              <p className={`text-2xl font-bold ${summary.atRiskCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                {summary.atRiskCount}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Em risco</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <p className={`text-2xl font-bold ${freqTextColor(summary.avgFreq)}`}>{summary.avgFreq}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Freq. média</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <p className={`text-2xl font-bold ${scoreTextColor(summary.avgScore)}`}>
                {summary.avgScore !== null ? summary.avgScore.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Nota média</p>
            </div>
          </div>

          {/* Student list */}
          {students.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum aluno ativo nesta turma.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="space-y-0 divide-y divide-gray-50 dark:divide-gray-700">
                {students.map((st) => (
                  <div key={st.id} className="flex items-center gap-4 px-5 py-3.5">
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {st.full_name}
                      </p>
                    </div>

                    {/* Frequency bar */}
                    <div className="w-32 hidden sm:block">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${freqColor(st.freqPct)}`}
                            style={{ width: `${st.freqPct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium w-10 text-right ${freqTextColor(st.freqPct)}`}>
                          {st.freqPct}%
                        </span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="w-16 text-right">
                      <span className={`text-sm font-semibold ${scoreTextColor(st.avgScore)}`}>
                        {st.avgScore !== null ? st.avgScore.toFixed(1) : '—'}
                      </span>
                    </div>

                    {/* At risk badge */}
                    <div className="w-16 text-right">
                      {st.atRisk && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          Risco
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
