import { useEffect, useState } from 'react';
import {
  UserCircle2, FileText, ClipboardList, Sparkles, Upload, Check, Loader2,
  Trash2, ExternalLink, Mail, Phone, Linkedin, Globe, Briefcase, XCircle,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { SelectDropdown } from '../../../components/FormField';
import { logAudit } from '../../../../lib/audit';
import { supabase } from '../../../../lib/supabase';
import { extractPdfText } from '../../../../lib/extractPdfText';
import {
  upsertCandidateByEmail, deleteCandidate, type CandidateInput,
} from '../../../hooks/useCandidates';
import {
  createJobApplication, updateJobApplication, deleteJobApplication,
  moveApplicationStage, uploadApplicationResume, getApplicationResumeSignedUrl,
  STAGE_ORDER, STAGE_LABEL, STAGE_COLOR,
  type ApplicationStage, type JobApplicationWithRelations,
} from '../../../hooks/useJobApplications';
import { useJobOpenings } from '../../../hooks/useJobOpenings';

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm transition-all';
const labelCls =
  'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Candidatura existente (modo edição). */
  application: JobApplicationWithRelations | null;
  /** Quando criando nova, pode pré-selecionar uma vaga. */
  defaultJobOpeningId?: string;
  onSaved: () => void;
}

type TabKey = 'candidato' | 'cv' | 'triagem' | 'pipeline';

