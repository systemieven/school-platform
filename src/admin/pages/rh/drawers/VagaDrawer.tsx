import { useEffect, useState } from 'react';
import {
  Briefcase, FileText, MapPin, Check, Loader2, Trash2,
  Sparkles, UserCheck, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { SelectDropdown } from '../../../components/FormField';
import { CurrencyField } from '../../../components/CurrencyField';
import HtmlTemplateEditor from '../../../components/HtmlTemplateEditor';
import { logAudit } from '../../../../lib/audit';
import { supabase } from '../../../../lib/supabase';
import {
  createJobOpening, updateJobOpening, deleteJobOpening,
  JOB_AREA_LABELS,
  type JobOpening, type JobOpeningInput, type JobStatus, type JobArea,
} from '../../../hooks/useJobOpenings';
import type { EmploymentType } from '../../../hooks/useStaff';

// Linha devolvida pela RPC list_reserva_candidates_for_job (definida na 214).
interface ReservaCandidateRow {
  application_id: string;
  candidate_name: string;
  screener_score: number | null;
  pre_screening_status: string;
  extracted_summary: string | null;
  interview_recommendation: string | null;
  experience_json: unknown;
  skills_json: unknown;
}

interface BestFitItem {
  application_id: string;
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
}

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';
const labelCls =
  'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', terceirizado: 'Terceirizado',
};
const STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Rascunho', published: 'Publicada', paused: 'Pausada', closed: 'Encerrada',
};

const BLANK: Partial<JobOpeningInput> = {
  title: '',
  area: 'administrativa',
  department: null,
  location: null,
  description: '',
  requirements: '',
  employment_type: 'clt',
  salary_range_min: null,
  salary_range_max: null,
  status: 'draft',
};

type TabKey = 'info' | 'descricao' | 'requisitos' | 'reserva';

interface Props {
  open: boolean;
  onClose: () => void;
  job: JobOpening | null;
  onSaved: () => void;
  onSelectCandidate?: (applicationId: string) => void;
}

