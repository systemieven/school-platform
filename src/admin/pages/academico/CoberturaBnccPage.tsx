import { useEffect, useState } from 'react';
import { Loader2, Target, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface SchoolClass {
  id: string;
  name: string;
  segment_id: string | null;
  segment: { id: string; name: string } | null;
}

interface Subject {
  id: string;
  name: string;
}

interface CoverageRow {
  id: string;
  code: string;
  title: string;
  competency: string | null;
  covered: boolean;
}

export default function CoberturaBnccPage() {
  const [classes, setClasses]   = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId]   = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows]         = useState<CoverageRow[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    supabase
      .from('school_classes')
      .select('id, name, segment_id, segment:school_segments(id, name)')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setClasses((data as unknown as SchoolClass[]) ?? []));

    supabase
      .from('school_subjects')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setSubjects((data as Subject[]) ?? []));
  }, []);

  useEffect(() => {
    if (!classId) { setRows([]); return; }

    const selectedClass = classes.find((c) => c.id === classId);
    if (!selectedClass) return;

    async function load() {
      setLoading(true);

      // IDs dos planos executados desta turma
      const { data: planData } = await supabase
        .from('lesson_plans')
        .select('id')
        .eq('class_id', classId)
        .eq('status', 'executed');

      const executedPlanIds = (planData ?? []).map((p: { id: string }) => p.id);

      // Objetivos ativos filtrados por segmento (e disciplina se selecionada)
      let objQuery = supabase
        .from('learning_objectives')
        .select('id, code, title, competency')
        .eq('is_active', true)
        .order('code');

      if (selectedClass?.segment_id) {
        objQuery = objQuery.eq('segment_id', selectedClass.segment_id);
      }
      if (subjectId) {
        objQuery = objQuery.eq('subject_id', subjectId);
      }

      const { data: objData } = await objQuery;
      const objectives = objData ?? [];

      // Objetivos cobertos
      let coveredIds = new Set<string>();
      if (executedPlanIds.length > 0) {
        const { data: lpoData } = await supabase
          .from('lesson_plan_objectives')
          .select('learning_objective_id')
          .in('lesson_plan_id', executedPlanIds);

        coveredIds = new Set((lpoData ?? []).map((r: { learning_objective_id: string }) => r.learning_objective_id));
      }

      setRows(
        objectives.map((o: { id: string; code: string; title: string; competency: string | null }) => ({
          id:         o.id,
          code:       o.code,
          title:      o.title,
          competency: o.competency,
          covered:    coveredIds.has(o.id),
        }))
      );
      setLoading(false);
    }

    load();
  }, [classId, subjectId, classes]);

  const coveredCount = rows.filter((r) => r.covered).length;
  const total = rows.length;
  const pct = total > 0 ? Math.round((coveredCount / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Selects */}
      <div className="flex flex-wrap gap-3">
        <select
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="">Selecione a turma...</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.segment ? ` (${c.segment.name})` : ''}
            </option>
          ))}
        </select>

        {classId && (
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
          >
            <option value="">Todas as disciplinas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Empty state */}
      {!classId && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Target className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Selecione uma turma para ver a cobertura curricular
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Exibe os objetivos BNCC cobertos por planos de aula com status "Executado".
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
      {classId && !loading && rows.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Target className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Nenhum objetivo BNCC cadastrado para este segmento/disciplina.
          </p>
        </div>
      )}

      {classId && !loading && rows.length > 0 && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Cobertura curricular
              </p>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {coveredCount} de {total} objetivos ({pct}%)
              </span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Objective cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`rounded-xl border p-3 flex items-start gap-2.5 ${
                  row.covered
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                {row.covered ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded mr-1">
                    {row.code}
                  </span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">{row.title}</span>
                  {row.competency && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">
                      {row.competency}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
