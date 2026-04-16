import { useEffect, useState, useCallback } from 'react';
import { useProfessor } from '../../contexts/ProfessorAuthContext';
import { supabase } from '../../../lib/supabase';
import {
  FileText, Plus, Check, Loader2, Calendar, Target,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../../admin/components/Drawer';
import type { LessonPlan, LessonPlanStatus } from '../../../admin/types/admin.types';
import { LESSON_PLAN_STATUS_LABELS } from '../../../admin/types/admin.types';

type SaveState = 'idle' | 'saving' | 'saved';

const STATUS_COLORS: Record<LessonPlanStatus, string> = {
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  published: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  executed:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const PLAN_STATUSES: LessonPlanStatus[] = ['draft', 'published', 'executed', 'cancelled'];

export default function PlanosPage() {
  const { professor, teacherClasses } = useProfessor();
  const [plans, setPlans]       = useState<LessonPlan[]>([]);
  const [loading, setLoading]   = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [discFilter, setDiscFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState<LessonPlanStatus | ''>('');

  // BNCC objectives
  const [objectives, setObjectives]     = useState<{id: string; code: string; title: string}[]>([]);
  const [selectedObjIds, setSelectedObjIds] = useState<string[]>([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editPlan, setEditPlan]     = useState<LessonPlan | null>(null);
  const [saveState, setSaveState]   = useState<SaveState>('idle');

  // Form fields
  const [title, setTitle]           = useState('');
  const [classId, setClassId]       = useState('');
  const [subjectId, setSubjectId]   = useState('');
  const [objective, setObjective]   = useState('');
  const [content, setContent]       = useState('');
  const [methodology, setMethodology] = useState('');
  const [resources, setResources]   = useState('');
  const [assessment, setAssessment] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [status, setStatus]         = useState<LessonPlanStatus>('draft');
  const [notes, setNotes]           = useState('');

  const loadPlans = useCallback(async () => {
    if (!professor) return;
    setLoading(true);
    let query = supabase
      .from('lesson_plans')
      .select('*')
      .eq('teacher_id', professor.id)
      .order('created_at', { ascending: false });

    if (classFilter)  query = query.eq('class_id', classFilter);
    if (discFilter)   query = query.eq('subject_id', discFilter);
    if (statusFilter) query = query.eq('status', statusFilter);

    const { data } = await query;
    setPlans((data as LessonPlan[]) ?? []);
    setLoading(false);
  }, [professor, classFilter, discFilter, statusFilter]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  useEffect(() => {
    if (!subjectId) { setObjectives([]); return; }
    supabase
      .from('learning_objectives')
      .select('id, code, title')
      .eq('subject_id', subjectId)
      .eq('is_active', true)
      .order('code')
      .then(({ data }) => setObjectives((data ?? []) as {id: string; code: string; title: string}[]));
  }, [subjectId]);

  function openNew() {
    setEditPlan(null);
    setTitle(''); setClassId(''); setSubjectId(''); setObjective('');
    setContent(''); setMethodology(''); setResources(''); setAssessment('');
    setPlannedDate(''); setStatus('draft'); setNotes('');
    setSelectedObjIds([]);
    setDrawerOpen(true);
  }

  function openEdit(plan: LessonPlan) {
    setEditPlan(plan);
    setTitle(plan.title);
    setClassId(plan.class_id);
    setSubjectId(plan.subject_id ?? '');
    setObjective(plan.objective ?? '');
    setContent(plan.content ?? '');
    setMethodology(plan.methodology ?? '');
    setResources(plan.resources ?? '');
    setAssessment(plan.assessment ?? '');
    setPlannedDate(plan.planned_date ?? '');
    setStatus(plan.status);
    setNotes(plan.notes ?? '');
    // Carregar objetivos associados
    supabase
      .from('lesson_plan_objectives')
      .select('learning_objective_id')
      .eq('lesson_plan_id', plan.id)
      .then(({ data }) => setSelectedObjIds((data ?? []).map((r: { learning_objective_id: string }) => r.learning_objective_id)));
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!professor || !title.trim() || !classId) return;
    setSaveState('saving');

    const payload = {
      teacher_id:   professor.id,
      class_id:     classId,
      subject_id:   subjectId || null,
      title:        title.trim(),
      objective:    objective || null,
      content:      content || null,
      methodology:  methodology || null,
      resources:    resources || null,
      assessment:   assessment || null,
      planned_date: plannedDate || null,
      status,
      notes:        notes || null,
    };

    let savedPlanId: string | null = null;

    if (editPlan) {
      await supabase.from('lesson_plans').update(payload).eq('id', editPlan.id);
      savedPlanId = editPlan.id;
    } else {
      const { data: inserted } = await supabase
        .from('lesson_plans')
        .insert(payload)
        .select('id')
        .single();
      savedPlanId = inserted?.id ?? null;
    }

    // Sincronizar objetivos BNCC
    if (subjectId && savedPlanId) {
      await supabase.from('lesson_plan_objectives').delete().eq('lesson_plan_id', savedPlanId);
      if (selectedObjIds.length > 0) {
        await supabase.from('lesson_plan_objectives').insert(
          selectedObjIds.map((oid) => ({ lesson_plan_id: savedPlanId, learning_objective_id: oid }))
        );
      }
    }

    setSaveState('saved');
    setTimeout(() => {
      setDrawerOpen(false);
      setSaveState('idle');
      loadPlans();
    }, 900);
  }

  // Collect all disciplines from all teacher classes (deduplicated)
  const allDisciplines = Array.from(
    new Map(
      teacherClasses.flatMap((c) => c.disciplines).map((d) => [d.discipline_id, d])
    ).values()
  );

  const selectedClassDisciplines = classId
    ? (teacherClasses.find((c) => c.id === classId)?.disciplines ?? [])
    : allDisciplines;

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
    focus:border-brand-primary outline-none transition-colors`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Planos de Aula</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{plans.length} plano{plans.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo plano
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="">Todas as turmas</option>
          {teacherClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {allDisciplines.length > 0 && (
          <select
            value={discFilter}
            onChange={(e) => setDiscFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
          >
            <option value="">Todas as disciplinas</option>
            {allDisciplines.map((d) => <option key={d.discipline_id} value={d.discipline_id}>{d.discipline_name}</option>)}
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LessonPlanStatus | '')}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="">Todos os status</option>
          {PLAN_STATUSES.map((s) => <option key={s} value={s}>{LESSON_PLAN_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Plans list */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhum plano encontrado</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "Novo plano" para criar seu primeiro plano de aula.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const planClass = teacherClasses.find((c) => c.id === plan.class_id);
            const planDisc  = allDisciplines.find((d) => d.discipline_id === plan.subject_id);
            return (
              <div
                key={plan.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:border-brand-primary/30 transition-colors cursor-pointer"
                onClick={() => openEdit(plan)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status]}`}>
                        {LESSON_PLAN_STATUS_LABELS[plan.status]}
                      </span>
                      {planClass && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{planClass.name}</span>
                      )}
                      {planDisc && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: planDisc.discipline_color }}
                        >
                          {planDisc.discipline_name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{plan.title}</h3>
                    {plan.objective && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{plan.objective}</p>
                    )}
                  </div>
                  {plan.planned_date && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(plan.planned_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSaveState('idle'); }}
        title={editPlan ? 'Editar Plano de Aula' : 'Novo Plano de Aula'}
        icon={FileText}
        width="w-[520px]"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => { setDrawerOpen(false); setSaveState('idle'); }}
              disabled={saveState === 'saving'}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saveState !== 'idle' || !title.trim() || !classId}
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
                <><FileText className="w-4 h-4" /> {editPlan ? 'Salvar alterações' : 'Criar plano'}</>
              )}
            </button>
          </div>
        }
      >
        <DrawerCard title="Identificação" icon={FileText}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Título *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Introdução às Frações" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Turma *</label>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }} className={inp}>
                  <option value="">Selecione...</option>
                  {teacherClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Disciplina</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  {selectedClassDisciplines.map((d) => <option key={d.discipline_id} value={d.discipline_id}>{d.discipline_name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Data planejada</label>
                <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as LessonPlanStatus)} className={inp}>
                  {PLAN_STATUSES.map((s) => <option key={s} value={s}>{LESSON_PLAN_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
          </div>
        </DrawerCard>

        <DrawerCard title="Conteúdo pedagógico" icon={FileText}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Objetivo</label>
              <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} placeholder="Objetivo geral da aula..." className={`${inp} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Conteúdo</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Conteúdo a ser ministrado..." className={`${inp} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Metodologia</label>
              <textarea value={methodology} onChange={(e) => setMethodology(e.target.value)} rows={2} placeholder="Estratégias e metodologias..." className={`${inp} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Recursos</label>
              <textarea value={resources} onChange={(e) => setResources(e.target.value)} rows={2} placeholder="Materiais e recursos necessários..." className={`${inp} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Avaliação</label>
              <textarea value={assessment} onChange={(e) => setAssessment(e.target.value)} rows={2} placeholder="Forma de avaliação da aprendizagem..." className={`${inp} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Observações</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observações adicionais..." className={`${inp} resize-none`} />
            </div>
          </div>
        </DrawerCard>

        {objectives.length > 0 && (
          <DrawerCard title="Objetivos BNCC" icon={Target}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Selecione os objetivos de aprendizagem abordados neste plano.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {objectives.map((obj) => {
                const checked = selectedObjIds.includes(obj.id);
                return (
                  <label key={obj.id} className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedObjIds((prev) =>
                          checked ? prev.filter((id) => id !== obj.id) : [...prev, obj.id]
                        )
                      }
                      className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded mr-1.5">
                        {obj.code}
                      </span>
                      <span className="text-xs text-gray-700 dark:text-gray-300">{obj.title}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </DrawerCard>
        )}
      </Drawer>
    </div>
  );
}