export default function VagaDrawer({ open, onClose, job, onSaved, onSelectCandidate }: Props) {
  const [tab, setTab] = useState<TabKey>('info');
  const [form, setForm] = useState<Partial<JobOpeningInput>>(BLANK);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [bfLoading, setBfLoading] = useState(false);
  const [bfError, setBfError] = useState('');
  const [bfReservaCount, setBfReservaCount] = useState<number | null>(null);
  const [bfItems, setBfItems] = useState<BestFitItem[] | null>(null);
  const [bfNames, setBfNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setTab('info');
    setError('');
    setSaved(false);
    setBfError('');
    setBfItems(null);
    setBfReservaCount(null);
    setBfNames({});
    if (job) {
      const { id: _i, opened_at: _o, closed_at: _c, created_by: _cb, created_at: _ca, updated_at: _ua, ...rest } = job;
      setForm(rest);
    } else {
      setForm(BLANK);
    }
  }, [open, job]);

  function set<K extends keyof JobOpeningInput>(k: K, v: JobOpeningInput[K] | null) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const isNew = !job;

  async function handleSave() {
    if (!form.title?.trim()) {
      setError('Título é obrigatório.');
      setTab('info');
      return;
    }
    if (!form.employment_type) {
      setError('Vínculo é obrigatório.');
      setTab('info');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Partial<JobOpeningInput> = {
        ...form,
        title: form.title?.trim(),
        department: form.department?.trim() || null,
        location: form.location?.trim() || null,
      };
      if (job) {
        const updated = await updateJobOpening(job.id, payload);
        logAudit({
          action: 'update', module: 'rh-seletivo', recordId: updated.id,
          description: `Vaga atualizada: ${updated.title}`,
        });
      } else {
        const created = await createJobOpening(payload);
        logAudit({
          action: 'create', module: 'rh-seletivo', recordId: created.id,
          description: `Vaga criada: ${created.title}`,
        });
      }
      setSaving(false);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onSaved();
        onClose();
      }, 900);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Erro ao salvar vaga.');
    }
  }

  async function handleDelete() {
    if (!job) return;
    if (!confirm(`Excluir vaga "${job.title}"? Todas as candidaturas associadas também serão removidas.`)) return;
    setSaving(true);
    try {
      await deleteJobOpening(job.id);
      logAudit({
        action: 'delete', module: 'rh-seletivo', recordId: job.id,
        description: `Vaga excluída: ${job.title}`,
      });
      onSaved();
      onClose();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  }

  async function handleSuggestBestFit() {
    if (!job || form.status !== 'published') return;
    setBfLoading(true);
    setBfError('');
    setBfItems(null);
    setBfReservaCount(null);
    try {
      const { data: reserva, error: rpcError } = await supabase.rpc(
        'list_reserva_candidates_for_job',
        { p_job_id: job.id },
      );
      if (rpcError) throw new Error(rpcError.message);
      const rows = (reserva ?? []) as ReservaCandidateRow[];
      setBfReservaCount(rows.length);
      setBfNames(Object.fromEntries(rows.map((r) => [r.application_id, r.candidate_name])));
      if (rows.length === 0) {
        setBfItems([]);
        return;
      }
      const candidates_json = JSON.stringify(
        rows.map((r) => ({
          application_id: r.application_id,
          name: r.candidate_name,
          screener_score: r.screener_score,
          pre_screening_status: r.pre_screening_status,
          summary: r.extracted_summary,
          interview_recommendation: r.interview_recommendation,
          experience: r.experience_json,
          skills: r.skills_json,
        })),
      );
      const { data, error: invokeError } = await supabase.functions.invoke('ai-orchestrator', {
        body: {
          agent_slug: 'best_fit_selector',
          context: {
            job_title: form.title ?? job.title,
            job_requirements: form.requirements ?? '',
            area_label: JOB_AREA_LABELS[(form.area ?? job.area) as JobArea],
            candidates_json,
          },
        },
      });
      if (invokeError || (data as { error?: string } | null)?.error) {
        throw new Error((data as { error?: string } | null)?.error ?? invokeError?.message ?? 'Falha na chamada');
      }
      const raw = (data as { text?: string }).text ?? '';
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < 0) throw new Error('Resposta do agente sem JSON.');
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { top?: BestFitItem[] };
      const top = (parsed.top ?? []).slice(0, 5);
      setBfItems(top);
    } catch (e) {
      setBfError(e instanceof Error ? e.message : 'Erro ao consultar best_fit_selector.');
    } finally {
      setBfLoading(false);
    }
  }

  const showReservaTab = !isNew && form.status === 'published';

  const tabs: { key: TabKey; label: string; icon: typeof FileText }[] = [
    { key: 'info',        label: 'Informações', icon: Briefcase },
    { key: 'descricao',   label: 'Descrição',   icon: FileText },
    { key: 'requisitos',  label: 'Requisitos',  icon: MapPin },
    ...(showReservaTab ? [{ key: 'reserva' as TabKey, label: 'Reserva', icon: UserCheck }] : []),
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isNew ? 'Nova vaga' : job!.title}
      icon={Briefcase}
      width="w-[640px]"
      footer={(
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
            {saving ? 'Salvando…' : saved ? 'Salvo!' : isNew ? 'Criar vaga' : 'Salvar alterações'}
          </button>
        </div>
      )}
    >
      {/* Tab rail */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700 mb-3">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-brand-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {tab === 'info' && (
        <DrawerCard title="Informações gerais" icon={Briefcase}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Título *</label>
              <input
                type="text"
                value={form.title ?? ''}
                onChange={(e) => set('title', e.target.value)}
                className={inputCls}
                placeholder="Professor(a) de Matemática"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Departamento</label>
                <input
                  type="text"
                  value={form.department ?? ''}
                  onChange={(e) => set('department', e.target.value || null)}
                  className={inputCls}
                  placeholder="Pedagógico"
                />
              </div>
              <div>
                <label className={labelCls}>Localização</label>
                <input
                  type="text"
                  value={form.location ?? ''}
                  onChange={(e) => set('location', e.target.value || null)}
                  className={inputCls}
                  placeholder="Caruaru - PE"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectDropdown
                label="Área *"
                value={form.area ?? 'administrativa'}
                onChange={(e) => set('area', e.target.value as JobArea)}
              >
                {(Object.keys(JOB_AREA_LABELS) as JobArea[]).map((k) => (
                  <option key={k} value={k}>{JOB_AREA_LABELS[k]}</option>
                ))}
              </SelectDropdown>
              <SelectDropdown
                label="Vínculo *"
                value={form.employment_type ?? 'clt'}
                onChange={(e) => set('employment_type', e.target.value as EmploymentType)}
              >
                {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((k) => (
                  <option key={k} value={k}>{EMPLOYMENT_LABELS[k]}</option>
                ))}
              </SelectDropdown>
            </div>
            <SelectDropdown
              label="Status *"
              value={form.status ?? 'draft'}
              onChange={(e) => set('status', e.target.value as JobStatus)}
            >
              {(Object.keys(STATUS_LABELS) as JobStatus[]).map((k) => (
                <option key={k} value={k}>{STATUS_LABELS[k]}</option>
              ))}
            </SelectDropdown>
            <div className="grid grid-cols-2 gap-3">
              <CurrencyField
                label="Salário mínimo"
                value={form.salary_range_min}
                onChange={(v) => set('salary_range_min', v)}
                labelClassName={labelCls}
                inputClassName={inputCls}
                showIcon
              />
              <CurrencyField
                label="Salário máximo"
                value={form.salary_range_max}
                onChange={(v) => set('salary_range_max', v)}
                labelClassName={labelCls}
                inputClassName={inputCls}
              />
            </div>
          </div>
        </DrawerCard>
      )}

      {tab === 'descricao' && (
        <DrawerCard title="Descrição da vaga" icon={FileText}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Usado na página /trabalhe-conosco e na comunicação com candidatos. Aceita formatação rica.
          </p>
          <HtmlTemplateEditor
            value={form.description ?? ''}
            onChange={(html) => set('description', html)}
            placeholder="Descreva as atividades, o dia a dia e o que torna esta vaga atrativa…"
            hideVariables
            minHeight={280}
          />
        </DrawerCard>
      )}

      {tab === 'requisitos' && (
        <DrawerCard title="Requisitos" icon={MapPin}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Liste o que o candidato precisa ter para se encaixar nesta vaga.
            Quanto mais claro e específico, melhor a triagem automática dos
            currículos. Inclua, por exemplo: formação exigida, tempo mínimo
            de experiência, habilidades necessárias e disponibilidade de horário.
          </p>
          <textarea
            value={form.requirements ?? ''}
            onChange={(e) => set('requirements', e.target.value || null)}
            className={`${inputCls} min-h-[220px] resize-y text-sm`}
            placeholder={`Graduação em Matemática ou Pedagogia.\nMínimo 2 anos de experiência em sala de aula.\nDisponibilidade para trabalhar pela manhã.\n…`}
          />
        </DrawerCard>
      )}

      {tab === 'reserva' && showReservaTab && (
        <DrawerCard title="Sugestão da base reserva" icon={Sparkles}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Analisamos os candidatos da base reserva da área{' '}
            <strong>{JOB_AREA_LABELS[(form.area ?? 'administrativa') as JobArea]}</strong>{' '}
            e sugerimos os 5 com maior aderência ao perfil desta vaga.
          </p>

          <button
            type="button"
            onClick={handleSuggestBestFit}
            disabled={bfLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50 transition-colors"
          >
            {bfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {bfLoading ? 'Analisando…' : 'Sugerir candidatos da reserva'}
          </button>

          {bfError && (
            <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">
              {bfError}
            </div>
          )}

          {!bfLoading && bfItems !== null && bfReservaCount === 0 && (
            <div className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-8 px-4">
              Nenhum candidato na base reserva para a área{' '}
              {JOB_AREA_LABELS[(form.area ?? 'administrativa') as JobArea]} ainda.
            </div>
          )}

          {!bfLoading && bfItems !== null && bfItems.length === 0 && bfReservaCount !== null && bfReservaCount > 0 && (
            <div className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-8 px-4">
              O agente avaliou {bfReservaCount} candidato{bfReservaCount > 1 ? 's' : ''} mas nenhum atingiu fit mínimo.
            </div>
          )}

          {!bfLoading && bfItems && bfItems.length > 0 && (
            <div className="mt-3 space-y-2">
              {bfItems.map((item, idx) => {
                const scoreColor =
                  item.score >= 70
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : item.score >= 40
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-gray-500 dark:text-gray-400';
                const name = bfNames[item.application_id] ?? 'Candidato';
                return (
                  <div
                    key={`${item.application_id}-${idx}`}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                          {name}
                        </span>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${scoreColor}`}>
                        {item.score}/100
                      </span>
                    </div>
                    {item.summary && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        {item.summary}
                      </p>
                    )}
                    {(item.pros?.length || item.cons?.length) ? (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {item.pros?.map((p, i) => (
                          <span
                            key={`p-${i}`}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                          >
                            <ThumbsUp className="w-2.5 h-2.5" />
                            {p}
                          </span>
                        ))}
                        {item.cons?.map((c, i) => (
                          <span
                            key={`c-${i}`}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                          >
                            <ThumbsDown className="w-2.5 h-2.5" />
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {onSelectCandidate && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCandidate(item.application_id);
                          onClose();
                        }}
                        className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Abrir candidato
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DrawerCard>
      )}
    </Drawer>
  );
}
