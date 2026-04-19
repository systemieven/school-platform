import { useMemo, useRef, useState } from 'react';
import {
  Briefcase, Kanban as KanbanIcon, Search, Loader2, Plus, UserCircle2, Filter,
  Users, Clock, Sparkles, User,
} from 'lucide-react';
import PermissionGate from '../../components/PermissionGate';
import {
  useJobOpenings, JOB_AREA_LABELS, type JobOpening, type JobStatus, type JobArea,
} from '../../hooks/useJobOpenings';
import {
  useJobApplications, STAGE_ORDER, STAGE_LABEL, STAGE_COLOR,
  moveApplicationStage, type ApplicationStage, type JobApplicationWithRelations,
  type PreScreeningStatus,
} from '../../hooks/useJobApplications';
import { supabase } from '../../../lib/supabase';
import VagaDrawer from './drawers/VagaDrawer';
import CandidatoDrawer from './drawers/CandidatoDrawer';

const STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Rascunho', published: 'Publicada', paused: 'Pausada', closed: 'Encerrada',
};
const STATUS_COLORS: Record<JobStatus, string> = {
  draft:     'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  published: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  paused:    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  closed:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

// Badge compacto do status de pré-triagem IA — aparece nos cards do kanban
// e da base reserva quando o candidato veio via /trabalhe-conosco.
function PreScreeningBadge({ status }: { status: PreScreeningStatus }) {
  if (!status) return null;
  const cfg: Record<Exclude<PreScreeningStatus, null>, { label: string; cls: string }> = {
    pending:   { label: 'Triagem pendente',  cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
    running:   { label: 'Triagem em curso',  cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
    completed: { label: 'Triagem concluída', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
    abandoned: { label: 'Triagem abandonada', cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
  };
  const { label, cls } = cfg[status];
  return (
    <div className="mt-1.5 ml-6">
      <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${cls}`}>
        {label}
      </span>
    </div>
  );
}

// Dot colorido ao lado do label da coluna — espelha o padrão do /leads/kanban.
const STAGE_DOT: Record<ApplicationStage, string> = {
  novo:       '#3b82f6', // blue-500
  triagem:    '#6366f1', // indigo-500
  entrevista: '#a855f7', // purple-500
  proposta:   '#f59e0b', // amber-500
  contratado: '#10b981', // emerald-500
  descartado: '#94a3b8', // slate-400
};

// Config do indicador mini de pré-triagem (usado como "priority dot" no topo
// do card do kanban). Replica a semântica visual do PRIORITY_CONFIG do Leads.
const PRESCREEN_INDICATOR: Record<
  Exclude<PreScreeningStatus, null>,
  { label: string; color: string; dot: string }
> = {
  pending:   { label: 'Pendente',  color: 'text-gray-500',    dot: 'bg-gray-400' },
  running:   { label: 'Em curso',  color: 'text-amber-600',   dot: 'bg-amber-400 animate-pulse' },
  completed: { label: 'Concluída', color: 'text-emerald-600', dot: 'bg-emerald-400' },
  abandoned: { label: 'Abandonada', color: 'text-red-500',    dot: 'bg-red-400' },
};

function daysSince(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

type MainTab = 'vagas' | 'pipeline' | 'reserva';

export default function SeletivoPage() {
  const [tab, setTab] = useState<MainTab>('vagas');

  return (
    <div className="space-y-4">
      {/* Titulo/subtitulo vivem na barra de titulo da aba (RhPage). */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700 w-fit">
        {[
          { k: 'vagas' as const,    label: 'Vagas',        icon: Briefcase },
          { k: 'pipeline' as const, label: 'Pipeline',     icon: KanbanIcon },
          { k: 'reserva' as const,  label: 'Base reserva', icon: Users },
        ].map(({ k, label, icon: Icon }) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active ? 'bg-brand-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'vagas' && <VagasTab />}
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'reserva' && <ReservaTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESERVA TAB — candidatos sem vaga específica, agrupados por área
// ══════════════════════════════════════════════════════════════════════════════

function ReservaTab() {
  const { rows, loading, error, reload } = useJobApplications();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<'all' | JobArea>('all');
  const [selected, setSelected] = useState<JobApplicationWithRelations | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const reservas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.job_opening_id) return false;
      if (areaFilter !== 'all' && r.area !== areaFilter) return false;
      if (!q) return true;
      const name = (r.candidate?.full_name ?? '').toLowerCase();
      const email = (r.candidate?.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [rows, search, areaFilter]);

  const byArea = useMemo(() => {
    const m: Record<JobArea, JobApplicationWithRelations[]> = {
      pedagogica: [], administrativa: [], servicos_gerais: [],
    };
    reservas.forEach((r) => m[r.area]?.push(r));
    return m;
  }, [reservas]);

  function openEdit(app: JobApplicationWithRelations) {
    setSelected(app);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email…"
            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-1">
          <Filter className="w-3 h-3 text-gray-400 mx-1" />
          <button
            onClick={() => setAreaFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              areaFilter === 'all'
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Todas
          </button>
          {(Object.keys(JOB_AREA_LABELS) as JobArea[]).map((k) => (
            <button
              key={k}
              onClick={() => setAreaFilter(k)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                areaFilter === k
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {JOB_AREA_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando base reserva…
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-red-500 dark:text-red-400">{error}</div>
      ) : reservas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 py-16 text-center">
          <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhum candidato na base reserva com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(JOB_AREA_LABELS) as JobArea[]).map((area) => (
            <div
              key={area}
              className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700 p-3"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {JOB_AREA_LABELS[area]}
                </span>
                <span className="text-xs text-gray-400">{byArea[area].length}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {byArea[area].map((app) => (
                  <div
                    key={app.id}
                    onClick={() => openEdit(app)}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 cursor-pointer hover:border-brand-primary dark:hover:border-brand-secondary transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <UserCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {app.candidate?.full_name ?? 'Candidato'}
                      </span>
                    </div>
                    {app.candidate?.email && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate ml-6">
                        {app.candidate.email}
                      </div>
                    )}
                    <PreScreeningBadge status={app.pre_screening_status} />
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${STAGE_COLOR[app.stage]}`}>
                        {STAGE_LABEL[app.stage]}
                      </span>
                      {app.screener_score !== null && (
                        <span className={`text-xs font-bold ${
                          (app.screener_score ?? 0) >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                          : (app.screener_score ?? 0) >= 40 ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {app.screener_score}/100
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {byArea[area].length === 0 && (
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-6">
                    Vazio
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CandidatoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        application={selected}
        onSaved={reload}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VAGAS TAB
// ══════════════════════════════════════════════════════════════════════════════

function VagasTab() {
  const { rows, loading, error, reload } = useJobOpenings('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | JobStatus>('all');
  const [selected, setSelected] = useState<JobOpening | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [candidateApp, setCandidateApp] = useState<JobApplicationWithRelations | null>(null);
  const [candidateDrawerOpen, setCandidateDrawerOpen] = useState(false);

  async function handleSelectCandidate(applicationId: string) {
    const { data, error: err } = await supabase
      .from('job_applications')
      .select('*, candidate:candidates(*), job_opening:job_openings(id, title, department, employment_type)')
      .eq('id', applicationId)
      .maybeSingle();
    if (err || !data) {
      alert(err?.message ?? 'Candidato não encontrado.');
      return;
    }
    setCandidateApp(data as JobApplicationWithRelations);
    setCandidateDrawerOpen(true);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.department ?? '').toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  function openNew() { setSelected(null); setDrawerOpen(true); }
  function openEdit(j: JobOpening) { setSelected(j); setDrawerOpen(true); }

  return (
    <div className="space-y-4">
      {/* Filtros + ação */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-3 flex-wrap flex-1 min-w-[320px]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, departamento, localização…"
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-1">
            <Filter className="w-3 h-3 text-gray-400 mx-1" />
            {(['all', 'published', 'draft', 'paused', 'closed'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setStatus(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  status === k
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {k === 'all' ? 'Todas' : STATUS_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
        <PermissionGate moduleKey="rh-seletivo" action="create">
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            Nova vaga
          </button>
        </PermissionGate>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Carregando vagas…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-500 dark:text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Briefcase className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {rows.length === 0
                ? 'Nenhuma vaga cadastrada. Clique em "Nova vaga" para começar.'
                : 'Nenhuma vaga com os filtros atuais.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3">Vínculo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aberta em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((j) => (
                  <tr
                    key={j.id}
                    onClick={() => openEdit(j)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{j.title}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{j.department ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{j.location ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 uppercase text-xs">{j.employment_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[j.status]}`}>
                        {STATUS_LABELS[j.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {j.opened_at ? new Date(j.opened_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VagaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        job={selected}
        onSaved={reload}
        onSelectCandidate={handleSelectCandidate}
      />

      <CandidatoDrawer
        open={candidateDrawerOpen}
        onClose={() => setCandidateDrawerOpen(false)}
        application={candidateApp}
        onSaved={reload}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE (KANBAN) TAB
// ══════════════════════════════════════════════════════════════════════════════

function PipelineTab() {
  const { rows: jobs } = useJobOpenings('all');
  const [jobFilter, setJobFilter] = useState<string>('');
  const { rows, loading, error, reload } = useJobApplications(jobFilter || undefined);

  const [selected, setSelected] = useState<JobApplicationWithRelations | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const m: Record<ApplicationStage, JobApplicationWithRelations[]> = {
      novo: [], triagem: [], entrevista: [], proposta: [], contratado: [], descartado: [],
    };
    rows.forEach((r) => m[r.stage].push(r));
    return m;
  }, [rows]);

  function openNew() { setSelected(null); setDrawerOpen(true); }
  function openEdit(app: JobApplicationWithRelations) { setSelected(app); setDrawerOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-3 flex-1 min-w-[320px]">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Vaga:
          </label>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
          >
            <option value="">Todas as vagas</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}{j.department ? ` — ${j.department}` : ''}</option>
            ))}
          </select>
        </div>
        <PermissionGate moduleKey="rh-seletivo" action="create">
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo candidato
          </button>
        </PermissionGate>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando pipeline…
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-red-500 dark:text-red-400">{error}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGE_ORDER.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              apps={byStage[stage]}
              onDropApp={(appId) => {
                const app = rows.find((r) => r.id === appId);
                if (!app || app.stage === stage) return;
                moveApplicationStage(appId, stage)
                  .then(reload)
                  .catch((err) => alert(err instanceof Error ? err.message : 'Erro ao mover.'));
              }}
              onCardDragStart={(id) => setDraggingId(id)}
              onCardDragEnd={() => setDraggingId(null)}
              onCardClick={openEdit}
              draggingId={draggingId}
            />
          ))}
        </div>
      )}

      <CandidatoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        application={selected}
        defaultJobOpeningId={jobFilter || undefined}
        onSaved={reload}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Coluna + Card do Pipeline — padrão visual espelhado do /leads/kanban
// (cards arredondados, hover eleva shadow, priority-dot, badge de área,
// footer com tempo e score).
// ══════════════════════════════════════════════════════════════════════════════

function PipelineColumn({
  stage, apps, onDropApp, onCardDragStart, onCardDragEnd, onCardClick, draggingId,
}: {
  stage: ApplicationStage;
  apps: JobApplicationWithRelations[];
  onDropApp: (appId: string) => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
  onCardClick: (app: JobApplicationWithRelations) => void;
  draggingId: string | null;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  return (
    <div
      className={`flex-shrink-0 w-64 flex flex-col rounded-2xl transition-colors ${
        isDragOver ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-gray-50 dark:bg-gray-800/50'
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true); }}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragOver(false);
        const id = e.dataTransfer.getData('application/json') || draggingId;
        if (id) onDropApp(id);
      }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STAGE_DOT[stage] }} />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1 truncate">
          {STAGE_LABEL[stage]}
        </span>
        <span className="text-[10px] font-bold bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 w-5 h-5 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600">
          {apps.length}
        </span>
      </div>

      {/* Cards */}
      <div className={`flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto ${isDragOver ? 'ring-2 ring-inset ring-blue-300 dark:ring-blue-600 rounded-b-2xl' : ''}`}>
        {apps.map((app) => (
          <PipelineCard
            key={app.id}
            app={app}
            onDragStart={(e) => {
              onCardDragStart(app.id);
              e.dataTransfer.setData('application/json', app.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={onCardDragEnd}
            onClick={() => onCardClick(app)}
          />
        ))}
        {apps.length === 0 && (
          <div className="text-center py-6 text-gray-300 dark:text-gray-600">
            <User className="w-6 h-6 mx-auto mb-1 opacity-50" />
            <p className="text-[11px]">Arraste candidatos aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineCard({
  app, onDragStart, onDragEnd, onClick,
}: {
  app: JobApplicationWithRelations;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const indicator = app.pre_screening_status ? PRESCREEN_INDICATOR[app.pre_screening_status] : null;
  const days = daysSince(app.created_at);
  const score = app.screener_score;
  const scoreColor =
    score == null ? '' :
    score >= 70 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
    score >= 40 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' :
    'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-brand-primary/20 dark:hover:border-brand-secondary/20 transition-all group select-none"
    >
      {/* Triagem IA + área */}
      <div className="flex items-center gap-2 mb-2">
        {indicator ? (
          <div className={`flex items-center gap-1 text-[10px] font-medium ${indicator.color}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${indicator.dot}`} />
            {indicator.label}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            Manual
          </div>
        )}
        <span className="text-[10px] bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-secondary px-2 py-0.5 rounded-full font-medium ml-auto truncate max-w-[110px]">
          {JOB_AREA_LABELS[app.area]}
        </span>
      </div>

      {/* Nome */}
      <p className="font-semibold text-sm text-gray-800 dark:text-white leading-tight mb-1 group-hover:text-brand-primary dark:group-hover:text-brand-secondary transition-colors truncate">
        {app.candidate?.full_name ?? 'Candidato'}
      </p>

      {/* Vaga (ou base reserva) */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2.5">
        <Briefcase className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">
          {app.job_opening?.title ?? 'Base reserva'}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Clock className="w-3 h-3" />
          <span>{days === 0 ? 'hoje' : `${days}d aqui`}</span>
        </div>
        {score != null && (
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreColor}`}>
            <Sparkles className="w-3 h-3" />
            {score}/100
          </span>
        )}
      </div>
    </div>
  );
}
