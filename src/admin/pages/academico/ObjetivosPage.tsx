import { useEffect, useState, useCallback } from 'react';
import { Target, Check, Loader2, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { Toggle } from '../../components/Toggle';

interface LearningObjective {
  id: string;
  subject_id: string | null;
  segment_id: string | null;
  school_year: number | null;
  code: string;
  title: string;
  description: string | null;
  competency: string | null;
  is_active: boolean;
  created_at: string;
  subject?: { id: string; name: string } | null;
  segment?: { id: string; name: string } | null;
}

interface Subject { id: string; name: string; }
interface Segment { id: string; name: string; }
interface Series  { id: string; name: string; order_index: number; }

type SaveState = 'idle' | 'saving' | 'saved';

const inp = `w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none`;

export default function ObjetivosPage() {
  useAdminAuth();

  const [objectives, setObjectives] = useState<LearningObjective[]>([]);
  const [subjects, setSubjects]     = useState<Subject[]>([]);
  const [segments, setSegments]     = useState<Segment[]>([]);
  const [series, setSeries]         = useState<Series[]>([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [filterSegment, setFilterSegment] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus]   = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch]               = useState('');

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editObj, setEditObj]       = useState<LearningObjective | null>(null);
  const [saveState, setSaveState]   = useState<SaveState>('idle');

  // Form
  const [code, setCode]           = useState('');
  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [competency, setCompetency]   = useState('');
  const [segmentId, setSegmentId]     = useState('');
  const [subjectId, setSubjectId]     = useState('');
  const [schoolYear, setSchoolYear]   = useState<string>('');
  const [isActive, setIsActive]       = useState(true);

  const loadObjectives = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('learning_objectives')
      .select('*, subject:school_subjects(id,name), segment:school_segments(id,name)')
      .order('code');
    setObjectives((data as LearningObjective[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadObjectives();
  }, [loadObjectives]);

  useEffect(() => {
    // school_subjects não tem is_active — mesmo padrão do DiarioAdminPage
    supabase
      .from('school_subjects')
      .select('id, name')
      .order('name')
      .then(({ data }) => setSubjects((data as Subject[]) ?? []));

    // school_segments usa "position", não "order_index"
    supabase
      .from('school_segments')
      .select('id, name')
      .eq('is_active', true)
      .order('position')
      .then(({ data }) => setSegments((data as Segment[]) ?? []));
  }, []);

  // Carrega séries do segmento selecionado
  useEffect(() => {
    if (!segmentId) { setSeries([]); return; }
    supabase
      .from('school_series')
      .select('id, name, order_index')
      .eq('segment_id', segmentId)
      .eq('is_active', true)
      .order('order_index')
      .then(({ data }) => setSeries((data as Series[]) ?? []));
  }, [segmentId]);

  function openNew() {
    setEditObj(null);
    setCode(''); setTitle(''); setDescription(''); setCompetency('');
    setSegmentId(''); setSubjectId(''); setSchoolYear('');
    setSeries([]); setIsActive(true);
    setDrawerOpen(true);
  }

  function openEdit(obj: LearningObjective) {
    setEditObj(obj);
    setCode(obj.code);
    setTitle(obj.title);
    setDescription(obj.description ?? '');
    setCompetency(obj.competency ?? '');
    setSegmentId(obj.segment_id ?? '');
    setSubjectId(obj.subject_id ?? '');
    setSchoolYear(obj.school_year != null ? String(obj.school_year) : '');
    setIsActive(obj.is_active);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSaveState('idle');
  }

  async function handleSave() {
    if (!code.trim() || !title.trim()) return;
    setSaveState('saving');

    const payload = {
      code:        code.trim(),
      title:       title.trim(),
      description: description || null,
      competency:  competency || null,
      segment_id:  segmentId || null,
      subject_id:  subjectId || null,
      school_year: schoolYear ? parseInt(schoolYear, 10) : null,
      is_active:   isActive,
    };

    if (editObj) {
      await supabase.from('learning_objectives').update(payload).eq('id', editObj.id);
      await logAudit({
        action: 'update',
        module: 'learning_objectives',
        recordId: editObj.id,
        description: `Objetivo BNCC atualizado: ${payload.code} — ${payload.title}`,
      });
    } else {
      const { data: inserted } = await supabase
        .from('learning_objectives')
        .insert(payload)
        .select('id')
        .single();
      if (inserted) {
        await logAudit({
          action: 'create',
          module: 'learning_objectives',
          recordId: inserted.id,
          description: `Objetivo BNCC criado: ${payload.code} — ${payload.title}`,
        });
      }
    }

    setSaveState('saved');
    setTimeout(() => {
      closeDrawer();
      loadObjectives();
    }, 900);
  }

  const filtered = objectives.filter((obj) => {
    if (filterSegment && obj.segment_id !== filterSegment) return false;
    if (filterSubject && obj.subject_id !== filterSubject) return false;
    if (filterStatus === 'active' && !obj.is_active) return false;
    if (filterStatus === 'inactive' && obj.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!obj.code.toLowerCase().includes(q) && !obj.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Objetivos de Aprendizagem / BNCC
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie os objetivos de aprendizagem com referência à Base Nacional Comum Curricular
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
        >
          <Target className="w-4 h-4" />
          Novo Objetivo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterSegment}
          onChange={(e) => setFilterSegment(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="">Todos os segmentos</option>
          {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="">Todas as disciplinas</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>

        <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou título..."
            className="flex-1 text-sm bg-transparent text-gray-800 dark:text-gray-200 outline-none placeholder-gray-400"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Target className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhum objetivo encontrado</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {objectives.length === 0
              ? 'Clique em "Novo Objetivo" para cadastrar o primeiro objetivo BNCC.'
              : 'Tente ajustar os filtros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((obj) => (
            <div
              key={obj.id}
              onClick={() => openEdit(obj)}
              className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-brand-primary/30 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-mono px-2 py-0.5 rounded-full">
                      {obj.code}
                    </span>
                    {obj.segment?.name && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{obj.segment.name}</span>
                    )}
                    {obj.subject?.name && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">· {obj.subject.name}</span>
                    )}
                    {obj.school_year != null && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{obj.school_year}º ano</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">{obj.title}</p>
                  {obj.competency && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{obj.competency}</p>
                  )}
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    obj.is_active
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {obj.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editObj ? 'Editar Objetivo BNCC' : 'Novo Objetivo BNCC'}
        icon={Target}
        width="w-[520px]"
        headerExtra={
          <div className="flex items-center gap-3">
            <Toggle
              checked={isActive}
              onChange={setIsActive}
              onColor="bg-emerald-500"
            />
          </div>
        }
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeDrawer}
              disabled={saveState === 'saving'}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saveState !== 'idle' || !code.trim() || !title.trim()}
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
                <><Target className="w-4 h-4" /> {editObj ? 'Salvar alterações' : 'Criar objetivo'}</>
              )}
            </button>
          </div>
        }
      >
        <DrawerCard title="Identificação BNCC" icon={Target}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Código BNCC *
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: EF05MA10"
                className={inp}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Título *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do objetivo"
                className={inp}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Área de Competência
              </label>
              <input
                value={competency}
                onChange={(e) => setCompetency(e.target.value)}
                placeholder="Área de competência BNCC"
                className={inp}
              />
            </div>
          </div>
        </DrawerCard>

        <DrawerCard title="Detalhes" icon={Target}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Descrição completa da habilidade..."
                className={`${inp} resize-none`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Segmento
                </label>
                <select
                  value={segmentId}
                  onChange={(e) => { setSegmentId(e.target.value); setSchoolYear(''); }}
                  className={inp}
                >
                  <option value="">Selecione...</option>
                  {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Disciplina
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className={inp}
                >
                  <option value="">Selecione...</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Ano/Série
              </label>
              <select
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                disabled={!segmentId || series.length === 0}
                className={`${inp} disabled:opacity-50`}
              >
                <option value="">
                  {!segmentId
                    ? 'Selecione um segmento primeiro'
                    : series.length === 0
                    ? 'Nenhuma série cadastrada'
                    : 'Selecione...'}
                </option>
                {series.map((sr) => (
                  <option key={sr.id} value={String(sr.order_index)}>
                    {sr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </DrawerCard>
      </Drawer>
    </div>
  );
}