export default function CandidatoDrawer({
  open, onClose, application, defaultJobOpeningId, onSaved,
}: Props) {
  const { rows: jobs } = useJobOpenings('all');
  const [tab, setTab] = useState<TabKey>('candidato');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Dados do candidato (editáveis)
  const [cand, setCand] = useState<Partial<CandidateInput>>({});
  // Dados da candidatura
  const [jobOpeningId, setJobOpeningId] = useState<string>('');
  const [source, setSource] = useState<string>('manual');
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState<ApplicationStage>('novo');
  const [rejectedReason, setRejectedReason] = useState('');

  // CV
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);

  // Análise IA
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const isNew = !application;

  useEffect(() => {
    if (!open) return;
    setTab('candidato');
    setError('');
    setSaved(false);
    setCvFile(null);
    setCvUrl(null);
    setAnalyzeError('');
    if (application) {
      const c = application.candidate;
      setCand(c ? {
        full_name: c.full_name, email: c.email, phone: c.phone, cpf: c.cpf,
        rg: c.rg, cnh: c.cnh, birth_date: c.birth_date,
        linkedin_url: c.linkedin_url, portfolio_url: c.portfolio_url,
      } : {});
      setJobOpeningId(application.job_opening_id);
      setSource(application.source ?? 'manual');
      setNotes(application.notes ?? '');
      setStage(application.stage);
      setRejectedReason(application.rejected_reason ?? '');
      // Load signed URL for CV
      if (application.resume_path) {
        getApplicationResumeSignedUrl(application.resume_path)
          .then(setCvUrl)
          .catch(() => setCvUrl(null));
      }
    } else {
      setCand({});
      setJobOpeningId(defaultJobOpeningId ?? '');
      setSource('manual');
      setNotes('');
      setStage('novo');
      setRejectedReason('');
    }
  }, [open, application, defaultJobOpeningId]);

  async function handleSave() {
    if (!cand.full_name?.trim()) {
      setError('Nome é obrigatório.');
      setTab('candidato');
      return;
    }
    if (!cand.email?.trim()) {
      setError('E-mail é obrigatório.');
      setTab('candidato');
      return;
    }
    if (!jobOpeningId) {
      setError('Selecione uma vaga.');
      setTab('pipeline');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // 1) Upsert do candidato por email
      const candidate = await upsertCandidateByEmail({
        full_name: cand.full_name?.trim(),
        email: cand.email?.trim(),
        phone: cand.phone?.trim() || null,
        cpf: cand.cpf?.replace(/\D/g, '') || null,
        rg: cand.rg ?? null,
        cnh: cand.cnh ?? null,
        birth_date: cand.birth_date ?? null,
        linkedin_url: cand.linkedin_url?.trim() || null,
        portfolio_url: cand.portfolio_url?.trim() || null,
      });

      let appId: string;
      if (application) {
        await updateJobApplication(application.id, {
          stage,
          source: source || null,
          notes: notes || null,
          rejected_reason: stage === 'descartado' ? (rejectedReason || null) : null,
        });
        appId = application.id;
        logAudit({
          action: 'update', module: 'rh-seletivo', recordId: appId,
          description: `Candidatura atualizada: ${candidate.full_name} → ${stage}`,
        });
      } else {
        const created = await createJobApplication({
          job_opening_id: jobOpeningId,
          candidate_id: candidate.id,
          stage,
          source: source || null,
          notes: notes || null,
        });
        appId = created.id;
        logAudit({
          action: 'create', module: 'rh-seletivo', recordId: appId,
          description: `Candidatura criada: ${candidate.full_name}`,
        });
      }

      // 2) Upload de CV, se houver
      if (cvFile) {
        setUploadingCv(true);
        await uploadApplicationResume(appId, cvFile);
        setUploadingCv(false);
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
      setUploadingCv(false);
      setError(e instanceof Error ? e.message : 'Erro ao salvar candidatura.');
    }
  }

  async function handleDelete() {
    if (!application) return;
    if (!confirm(`Excluir candidatura de "${application.candidate?.full_name ?? 'candidato'}"? O cadastro do candidato permanecerá.`)) return;
    setSaving(true);
    try {
      await deleteJobApplication(application.id);
      logAudit({
        action: 'delete', module: 'rh-seletivo', recordId: application.id,
        description: `Candidatura excluída`,
      });
      onSaved();
      onClose();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  }

  async function handleDeleteCandidate() {
    if (!application?.candidate) return;
    if (!confirm(`Excluir definitivamente o candidato "${application.candidate.full_name}" e TODAS as candidaturas dele?`)) return;
    setSaving(true);
    try {
      await deleteCandidate(application.candidate.id);
      logAudit({
        action: 'delete', module: 'rh-seletivo', recordId: application.candidate.id,
        description: `Candidato excluído: ${application.candidate.full_name}`,
      });
      onSaved();
      onClose();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Erro ao excluir candidato.');
    }
  }

  async function handleMoveStage(next: ApplicationStage) {
    if (!application) return;
    if (next === application.stage) return;
    if (next === 'descartado') {
      setStage('descartado');
      setTab('pipeline');
      return;
    }
    setSaving(true);
    try {
      await moveApplicationStage(application.id, next);
      logAudit({
        action: 'update', module: 'rh-seletivo', recordId: application.id,
        description: `Estágio alterado para ${next}`,
      });
      onSaved();
      setStage(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao mover candidatura.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Executa o agente `resume_screener`:
   * 1. Baixa o PDF via signed URL (ou usa o arquivo local se ainda não foi salvo).
   * 2. Extrai texto client-side com pdfjs-dist.
   * 3. Chama ai-orchestrator com { job_title, job_requirements, resume_text }.
   * 4. Faz UPDATE em job_applications (score/summary/payload/screened_at).
   */
  async function handleAnalyzeWithAi() {
    if (!application) return;
    setAnalyzeError('');
    setAnalyzing(true);
    try {
      // 1) Conseguir o PDF
      let pdfSource: File | Blob | ArrayBuffer;
      if (cvFile) {
        pdfSource = cvFile;
      } else if (application.resume_path) {
        const signed = cvUrl ?? (await getApplicationResumeSignedUrl(application.resume_path));
        const res = await fetch(signed);
        if (!res.ok) throw new Error(`Falha ao baixar CV (HTTP ${res.status})`);
        pdfSource = await res.blob();
      } else {
        throw new Error('Anexe um currículo antes de analisar.');
      }

      // 2) Extrair texto
      const { text, truncated } = await extractPdfText(pdfSource);
      if (!text.trim()) throw new Error('Não foi possível extrair texto do PDF (pode ser um PDF escaneado).');

      // 3) Buscar dados da vaga
      const job = application.job_opening ?? jobs.find((j) => j.id === application.job_opening_id);
      const jobTitle = job?.title ?? 'Vaga sem título';
      const jobReqs = (application.job_opening as { requirements?: string } | undefined)?.requirements
        ?? jobs.find((j) => j.id === application.job_opening_id)?.requirements
        ?? '(nenhum requisito cadastrado)';

      // 4) Chamar ai-orchestrator
      const { data, error: invErr } = await supabase.functions.invoke('ai-orchestrator', {
        body: {
          agent_slug: 'resume_screener',
          context: {
            job_title: jobTitle,
            job_requirements: jobReqs,
            resume_text: text,
          },
        },
      });
      if (invErr) throw invErr;
      const rawText = (data as { text?: string })?.text ?? '';
      let parsed: {
        score_0_100?: number;
        pros?: string[];
        cons?: string[];
        recommendation?: string;
        reasoning?: string;
      };
      try {
        // O modelo pode retornar JSON com ou sem cercas ```
        const cleaned = rawText.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error('O agente retornou um JSON inválido. Tente novamente.');
      }

      const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score_0_100 ?? 0))));
      const summary = parsed.reasoning?.trim() || null;

      // 5) Persistir
      await updateJobApplication(application.id, {
        screener_score: score,
        screener_summary: summary,
        screener_payload: {
          pros: parsed.pros ?? [],
          cons: parsed.cons ?? [],
          recommendation: parsed.recommendation ?? null,
          reasoning: parsed.reasoning ?? null,
          truncated,
        },
        screened_at: new Date().toISOString(),
      });
      logAudit({
        action: 'update', module: 'rh-seletivo', recordId: application.id,
        description: `Triagem IA executada (score ${score}/100)`,
      });
      onSaved();
      setTab('triagem');
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Erro ao analisar currículo.');
    } finally {
      setAnalyzing(false);
    }
  }

  const screener = application?.screener_payload as
    | { pros?: string[]; cons?: string[]; recommendation?: string; reasoning?: string }
    | null;

  const tabs: { key: TabKey; label: string; icon: typeof UserCircle2 }[] = [
    { key: 'candidato', label: 'Candidato', icon: UserCircle2 },
    { key: 'cv',        label: 'Currículo', icon: FileText },
    ...(!isNew ? [{ key: 'triagem' as const,  label: 'Análise IA', icon: Sparkles }] : []),
    { key: 'pipeline',  label: 'Pipeline',  icon: ClipboardList },
  ];

  const title = isNew
    ? 'Nova candidatura'
    : application!.candidate?.full_name ?? 'Candidato';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      icon={UserCircle2}
      width="w-[640px]"
      badge={application ? (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${STAGE_COLOR[application.stage]}`}>
          {STAGE_LABEL[application.stage]}
        </span>
      ) : null}
      footer={(
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-2 text-xs font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Candidatura
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
            {saving || uploadingCv ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <UserCircle2 className="w-4 h-4" />}
            {uploadingCv ? 'Enviando CV…' : saving ? 'Salvando…' : saved ? 'Salvo!' : isNew ? 'Criar candidatura' : 'Salvar alterações'}
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

      {/* ── Candidato ─────────────────────────────────────────────── */}
      {tab === 'candidato' && (
        <DrawerCard title="Dados do candidato" icon={UserCircle2}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nome completo *</label>
              <input
                type="text"
                value={cand.full_name ?? ''}
                onChange={(e) => setCand((c) => ({ ...c, full_name: e.target.value }))}
                className={inputCls}
                placeholder="Maria da Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><Mail className="w-3 h-3 inline mr-1" />E-mail *</label>
                <input
                  type="email"
                  value={cand.email ?? ''}
                  onChange={(e) => setCand((c) => ({ ...c, email: e.target.value }))}
                  className={inputCls}
                  placeholder="maria@email.com"
                />
              </div>
              <div>
                <label className={labelCls}><Phone className="w-3 h-3 inline mr-1" />Telefone</label>
                <input
                  type="tel"
                  value={cand.phone ?? ''}
                  onChange={(e) => setCand((c) => ({ ...c, phone: maskPhone(e.target.value) }))}
                  className={inputCls}
                  placeholder="(81) 99999-9999"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><Linkedin className="w-3 h-3 inline mr-1" />LinkedIn</label>
                <input
                  type="url"
                  value={cand.linkedin_url ?? ''}
                  onChange={(e) => setCand((c) => ({ ...c, linkedin_url: e.target.value || null }))}
                  className={inputCls}
                  placeholder="linkedin.com/in/…"
                />
              </div>
              <div>
                <label className={labelCls}><Globe className="w-3 h-3 inline mr-1" />Portfolio</label>
                <input
                  type="url"
                  value={cand.portfolio_url ?? ''}
                  onChange={(e) => setCand((c) => ({ ...c, portfolio_url: e.target.value || null }))}
                  className={inputCls}
                  placeholder="https://…"
                />
              </div>
            </div>
            {!isNew && application?.candidate && (
              <button
                type="button"
                onClick={handleDeleteCandidate}
                disabled={saving}
                className="w-full mt-2 px-3 py-2 text-xs font-medium rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-transparent text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir candidato e todas as candidaturas
              </button>
            )}
          </div>
        </DrawerCard>
      )}

      {/* ── CV ───────────────────────────────────────────────────── */}
      {tab === 'cv' && (
        <DrawerCard title="Currículo (PDF)" icon={FileText}>
          <div className="space-y-3">
            {cvUrl ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white">
                  <iframe
                    src={cvUrl}
                    className="w-full h-[420px]"
                    title="Currículo do candidato"
                  />
                </div>
                <a
                  href={cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary dark:text-brand-secondary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir em nova aba
                </a>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nenhum currículo anexado ainda.
              </p>
            )}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <label className={labelCls}>
                {cvUrl ? 'Substituir currículo' : 'Anexar currículo'}
              </label>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 cursor-pointer hover:border-brand-primary transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                  {cvFile ? cvFile.name : 'Selecionar arquivo PDF…'}
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-[11px] text-gray-400 mt-1">
                O upload ocorre ao salvar. Máx. 10 MB.
              </p>
            </div>
          </div>
        </DrawerCard>
      )}

      {/* ── Análise IA (screener) ─────────────────────────────────── */}
      {tab === 'triagem' && application && (
        <DrawerCard title="Análise do agente de triagem" icon={Sparkles}>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleAnalyzeWithAi}
              disabled={analyzing || (!application.resume_path && !cvFile)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {analyzing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing
                ? 'Analisando…'
                : application.screened_at ? 'Reanalisar com IA' : 'Analisar com IA'}
            </button>
            {application.screened_at && (
              <span className="text-[11px] text-gray-400">
                Última análise: {new Date(application.screened_at).toLocaleString('pt-BR')}
              </span>
            )}
          </div>
          {analyzeError && (
            <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl px-3 py-2">
              {analyzeError}
            </div>
          )}
          {!application.screened_at ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Candidatura ainda não passou pela triagem IA. Anexe o currículo (PDF) e clique em
              <strong> Analisar com IA</strong> para que o agente <code>resume_screener</code> pontue
              a compatibilidade com os requisitos da vaga.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Score</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-brand-primary dark:text-brand-secondary">
                      {application.screener_score ?? '—'}
                    </span>
                    <span className="text-xs text-gray-400">/100</span>
                  </div>
                </div>
                {screener?.recommendation && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    screener.recommendation === 'hire' || screener.recommendation === 'avancar'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}>
                    {screener.recommendation}
                  </span>
                )}
              </div>
              {application.screener_summary && (
                <div>
                  <div className={labelCls}>Resumo</div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {application.screener_summary}
                  </p>
                </div>
              )}
              {screener?.pros && screener.pros.length > 0 && (
                <div>
                  <div className={labelCls}>Pontos fortes</div>
                  <ul className="list-disc pl-4 text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                    {screener.pros.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              {screener?.cons && screener.cons.length > 0 && (
                <div>
                  <div className={labelCls}>Pontos de atenção</div>
                  <ul className="list-disc pl-4 text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                    {screener.cons.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DrawerCard>
      )}

      {/* ── Pipeline ─────────────────────────────────────────────── */}
      {tab === 'pipeline' && (
        <DrawerCard title="Candidatura e pipeline" icon={ClipboardList}>
          <div className="space-y-3">
            <SelectDropdown
              label="Vaga *"
              value={jobOpeningId}
              onChange={(e) => setJobOpeningId(e.target.value)}
              disabled={!isNew}
            >
              <option value="">Selecione…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}{j.department ? ` — ${j.department}` : ''}
                </option>
              ))}
            </SelectDropdown>
            <div>
              <label className={labelCls}>Origem</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className={inputCls}
                placeholder="site, indicação, linkedin, manual…"
              />
            </div>

            {!isNew && application && (
              <div>
                <div className={labelCls}>Mover para estágio</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {STAGE_ORDER.map((s) => {
                    const active = application.stage === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleMoveStage(s)}
                        disabled={saving || active}
                        className={`px-2 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-colors flex items-center justify-center gap-1 ${
                          active
                            ? `${STAGE_COLOR[s]} ring-2 ring-brand-primary`
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {s === 'contratado' && <Briefcase className="w-3 h-3" />}
                        {s === 'descartado' && <XCircle className="w-3 h-3" />}
                        {STAGE_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Ao mover para <strong>Contratado</strong>, o sistema cria automaticamente o colaborador em <code>staff</code>.
                </p>
              </div>
            )}

            {stage === 'descartado' && (
              <div>
                <label className={labelCls}>Motivo do descarte</label>
                <textarea
                  value={rejectedReason}
                  onChange={(e) => setRejectedReason(e.target.value)}
                  className={`${inputCls} min-h-[60px] resize-y`}
                  placeholder="Perfil não aderente, já tem emprego, fora da faixa salarial…"
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Notas internas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${inputCls} min-h-[80px] resize-y`}
                placeholder="Anotações da equipe sobre este candidato…"
              />
            </div>

            {application?.hired_staff_id && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5" />
                Colaborador criado em staff · ID <code className="font-mono">{application.hired_staff_id.slice(0, 8)}</code>
              </div>
            )}
          </div>
        </DrawerCard>
      )}
    </Drawer>
  );
}
