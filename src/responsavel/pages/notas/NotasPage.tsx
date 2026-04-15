import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import { Loader2, Star, AlertTriangle } from 'lucide-react';

interface ActivityScore {
  id: string;
  score: number | null;
  activity: {
    id: string;
    title: string;
    type: string;
    weight: number;
    max_score: number;
    subject_id: string;
    subject?: { id: string; name: string } | null;
  } | null;
}

interface SubjectGroup {
  subject_id: string;
  subject_name: string;
  activities: ActivityScore[];
  weightedAvg: number | null;
}

const MIN_PASSING = 6.0; // standard min passing grade; could come from settings

function computeWeightedAvg(activities: ActivityScore[]): number | null {
  const graded = activities.filter((a) => a.score != null && a.activity?.weight && a.activity?.max_score);
  if (graded.length === 0) return null;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const a of graded) {
    const w = a.activity!.weight;
    const pct = (a.score! / a.activity!.max_score) * 10;
    weightedSum += pct * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

export default function NotasPage() {
  const { currentStudentId } = useGuardian();
  const [groups, setGroups]   = useState<SubjectGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStudentId) { setLoading(false); return; }

    supabase
      .from('activity_scores')
      .select(`
        id,
        score,
        activity:class_activities(
          id, title, type, weight, max_score, subject_id,
          subject:school_subjects(id, name)
        )
      `)
      .eq('student_id', currentStudentId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const scores = (data ?? []) as unknown as ActivityScore[];

        // Group by subject
        const map = new Map<string, SubjectGroup>();
        for (const s of scores) {
          const subjectId = s.activity?.subject_id ?? 'unknown';
          const subjectName = (s.activity?.subject as { name: string } | null)?.name ?? 'Sem disciplina';
          if (!map.has(subjectId)) {
            map.set(subjectId, { subject_id: subjectId, subject_name: subjectName, activities: [], weightedAvg: null });
          }
          map.get(subjectId)!.activities.push(s);
        }

        // Compute weighted avg per subject
        const result: SubjectGroup[] = [];
        map.forEach((g) => {
          g.weightedAvg = computeWeightedAvg(g.activities);
          result.push(g);
        });

        // Sort by subject name
        result.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
        setGroups(result);
        setLoading(false);
      });
  }, [currentStudentId]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Star className="w-5 h-5" /> Notas
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Boletim de notas por disciplina.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhuma nota registrada.</p>
          <p className="text-xs mt-1">As notas aparecerão aqui quando forem lançadas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.subject_id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* Subject header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{g.subject_name}</p>
                {g.weightedAvg != null && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                    g.weightedAvg >= MIN_PASSING
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  }`}>
                    {g.weightedAvg < MIN_PASSING && <AlertTriangle className="w-3.5 h-3.5" />}
                    Média: {g.weightedAvg.toFixed(1)}
                  </div>
                )}
              </div>

              {/* Activities */}
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {g.activities.map((a) => {
                  const pct = a.score != null && a.activity?.max_score
                    ? (a.score / a.activity.max_score) * 10
                    : null;
                  const isFailing = pct != null && pct < MIN_PASSING;

                  return (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {a.activity?.title ?? 'Atividade'}
                        </p>
                        <p className="text-xs text-gray-400 capitalize mt-0.5">
                          {a.activity?.type ?? ''}{a.activity?.weight ? ` · Peso ${a.activity.weight}` : ''}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-4 text-right">
                        {a.score != null ? (
                          <>
                            <span className={`text-sm font-bold ${isFailing ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>
                              {a.score}
                            </span>
                            <span className="text-xs text-gray-400"> / {a.activity?.max_score}</span>
                            {pct != null && (
                              <p className={`text-xs font-medium mt-0.5 ${isFailing ? 'text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                ({pct.toFixed(1)})
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Não lançada</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
