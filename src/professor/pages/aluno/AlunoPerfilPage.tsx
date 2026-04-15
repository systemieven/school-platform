import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfessor } from '../../contexts/ProfessorAuthContext';
import { supabase } from '../../../lib/supabase';
import {
  ChevronLeft, User, Calendar, Star, Loader2, Check, X, Clock, AlertCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'presenca' | 'notas';

type AttStatus = 'present' | 'absent' | 'justified' | 'late';

interface StudentInfo {
  id: string;
  full_name: string;
  enrollment_number: string;
  photo_url: string | null;
  class_id: string | null;
}

interface AttendanceRecord {
  id: string;
  status: AttStatus;
  justification: string | null;
  entry_date: string;
  diary_entry_id: string;
}

interface ScoreRecord {
  act_id: string;
  score: number | null;
  is_exempt: boolean;
  activity_title: string;
  activity_date: string;
  weight: number;
  max_score: number;
  min_passing: number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ATT_LABELS: Record<AttStatus, string> = {
  present:   'Presente',
  absent:    'Falta',
  justified: 'Justificada',
  late:      'Atraso',
};

const ATT_COLORS: Record<AttStatus, string> = {
  present:   'bg-emerald-50 dark:bg-emerald-900/20',
  absent:    'bg-red-50 dark:bg-red-900/20',
  justified: 'bg-amber-50 dark:bg-amber-900/20',
  late:      'bg-blue-50 dark:bg-blue-900/20',
};

function AttIcon({ status }: { status: AttStatus }) {
  if (status === 'present')   return <Check className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === 'absent')    return <X className="w-3.5 h-3.5 text-red-500" />;
  if (status === 'justified') return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
  return <Clock className="w-3.5 h-3.5 text-blue-500" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AlunoPerfilPage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const { professor, teacherClasses } = useProfessor();
  const navigate = useNavigate();

  const cls = teacherClasses.find((c) => c.id === classId);

  const [tab, setTab]               = useState<Tab>('presenca');
  const [student, setStudent]       = useState<StudentInfo | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [scores, setScores]         = useState<ScoreRecord[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      if (!studentId || !professor || !classId) return;
      setLoading(true);

      // Load student info
      const { data: stud } = await supabase
        .from('students')
        .select('id, full_name, enrollment_number, photo_url, class_id')
        .eq('id', studentId)
        .single();

      setStudent(stud as StudentInfo | null);

      // Load attendance (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: entries } = await supabase
        .from('class_diary_entries')
        .select('id, entry_date')
        .eq('class_id', classId)
        .eq('teacher_id', professor.id)
        .gte('entry_date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('entry_date', { ascending: false });

      if (entries && entries.length > 0) {
        const entryIds = entries.map((e) => e.id);
        const { data: attData } = await supabase
          .from('diary_attendance')
          .select('id, status, justification, diary_entry_id')
          .eq('student_id', studentId)
          .in('diary_entry_id', entryIds);

        const recs: AttendanceRecord[] = (attData ?? []).map((a) => ({
          id:             a.id,
          status:         a.status as AttStatus,
          justification:  a.justification,
          entry_date:     entries.find((e) => e.id === a.diary_entry_id)?.entry_date ?? '',
          diary_entry_id: a.diary_entry_id,
        }));
        recs.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
        setAttendance(recs);
      }

      // Load scores
      const { data: acts } = await supabase
        .from('class_activities')
        .select('id, title, activity_date, weight, max_score, min_passing')
        .eq('class_id', classId)
        .eq('teacher_id', professor.id)
        .eq('is_published', true)
        .order('activity_date', { ascending: false });

      if (acts && acts.length > 0) {
        const actIds = acts.map((a) => a.id);
        const { data: scoresData } = await supabase
          .from('activity_scores')
          .select('id, activity_id, score, is_exempt')
          .eq('student_id', studentId)
          .in('activity_id', actIds);

        const recs: ScoreRecord[] = acts.map((act) => {
          const sc = (scoresData ?? []).find((s) => s.activity_id === act.id);
          return {
            act_id:         act.id,
            score:          sc?.score ?? null,
            is_exempt:      sc?.is_exempt ?? false,
            activity_title: act.title,
            activity_date:  act.activity_date,
            weight:         act.weight,
            max_score:      act.max_score,
            min_passing:    act.min_passing,
          };
        });
        setScores(recs);
      }

      setLoading(false);
    }
    load();
  }, [studentId, professor, classId]);

  // Frequency calc
  const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const totalCount   = attendance.length;
  const freqPct      = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null;

  // Average calc
  function calcAvg(): number | null {
    const graded = scores.filter((s) => s.score !== null && !s.is_exempt);
    if (graded.length === 0) return null;
    const tw = graded.reduce((sum, s) => sum + s.weight, 0);
    const ts = graded.reduce((sum, s) => sum + s.score! * s.weight, 0);
    return tw === 0 ? null : ts / tw;
  }

  const average    = calcAvg();
  const minPassing = scores.find((s) => s.min_passing !== null)?.min_passing ?? null;

  const initials = student?.full_name
    ? student.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : '?';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12 text-gray-400">
        <User className="w-10 h-10 mx-auto mb-3" />
        <p className="text-sm">Aluno não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/professor/turmas/${classId}/diario`)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs text-gray-400">{cls?.name ?? '—'}</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{student.full_name}</h1>
        </div>
      </div>

      {/* Student summary card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center gap-4">
          {student.photo_url ? (
            <img
              src={student.photo_url}
              alt={student.full_name}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center text-xl font-bold text-brand-primary flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{student.full_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Matrícula {student.enrollment_number}</p>
            <p className="text-xs text-gray-400">{cls?.name ?? '—'}</p>
          </div>
          <div className="flex gap-5 text-center flex-shrink-0">
            <div>
              <p className={`text-lg font-bold ${
                freqPct !== null && freqPct < 75
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {freqPct !== null ? `${freqPct}%` : '—'}
              </p>
              <p className="text-xs text-gray-400">Frequência</p>
            </div>
            <div>
              <p className={`text-lg font-bold ${
                average !== null && minPassing !== null && average < minPassing
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {average !== null ? average.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-gray-400">Média</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {(['presenca', 'notas'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'presenca' ? 'Presença' : 'Notas'}
          </button>
        ))}
      </div>

      {/* Presença tab */}
      {tab === 'presenca' && (
        <div className="space-y-3">
          {attendance.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Nenhum registro nos últimos 90 dias</p>
            </div>
          ) : (
            <>
              {/* Summary pills */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['present', 'absent', 'justified', 'late'] as AttStatus[]).map((s) => {
                  const count = attendance.filter((a) => a.status === s).length;
                  return (
                    <div key={s} className={`${ATT_COLORS[s]} rounded-xl p-3 text-center`}>
                      <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{count}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{ATT_LABELS[s]}</p>
                    </div>
                  );
                })}
              </div>

              {/* Records list */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                {attendance.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${ATT_COLORS[att.status]}`}>
                      <AttIcon status={att.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {ATT_LABELS[att.status]}
                      </p>
                      {att.justification && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{att.justification}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {att.entry_date
                        ? new Date(att.entry_date + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Notas tab */}
      {tab === 'notas' && (
        <div className="space-y-3">
          {scores.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
              <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Nenhuma atividade cadastrada</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {scores.map((sc) => {
                const passing =
                  sc.min_passing !== null && sc.score !== null
                    ? sc.score >= sc.min_passing
                    : true;
                return (
                  <div key={sc.act_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {sc.activity_title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(sc.activity_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {' · '}peso {sc.weight}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${
                        sc.score !== null
                          ? passing
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                          : 'text-gray-400'
                      }`}>
                        {sc.is_exempt
                          ? 'Isento'
                          : sc.score !== null
                          ? `${sc.score} / ${sc.max_score}`
                          : '—'}
                      </p>
                    </div>
                  </div>
                );
              })}

              {average !== null && (
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/30">
                  <p className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Média ponderada
                  </p>
                  <p className={`text-sm font-bold ${
                    minPassing !== null && average < minPassing
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {average.toFixed(1)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
