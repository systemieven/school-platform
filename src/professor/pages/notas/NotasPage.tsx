import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfessor } from '../../contexts/ProfessorAuthContext';
import { supabase } from '../../../lib/supabase';
import {
  Star, Plus, Check, Loader2, ChevronLeft, ClipboardList,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../../admin/components/Drawer';
type SaveState = 'idle' | 'saving' | 'saved';

// Types e labels locais para atividades do diário (ClassActivityType)
type DAtivType = 'exercicio' | 'trabalho' | 'prova' | 'apresentacao' | 'excursao' | 'autoavaliacao' | 'outro';

const ACTIVITY_TYPE_LABELS: Record<DAtivType, string> = {
  exercicio: 'Exercício', trabalho: 'Trabalho', prova: 'Prova',
  apresentacao: 'Apresentação', excursao: 'Excursão',
  autoavaliacao: 'Autoavaliação', outro: 'Outro',
};

const ACTIVITY_TYPES: DAtivType[] = [
  'exercicio', 'trabalho', 'prova', 'apresentacao', 'excursao', 'autoavaliacao', 'outro',
];

interface Student {
  id: string;
  full_name: string;
}

interface Activity {
  id: string;
  title: string;
  type: DAtivType;
  activity_date: string;
  weight: number;
  max_score: number;
  min_passing: number | null;
  is_published: boolean;
  subject_id: string | null;
}

interface Score {
  activity_id: string;
  student_id: string;
  score: number | null;
  is_exempt: boolean;
  id?: string;
}

interface EditingScore {
  activityId: string;
  studentId: string;
  value: string;
}

export default function NotasPage() {
  const { classId } = useParams<{ classId: string }>();
  const { professor, teacherClasses } = useProfessor();
  const navigate = useNavigate();

  const cls = teacherClasses.find((c) => c.id === classId);

  const [students, setStudents]     = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [scores, setScores]         = useState<Score[]>([]);
  const [loading, setLoading]       = useState(true);
  const [discFilter, setDiscFilter] = useState('');
  const [editingScore, setEditingScore] = useState<EditingScore | null>(null);

  // New activity drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actTitle, setActTitle]     = useState('');
  const [actType, setActType]       = useState<DAtivType>('exercicio');
  const [actDate, setActDate]       = useState(new Date().toISOString().split('T')[0]);
  const [actWeight, setActWeight]   = useState('1');
  const [actMaxScore, setActMaxScore] = useState('10');
  const [actMinPassing, setActMinPassing] = useState('');
  const [actSubject, setActSubject] = useState('');
  const [savingActivity, setSavingActivity] = useState<SaveState>('idle');

  const loadData = useCallback(async () => {
    if (!classId || !professor) return;
    setLoading(true);

    const studentsQuery = supabase
      .from('students')
      .select('id, full_name')
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('full_name');

    let activitiesQuery = supabase
      .from('class_activities')
      .select('id, title, type, activity_date, weight, max_score, min_passing, is_published, subject_id')
      .eq('class_id', classId)
      .eq('teacher_id', professor.id)
      .order('activity_date', { ascending: false });

    if (discFilter) activitiesQuery = activitiesQuery.eq('subject_id', discFilter);

    const [{ data: studData }, { data: actData }] = await Promise.all([
      studentsQuery,
      activitiesQuery,
    ]);

    setStudents(studData ?? []);
    setActivities(actData ?? []);

    // Fetch scores for all activities
    const actIds = (actData ?? []).map((a) => a.id);
    if (actIds.length > 0) {
      const { data: scoresData } = await supabase
        .from('activity_scores')
        .select('id, activity_id, student_id, score, is_exempt')
        .in('activity_id', actIds);
      setScores(scoresData ?? []);
    }
    setLoading(false);
  }, [classId, professor, discFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  function getScore(activityId: string, studentId: string): Score | undefined {
    return scores.find((s) => s.activity_id === activityId && s.student_id === studentId);
  }

  function calculateAverage(studentId: string): number | null {
    const graded = activities.filter((a) => a.is_published);
    if (graded.length === 0) return null;
    let totalWeight = 0;
    let totalWeighted = 0;
    let hasAny = false;
    for (const act of graded) {
      const sc = getScore(act.id, studentId);
      if (sc && sc.score !== null && !sc.is_exempt) {
        totalWeighted += sc.score * act.weight;
        totalWeight   += act.weight;
        hasAny = true;
      }
    }
    if (!hasAny || totalWeight === 0) return null;
    return totalWeighted / totalWeight;
  }

  async function handleScoreBlur(activityId: string, studentId: string, value: string) {
    setEditingScore(null);
    const numVal = value === '' ? null : parseFloat(value);
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) return;
    if (numVal !== null && (numVal < 0 || numVal > activity.max_score)) return;

    const existing = getScore(activityId, studentId);

    if (existing?.id) {
      await supabase
        .from('activity_scores')
        .update({ score: numVal })
        .eq('id', existing.id);
    } else {
      const { data: newScore } = await supabase
        .from('activity_scores')
        .insert({ activity_id: activityId, student_id: studentId, score: numVal, is_exempt: false })
        .select('id, activity_id, student_id, score, is_exempt')
        .single();
      if (newScore) {
        setScores((prev) => [...prev, newScore]);
        return;
      }
    }

    setScores((prev) =>
      prev.map((s) =>
        s.activity_id === activityId && s.student_id === studentId
          ? { ...s, score: numVal }
          : s
      )
    );
  }

  async function handleSaveActivity() {
    if (!professor || !classId || !actTitle.trim()) return;
    setSavingActivity('saving');
    await supabase.from('class_activities').insert({
      class_id:   classId,
      teacher_id: professor.id,
      title:      actTitle.trim(),
      type:       actType,
      activity_date: actDate,
      weight:     parseFloat(actWeight) || 1,
      max_score:  parseFloat(actMaxScore) || 10,
      min_passing: actMinPassing ? parseFloat(actMinPassing) : null,
      subject_id: actSubject || null,
      is_published: true,
    });
    setSavingActivity('saved');
    setTimeout(() => {
      setDrawerOpen(false);
      setSavingActivity('idle');
      setActTitle('');
      loadData();
    }, 900);
  }

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
    focus:border-brand-primary outline-none transition-colors`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/professor/turmas')}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Notas — {cls?.name ?? '—'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {activities.length} atividade{activities.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters + New button */}
      <div className="flex flex-wrap items-center gap-3">
        {(cls?.disciplines.length ?? 0) > 0 && (
          <select
            value={discFilter}
            onChange={(e) => setDiscFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
          >
            <option value="">Todas as disciplinas</option>
            {cls!.disciplines.map((d) => (
              <option key={d.discipline_id} value={d.discipline_id}>{d.discipline_name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setDrawerOpen(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova atividade
        </button>
      </div>

      {/* Grades table */}
      {activities.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhuma atividade cadastrada</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "Nova atividade" para começar.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-900/50 min-w-[180px]">
                    Aluno
                  </th>
                  {activities.map((act) => (
                    <th key={act.id} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[100px]">
                      <div className="truncate max-w-[90px]" title={act.title}>{act.title}</div>
                      <div className="text-gray-400 font-normal">{ACTIVITY_TYPE_LABELS[act.type]}</div>
                      <div className="text-gray-400 font-normal">/{act.max_score} · p{act.weight}</div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px] sticky right-0 bg-gray-50 dark:bg-gray-900/50">
                    Média
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {students.map((student) => {
                  const avg = calculateAverage(student.id);
                  const firstMinPassing = activities.find((a) => a.min_passing !== null)?.min_passing ?? null;
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 text-xs font-medium sticky left-0 bg-white dark:bg-gray-800 truncate max-w-[180px]">
                        {student.full_name}
                      </td>
                      {activities.map((act) => {
                        const sc = getScore(act.id, student.id);
                        const isEditing =
                          editingScore?.activityId === act.id &&
                          editingScore?.studentId === student.id;
                        return (
                          <td key={act.id} className="px-3 py-2 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                autoFocus
                                defaultValue={sc?.score ?? ''}
                                onBlur={(e) => handleScoreBlur(act.id, student.id, e.target.value)}
                                min={0}
                                max={act.max_score}
                                step="0.1"
                                className="w-16 px-1 py-1 text-xs text-center rounded-lg border border-brand-primary outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                              />
                            ) : (
                              <button
                                onClick={() => setEditingScore({ activityId: act.id, studentId: student.id, value: String(sc?.score ?? '') })}
                                className={`w-14 py-1 rounded-lg text-xs font-medium transition-colors ${
                                  sc?.score !== null && sc?.score !== undefined
                                    ? act.min_passing !== null && sc.score < act.min_passing
                                      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                    : 'bg-gray-50 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                                } hover:ring-2 hover:ring-brand-primary/30`}
                              >
                                {sc?.score !== null && sc?.score !== undefined ? sc.score : '—'}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center sticky right-0 bg-white dark:bg-gray-800">
                        {avg !== null ? (
                          <span className={`text-xs font-semibold ${
                            firstMinPassing !== null && avg < firstMinPassing
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {avg.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New activity drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSavingActivity('idle'); }}
        title="Nova Atividade"
        icon={Star}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => { setDrawerOpen(false); setSavingActivity('idle'); }}
              disabled={savingActivity === 'saving'}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveActivity}
              disabled={savingActivity !== 'idle' || !actTitle.trim()}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                savingActivity === 'saved'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
              }`}
            >
              {savingActivity === 'saving' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
              ) : savingActivity === 'saved' ? (
                <><Check className="w-4 h-4" /> Salvo!</>
              ) : (
                <><Star className="w-4 h-4" /> Criar atividade</>
              )}
            </button>
          </div>
        }
      >
        <DrawerCard title="Identificação" icon={ClipboardList}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Título *</label>
              <input value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder="Ex: Prova Bimestral 1" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tipo</label>
                <select value={actType} onChange={(e) => setActType(e.target.value as DAtivType)} className={inp}>
                  {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Data</label>
                <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Peso</label>
                <input type="number" value={actWeight} onChange={(e) => setActWeight(e.target.value)} min="0.1" step="0.1" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nota máx.</label>
                <input type="number" value={actMaxScore} onChange={(e) => setActMaxScore(e.target.value)} min="1" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Mín. aprovação</label>
                <input type="number" value={actMinPassing} onChange={(e) => setActMinPassing(e.target.value)} min="0" className={inp} placeholder="—" />
              </div>
            </div>
            {(cls?.disciplines.length ?? 0) > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Disciplina</label>
                <select value={actSubject} onChange={(e) => setActSubject(e.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  {cls!.disciplines.map((d) => <option key={d.discipline_id} value={d.discipline_id}>{d.discipline_name}</option>)}
                </select>
              </div>
            )}
          </div>
        </DrawerCard>
      </Drawer>
    </div>
  );
}
