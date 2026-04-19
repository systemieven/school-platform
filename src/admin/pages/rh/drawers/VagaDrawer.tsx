import { useEffect, useState } from 'react';
import {
  Briefcase, FileText, MapPin, Check, Loader2, Trash2, DollarSign,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { SelectDropdown } from '../../../components/FormField';
import HtmlTemplateEditor from '../../../components/HtmlTemplateEditor';
import { logAudit } from '../../../../lib/audit';
import {
  createJobOpening, updateJobOpening, deleteJobOpening,
  JOB_AREA_LABELS,
  type JobOpening, type JobOpeningInput, type JobStatus, type JobArea,
} from '../../../hooks/useJobOpenings';
import type { EmploymentType } from '../../../hooks/useStaff';

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

type TabKey = 'info' | 'descricao' | 'requisitos';

interface Props {
  open: boolean;
  onClose: () => void;
  job: JobOpening | null;
  onSaved: () => void;
}

export default function VagaDrawer({ open, onClose, job, onSaved }: Props) {
  const [tab, setTab] = useState<TabKey>('info');
  const [form, setForm] = useState<Partial<JobOpeningInput>>(BLANK);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab('info');
    setError('');
    setSaved(false);
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

  const tabs: { key: TabKey; label: string; icon: typeof FileText }[] = [
    { key: 'info',        label: 'Informações', icon: Briefcase },
    { key: 'descricao',   label: 'Descrição',   icon: FileText },
    { key: 'requisitos',  label: 'Requisitos',  icon: MapPin },
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
              <div>
                <label className={labelCls}>
                  <DollarSign className="w-3 h-3 inline mr-1" />
                  Salário mínimo
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.salary_range_min ?? ''}
                  onChange={(e) => set('salary_range_min', e.target.value ? Number(e.target.value) : null)}
                  className={inputCls}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className={labelCls}>Salário máximo</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.salary_range_max ?? ''}
                  onChange={(e) => set('salary_range_max', e.target.value ? Number(e.target.value) : null)}
                  className={inputCls}
                  placeholder="0,00"
                />
              </div>
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
            Texto plano — entra no prompt do agente <code>resume_screener</code> (PR3) para
            pontuar candidatos. Seja específico: habilidades, formação, experiência mínima.
          </p>
          <textarea
            value={form.requirements ?? ''}
            onChange={(e) => set('requirements', e.target.value || null)}
            className={`${inputCls} min-h-[220px] resize-y font-mono text-xs`}
            placeholder={`Graduação em Matemática ou Pedagogia.\nMínimo 2 anos de experiência em sala de aula.\nDisponibilidade para trabalhar pela manhã.\n…`}
          />
        </DrawerCard>
      )}
    </Drawer>
  );
}
