import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useTeacherClasses } from './hooks/useTeacherClasses';
import { supabase } from '../../../lib/supabase';
import {
  ChevronLeft, ClipboardList, Check, Loader2, Lock, Users, BookOpen, FileText, MessageCircle,
} from 'lucide-react';
import type {
  DiaryEntryType,
  AttendanceStatus,
} from '../../../admin/types/admin.types';
import {
  DIARY_ENTRY_TYPE_LABELS,
  ATTENDANCE_STATUS_LABELS,
} from '../../../admin/types/admin.types';

type SaveState = 'idle' | 'saving' | 'saved';

const ENTRY_TYPES: DiaryEntryType[] = ['aula', 'reposicao', 'avaliacao', 'evento', 'excursao', 'outro'];

const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present:   'bg-emerald-500 text-white',
  absent:    'bg-red-500 text-white',
  justified: 'bg-amber-500 text-white',
  late:      'bg-blue-500 text-white',
};

const DOW_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

interface StudentAttendance {
  student_id: string;
  full_name: string;
  photo_url: string | null;
  status: AttendanceStatus;
  justification: string;
  attendance_id?: string;
  absence_communication_id?: string | null;
}

export default function DiarioEntradaPage() {
  const { classId, entryId } = useParams<{ classId: string; entryId: string }>();
  const { profile } = useAdminAuth();
  const { classes: teacherClasses } = useTeacherClasses();
  const navigate = useNavigate();

  const isNew = entryId === 'novo' || !entryId;
  const cls   = teacherClasses.find((c) => c.id === classId);

  // Form state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType]           = useState<DiaryEntryType>('aula');
  const [disciplineId, setDisciplineId] = useState('');
  const [content, setContent]     = useState('');
  const [objectives, setObjectives] = useState('');
  const [materials, setMaterials] = useState('');
  const [notes, setNotes]         = useState('');
  const [isLocked, setIsLocked]   = useState(false);

  // Schedule hint
  const [scheduleHint, setScheduleHint] = useState('');

  // Attendance
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);

  // Save state
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loadingEntry, setLoadingEntry] = useState(!isNew);

  // Disciplines come from context (already loaded via class_disciplines)
  const disciplines = cls?.disciplines ?? [];

  // ── Schedule prefill ──────────────────────────────────────────────────────────
  const prefillFromSchedule = useCallback(async (date: string, currentDisciplineId: string) => {
    if (!classId || !isNew || currentDisciplineId !== '') return;
    const dow = new Date(date + 'T12:00:00').getDay();
    const { data: slots } = await supabase
      .from('class_schedules')
      .select('discipline_id')
      .eq('class_id', classId)
      .eq('day_of_week', dow)
      .limit(1);

    if (slots && slots.length > 0 && slots[0].discipline_id) {
      setDisciplineId(slots[0].discipline_id);
      setScheduleHint(DOW_NAMES[dow]);
    }
  }, [classId, isNew]);

  // ── Load students ─────────────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    if (!classId) return;
    const { data } = await supabase
      .from('students')
      .select('id, full_name, photo_url')
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('full_name');

    if (data) {
      setAttendance(data.map((s) => ({
        student_id:    s.id,
        full_name:     s.full_name,
        photo_url:     s.photo_url,
        status:        'present' as AttendanceStatus,
        justification: '',
      })));
    }
  }, [classId]);

  const loadEntry = useCallback(async () => {
    if (!entryId || isNew) return;
    setLoadingEntry(true);
    const { data: entry } = await supabase
      .from('class_diary_entries')
      .select('*, diary_attendance(id, student_id, status, justification, absence_communication_id)')
      .eq('id', entryId)
      .single();

    if (entry) {
      setEntryDate(entry.entry_date);
      setType(entry.type);
      setContent(entry.content ?? '');
      setObjectives(entry.objectives ?? '');
      setMaterials(entry.materials ?? '');
      setNotes(entry.notes ?? '');
      setIsLocked(entry.is_locked ?? false);

      if (entry.discipline_id) {
        setDisciplineId(entry.discipline_id);
      } else if (entry.subject_id) {
        const matched = cls?.disciplines.find((d) => d.subject_id === entry.subject_id);
        if (matched) setDisciplineId(matched.discipline_id);
      }

      const { data: students } = await supabase
        .from('students')
        .select('id, full_name, photo_url')
        .eq('class_id', classId!)
        .eq('status', 'active')
        .order('full_name');

      const existingAtt: DiaryAttendanceRow[] = entry.diary_attendance ?? [];
      if (students) {
        setAttendance(students.map((s) => {
          const att = existingAtt.find((a) => a.student_id === s.id);
          return {
            student_id:              s.id,
            full_name:               s.full_name,
            photo_url:               s.photo_url,
            status:                  (att?.status as AttendanceStatus) ?? 'present',
            justification:           att?.justification ?? '',
            attendance_id:           att?.id,
            absence_communication_id: att?.absence_communication_id ?? null,
          };
        }));
      }
    }
    setLoadingEntry(false);
  }, [entryId, isNew, classId, cls]);

  useEffect(() => {
    if (isNew) { loadStudents(); } else { loadEntry(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, loadStudents, loadEntry]);

  // Re-run schedule prefill when date changes (only for new entries when no discipline selected)
  useEffect(() => {
    if (!isNew) return;
    prefillFromSchedule(entryDate, disciplineId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDate]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function markAll(status: AttendanceStatus) {
    setAttendance((prev) => prev.map((a) => ({ ...a, status })));
  }

  function setStudentStatus(studentId: string, status: AttendanceStatus) {
    setAttendance((prev) =>
      prev.map((a) => a.student_id === studentId ? { ...a, status } : a)
    );
  }

  function setStudentJustification(studentId: string, justification: string) {
    setAttendance((prev) =>
      prev.map((a) => a.student_id === studentId ? { ...a, justification } : a)
    );
  }

  async function handleSave() {
    if (!profile || !classId) return;
    setSaveState('saving');

    const selectedDiscipline = disciplines.find((d) => d.discipline_id === disciplineId);
    const payload = {
      class_id:      classId,
      discipline_id: disciplineId || null,
      subject_id:    selectedDiscipline?.subject_id ?? null,
      teacher_id:    profile!.id,
      entry_date:    entryDate,
      type,
      content,
      objectives: objectives || null,
      materials:  materials || null,
      notes:      notes || null,
    };

    let savedEntryId = entryId && !isNew ? entryId : null;

    if (isNew) {
      const { data, error } = await supabase
        .from('class_diary_entries')
        .insert(payload)
        .select('id')
        .single();
      if (error || !data) { setSaveState('idle'); return; }
      savedEntryId = data.id;
    } else {
      await supabase
        .from('class_diary_entries')
        .update(payload)
        .eq('id', entryId!);
    }

    // Upsert attendance
    if (savedEntryId && attendance.length > 0) {
      const attRows = attendance.map((a) => ({
        diary_entry_id: savedEntryId!,
        student_id:     a.student_id,
        status:         a.status,
        justification:  a.justification || null,
      }));

      await supabase
        .from('diary_attendance')
        .upsert(attRows, { onConflict: 'diary_entry_id,student_id' });
    }

    setSaveState('saved');
    setTimeout(() => {
      navigate(`/admin/area-professor/turmas/${classId}/diario`);
    }, 900);
  }

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
    focus:border-brand-primary outline-none transition-colors
    disabled:bg-gray-50 disabled:text-gray-400`;

  if (loadingEntry) {
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
          onClick={() => navigate(`/admin/area-professor/turmas/${classId}/diario`)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {isNew ? 'Nova Entrada' : 'Editar Entrada'}
            </h1>
            {isLocked && (
              <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" /> Entrada travada
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{cls?.name ?? '—'}</p>
        </div>
      </div>

      {/* Section 1: Identification */}
      <Section title="Identificação" icon={BookOpen}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Data</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              disabled={isLocked}
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DiaryEntryType)}
              disabled={isLocked}
              className={inp}
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>{DIARY_ENTRY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
        {disciplines.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Disciplina</label>
            <select
              value={disciplineId}
              onChange={(e) => {
                setDisciplineId(e.target.value);
                setScheduleHint('');
              }}
              disabled={isLocked}
              className={inp}
            >
              <option value="">Selecione a disciplina...</option>
              {disciplines.map((d) => (
                <option key={d.discipline_id} value={d.discipline_id}>{d.discipline_name}</option>
              ))}
            </select>
            {scheduleHint && (
              <p className="text-[11px] text-gray-400 mt-1">
                Sugerido pela grade horária de {scheduleHint}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Section 2: Content */}
      <Section title="Conteúdo" icon={FileText}>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Conteúdo ministrado <span className="text-red-400">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isLocked}
            rows={3}
            placeholder="Descreva o conteúdo abordado nesta aula..."
            className={`${inp} resize-none`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Objetivos</label>
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            disabled={isLocked}
            rows={2}
            placeholder="Objetivos pedagógicos da aula..."
            className={`${inp} resize-none`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Materiais utilizados</label>
          <textarea
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            disabled={isLocked}
            rows={2}
            placeholder="Livros, vídeos, apostilas..."
            className={`${inp} resize-none`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLocked}
            rows={2}
            placeholder="Observações gerais sobre a aula..."
            className={`${inp} resize-none`}
          />
        </div>
      </Section>

      {/* Section 3: Attendance */}
      <Section
        title="Presença"
        icon={Users}
        headerExtra={
          !isLocked && (
            <button
              onClick={() => markAll('present')}
              className="text-xs text-brand-primary hover:underline"
            >
              Marcar todos como presentes
            </button>
          )
        }
      >
        {attendance.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum aluno ativo nesta turma.</p>
        ) : (
          <div className="space-y-2">
            {attendance.map((student) => (
              <div key={student.student_id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={student.full_name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                      {student.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Name */}
                  <span className="flex-1 flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200 truncate">
                    {student.full_name}
                    {student.absence_communication_id && (
                      <span title="Falta comunicada pelo responsável" className="flex-shrink-0">
                        <MessageCircle className="w-3 h-3 text-emerald-500" />
                      </span>
                    )}
                  </span>

                  {/* Status buttons */}
                  <div className="flex gap-1">
                    {(['present', 'absent', 'justified', 'late'] as AttendanceStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => !isLocked && setStudentStatus(student.student_id, s)}
                        disabled={isLocked}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                          student.status === s
                            ? ATTENDANCE_STATUS_COLORS[s]
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        } disabled:cursor-default`}
                      >
                        {ATTENDANCE_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Justification input */}
                {(student.status === 'justified' || student.status === 'absent') && !isLocked && (
                  <div className="ml-11">
                    <input
                      type="text"
                      value={student.justification}
                      onChange={(e) => setStudentJustification(student.student_id, e.target.value)}
                      placeholder="Justificativa (opcional)"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 outline-none focus:border-brand-primary transition-colors"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Save button */}
      {!isLocked && (
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/admin/area-professor/turmas/${classId}/diario`)}
            disabled={saveState === 'saving'}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saveState !== 'idle' || !content.trim()}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              saveState === 'saved'
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
            }`}
          >
            {saveState === 'saving' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
            ) : saveState === 'saved' ? (
              <><Check className="w-4 h-4" /> Salvo!</>
            ) : (
              <><ClipboardList className="w-4 h-4" /> {isNew ? 'Criar entrada' : 'Salvar alterações'}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Section card helper ───────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  headerExtra,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">{title}</span>
        </div>
        {headerExtra}
      </div>
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

// ── Type helper ───────────────────────────────────────────────────────────────
interface DiaryAttendanceRow {
  id: string;
  student_id: string;
  status: string;
  justification: string | null;
  absence_communication_id?: string | null;
}
