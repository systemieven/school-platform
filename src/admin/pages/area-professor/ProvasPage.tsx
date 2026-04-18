import { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useTeacherClasses } from './hooks/useTeacherClasses';
import { supabase } from '../../../lib/supabase';
import {
  FileQuestion, Plus, Check, Loader2, Printer, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../../admin/components/Drawer';
import type { ExamStatus, QuestionType } from '../../../admin/types/admin.types';

type SaveState = 'idle' | 'saving' | 'saved';

interface ExamQuestionRow {
  id: string;
  exam_id: string;
  block_number: number;
  question_number: number;
  type: QuestionType;
  stem: string;
  options: { key: string; text: string }[] | null;
  correct_answer: string | null;
  score: number;
}

interface ClassExamRow {
  id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string;
  title: string;
  instructions: string | null;
  exam_date: string | null;
  total_score: number | null;
  status: ExamStatus;
  created_at: string;
  exam_questions: ExamQuestionRow[];
}

const STATUS_COLORS: Record<ExamStatus, string> = {
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  published: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  applied:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  corrected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const STATUS_LABELS: Record<ExamStatus, string> = {
  draft:     'Rascunho',
  published: 'Publicada',
  applied:   'Aplicada',
  corrected: 'Corrigida',
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  dissertativa:     'Dissertativa',
  multipla_escolha: 'Múltipla escolha',
  verdadeiro_falso: 'Verdadeiro/Falso',
  associacao:       'Associação',
};

const QUESTION_TYPES: QuestionType[] = [
  'dissertativa', 'multipla_escolha', 'verdadeiro_falso', 'associacao',
];

export default function ProvasPage() {
  const { profile } = useAdminAuth();
  const { classes: teacherClasses } = useTeacherClasses();
  const [exams, setExams]             = useState<ClassExamRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  // New exam drawer
  const [newDrawerOpen, setNewDrawerOpen]             = useState(false);
  const [examTitle, setExamTitle]                     = useState('');
  const [examClassId, setExamClassId]                 = useState('');
  const [examSubjectId, setExamSubjectId]             = useState('');
  const [examDate, setExamDate]                       = useState('');
  const [examInstructions, setExamInstructions]       = useState('');
  const [savingExam, setSavingExam]                   = useState<SaveState>('idle');

  // Question drawer
  const [qDrawerOpen, setQDrawerOpen]         = useState(false);
  const [qExamId, setQExamId]                 = useState('');
  const [qType, setQType]                     = useState<QuestionType>('dissertativa');
  const [qStem, setQStem]                     = useState('');
  const [qScore, setQScore]                   = useState('1');
  const [qOptions, setQOptions]               = useState(['', '', '', '']);
  const [qCorrectAnswer, setQCorrectAnswer]   = useState('');
  const [savingQ, setSavingQ]                 = useState<SaveState>('idle');

  const loadExams = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('class_exams')
      .select('*, exam_questions(*)')
      .eq('teacher_id', profile!.id)
      .order('created_at', { ascending: false });
    setExams((data as ClassExamRow[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadExams(); }, [loadExams]);

  async function handleCreateExam() {
    if (!profile || !examTitle.trim() || !examClassId) return;
    setSavingExam('saving');
    await supabase.from('class_exams').insert({
      teacher_id:   profile!.id,
      class_id:     examClassId,
      subject_id:   examSubjectId || null,
      title:        examTitle.trim(),
      instructions: examInstructions || null,
      exam_date:    examDate || null,
      status:       'draft',
    });
    setSavingExam('saved');
    setTimeout(() => {
      setNewDrawerOpen(false);
      setSavingExam('idle');
      setExamTitle('');
      setExamClassId('');
      setExamSubjectId('');
      setExamDate('');
      setExamInstructions('');
      loadExams();
    }, 900);
  }

  async function handleAddQuestion() {
    if (!qStem.trim() || !qExamId) return;
    setSavingQ('saving');

    const exam    = exams.find((e) => e.id === qExamId);
    const nextNum = (exam?.exam_questions.length ?? 0) + 1;

    const options =
      qType === 'multipla_escolha'
        ? qOptions
            .filter((o) => o.trim())
            .map((text, i) => ({ key: String.fromCharCode(65 + i), text }))
        : null;

    await supabase.from('exam_questions').insert({
      exam_id:         qExamId,
      block_number:    1,
      question_number: nextNum,
      type:            qType,
      stem:            qStem.trim(),
      options,
      correct_answer:  qCorrectAnswer || null,
      score:           parseFloat(qScore) || 1,
    });

    setSavingQ('saved');
    setTimeout(() => {
      setQDrawerOpen(false);
      setSavingQ('idle');
      setQStem('');
      setQType('dissertativa');
      setQScore('1');
      setQOptions(['', '', '', '']);
      setQCorrectAnswer('');
      loadExams();
    }, 900);
  }

  async function handleDeleteQuestion(questionId: string) {
    await supabase.from('exam_questions').delete().eq('id', questionId);
    loadExams();
  }

  const allDisciplines = Array.from(
    new Map(
      teacherClasses.flatMap((c) => c.disciplines).map((d) => [d.discipline_id, d])
    ).values()
  );

  const selectedClassDisciplines = examClassId
    ? (teacherClasses.find((c) => c.id === examClassId)?.disciplines ?? [])
    : allDisciplines;

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
    focus:border-brand-primary outline-none transition-colors`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Provas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {exams.length} prova{exams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setNewDrawerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova prova
        </button>
      </div>

      {/* Exams list */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <FileQuestion className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhuma prova cadastrada</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "Nova prova" para criar sua primeira prova.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => {
            const examCls    = teacherClasses.find((c) => c.id === exam.class_id);
            const examDisc   = allDisciplines.find((d) => d.discipline_id === exam.subject_id);
            const isExpanded = expandedId === exam.id;
            const questions  = exam.exam_questions ?? [];
            const totalScore = questions.reduce((sum, q) => sum + q.score, 0);

            return (
              <div
                key={exam.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : exam.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[exam.status]}`}>
                          {STATUS_LABELS[exam.status]}
                        </span>
                        {examCls && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{examCls.name}</span>
                        )}
                        {examDisc && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                            style={{ backgroundColor: examDisc.discipline_color }}
                          >
                            {examDisc.discipline_name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{exam.title}</h3>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                        <span>{questions.length} questão{questions.length !== 1 ? 'ões' : ''}</span>
                        {totalScore > 0 && <span>{totalScore} ponto{totalScore !== 1 ? 's' : ''}</span>}
                        {exam.exam_date && (
                          <span>{new Date(exam.exam_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); window.print(); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Exportar PDF"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
                    {questions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">Nenhuma questão adicionada.</p>
                    ) : (
                      [...questions]
                        .sort((a, b) => a.question_number - b.question_number)
                        .map((q) => (
                          <div
                            key={q.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl"
                          >
                            <div className="w-6 h-6 rounded-full bg-brand-primary/10 flex items-center justify-center text-xs font-bold text-brand-primary flex-shrink-0">
                              {q.question_number}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {QUESTION_TYPE_LABELS[q.type]}
                                </span>
                                <span className="text-xs text-gray-400">
                                  · {q.score} pt{q.score !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{q.stem}</p>
                              {q.options && q.options.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {q.options.map((opt) => (
                                    <div
                                      key={opt.key}
                                      className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400"
                                    >
                                      <span className="font-semibold w-4 flex-shrink-0">{opt.key})</span>
                                      <span>{opt.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                    )}
                    <button
                      onClick={() => { setQExamId(exam.id); setQDrawerOpen(true); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-colors border border-dashed border-brand-primary/30"
                    >
                      <Plus className="w-4 h-4" /> Adicionar questão
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New exam drawer */}
      <Drawer
        open={newDrawerOpen}
        onClose={() => { setNewDrawerOpen(false); setSavingExam('idle'); }}
        title="Nova Prova"
        icon={FileQuestion}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => { setNewDrawerOpen(false); setSavingExam('idle'); }}
              disabled={savingExam === 'saving'}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateExam}
              disabled={savingExam !== 'idle' || !examTitle.trim() || !examClassId}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                savingExam === 'saved'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
              }`}
            >
              {savingExam === 'saving' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
              ) : savingExam === 'saved' ? (
                <><Check className="w-4 h-4" /> Salvo!</>
              ) : (
                <><FileQuestion className="w-4 h-4" /> Criar prova</>
              )}
            </button>
          </div>
        }
      >
        <DrawerCard title="Dados da prova" icon={FileQuestion}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Título *</label>
              <input
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="Ex: Prova Bimestral 1"
                className={inp}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Turma *</label>
                <select
                  value={examClassId}
                  onChange={(e) => { setExamClassId(e.target.value); setExamSubjectId(''); }}
                  className={inp}
                >
                  <option value="">Selecione...</option>
                  {teacherClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Disciplina</label>
                <select
                  value={examSubjectId}
                  onChange={(e) => setExamSubjectId(e.target.value)}
                  className={inp}
                >
                  <option value="">Selecione...</option>
                  {selectedClassDisciplines.map((d) => (
                    <option key={d.discipline_id} value={d.discipline_id}>{d.discipline_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Data da aplicação</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Instruções</label>
              <textarea
                value={examInstructions}
                onChange={(e) => setExamInstructions(e.target.value)}
                rows={3}
                placeholder="Instruções gerais para o aluno..."
                className={`${inp} resize-none`}
              />
            </div>
          </div>
        </DrawerCard>
      </Drawer>

      {/* Add question drawer */}
      <Drawer
        open={qDrawerOpen}
        onClose={() => { setQDrawerOpen(false); setSavingQ('idle'); }}
        title="Nova Questão"
        icon={FileQuestion}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => { setQDrawerOpen(false); setSavingQ('idle'); }}
              disabled={savingQ === 'saving'}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddQuestion}
              disabled={savingQ !== 'idle' || !qStem.trim()}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                savingQ === 'saved'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
              }`}
            >
              {savingQ === 'saving' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
              ) : savingQ === 'saved' ? (
                <><Check className="w-4 h-4" /> Salvo!</>
              ) : (
                <><FileQuestion className="w-4 h-4" /> Adicionar questão</>
              )}
            </button>
          </div>
        }
      >
        <DrawerCard title="Questão" icon={FileQuestion}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tipo</label>
                <select
                  value={qType}
                  onChange={(e) => setQType(e.target.value as QuestionType)}
                  className={inp}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Pontuação</label>
                <input
                  type="number"
                  value={qScore}
                  onChange={(e) => setQScore(e.target.value)}
                  min="0.5"
                  step="0.5"
                  className={inp}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Enunciado *</label>
              <textarea
                value={qStem}
                onChange={(e) => setQStem(e.target.value)}
                rows={3}
                placeholder="Digite o enunciado da questão..."
                className={`${inp} resize-none`}
              />
            </div>
            {qType === 'multipla_escolha' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Alternativas</label>
                <div className="space-y-2">
                  {qOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-4 flex-shrink-0">
                        {String.fromCharCode(65 + i)})
                      </span>
                      <input
                        value={opt}
                        onChange={(e) => {
                          const updated = [...qOptions];
                          updated[i] = e.target.value;
                          setQOptions(updated);
                        }}
                        placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                        className={inp}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(qType === 'multipla_escolha' || qType === 'verdadeiro_falso') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Resposta correta
                </label>
                <input
                  value={qCorrectAnswer}
                  onChange={(e) => setQCorrectAnswer(e.target.value)}
                  placeholder={qType === 'verdadeiro_falso' ? 'Verdadeiro ou Falso' : 'Ex: A'}
                  className={inp}
                />
              </div>
            )}
          </div>
        </DrawerCard>
      </Drawer>
    </div>
  );
}
