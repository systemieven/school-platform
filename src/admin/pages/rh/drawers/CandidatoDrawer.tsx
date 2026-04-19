import { useEffect, useRef, useState } from 'react';
import {
  UserCircle2, FileText, ClipboardList, Sparkles, Upload, Check, Loader2,
  Trash2, ExternalLink, Mail, Phone, Linkedin, Globe, Briefcase, XCircle,
  FileSearch, MessagesSquare, MessageCircle, AlertTriangle, Award, MapPin,
  Calendar,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { SelectDropdown } from '../../../components/FormField';
import { supabase } from '../../../../lib/supabase';
import { logAudit } from '../../../../lib/audit';
import { renderInline } from '../../../../lib/renderInline';
import {
  upsertCandidateByEmail, deleteCandidate, type CandidateInput,
} from '../../../hooks/useCandidates';
import {
  createJobApplication, updateJobApplication, deleteJobApplication,
  moveApplicationStage, uploadApplicationResume, getApplicationResumeSignedUrl,
  STAGE_ORDER, STAGE_LABEL, STAGE_COLOR,
  type ApplicationStage, type JobApplicationWithRelations,
} from '../../../hooks/useJobApplications';
import { useJobOpenings, JOB_AREA_LABELS, type JobArea } from '../../../hooks/useJobOpenings';
import { useCepLookup } from '../../../hooks/useCepLookup';

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
function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
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

type TabKey = 'candidato' | 'cv' | 'extracao' | 'entrevista' | 'chat' | 'pipeline';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

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

  // Área (quando criar manualmente ou editar reserva)
  const [area, setArea] = useState<JobArea>('administrativa');

  // CEP → preenche endereço automaticamente via ViaCEP.
  const { lookup: lookupCep, loading: cepLoading } = useCepLookup();
  async function handleCepBlur(raw: string) {
    const addr = await lookupCep(raw);
    if (!addr) return;
    setCand((c) => ({
      ...c,
      address_street: addr.logradouro || c.address_street || null,
      address_neighborhood: addr.bairro || c.address_neighborhood || null,
      address_city: addr.municipio || c.address_city || null,
      address_state: addr.uf || c.address_state || null,
      address_zip: addr.cep || c.address_zip || null,
    }));
  }

  // Campos obrigatórios pra promover pra staff na contratação.
  const missingForHire = (() => {
    const missing: string[] = [];
    if (!cand.address_street) missing.push('endereço');
    if (!cand.address_city) missing.push('cidade');
    if (!cand.address_state) missing.push('UF');
    if (!cand.address_zip) missing.push('CEP');
    if (!cand.birth_date) missing.push('data de nascimento');
    return missing;
  })();
  const showHireGap = (stage === 'proposta' || stage === 'contratado') && missingForHire.length > 0;

  // Histórico do chat de pré-triagem (read-only para admin).
  const [chat, setChat] = useState<ChatMessage[] | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Double-click confirm para exclusões (evita window.confirm que quebra a
  // identidade visual do app). `armed` = estado "armado, aguardando 2º clique".
  // Auto-desarma em 3s se não houver 2º clique.
  const [confirmDeleteApp, setConfirmDeleteApp] = useState(false);
  const [confirmDeleteCand, setConfirmDeleteCand] = useState(false);
  const confirmAppTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmCandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNew = !application;

  useEffect(() => {
    if (!open) return;
    setTab('candidato');
    setError('');
    setSaved(false);
    setCvFile(null);
    setCvUrl(null);
    if (application) {
      const c = application.candidate;
      setCand(c ? {
        full_name: c.full_name, email: c.email, phone: c.phone, cpf: c.cpf,
        rg: c.rg, cnh: c.cnh, birth_date: c.birth_date,
        linkedin_url: c.linkedin_url, portfolio_url: c.portfolio_url,
        address_street: c.address_street, address_number: c.address_number,
        address_complement: c.address_complement, address_neighborhood: c.address_neighborhood,
        address_city: c.address_city, address_state: c.address_state,
        address_zip: c.address_zip,
      } : {});
      setJobOpeningId(application.job_opening_id ?? '');
      setArea(application.area);
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
      // #12: se há vaga pré-selecionada, herda a área dela; senão cai em 'administrativa'.
      const preselectedJob = defaultJobOpeningId
        ? jobs.find((j) => j.id === defaultJobOpeningId)
        : null;
      setArea(preselectedJob?.area ?? 'administrativa');
      setSource('manual');
      setNotes('');
      setStage('novo');
      setRejectedReason('');
    }
    setChat(null);
    setChatError(null);
    setConfirmDeleteApp(false);
    setConfirmDeleteCand(false);
    if (confirmAppTimer.current) clearTimeout(confirmAppTimer.current);
    if (confirmCandTimer.current) clearTimeout(confirmCandTimer.current);
  }, [open, application, defaultJobOpeningId, jobs]);

  // #11: carrega histórico do chat de pré-triagem quando a aba "Chat" abre.
  useEffect(() => {
    if (tab !== 'chat' || !application?.pre_screening_session_id) return;
    if (chat !== null || chatLoading) return;
    setChatLoading(true);
    setChatError(null);
    supabase
      .from('pre_screening_sessions')
      .select('messages')
      .eq('id', application.pre_screening_session_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setChatError(error.message);
        else setChat(Array.isArray(data?.messages) ? (data!.messages as ChatMessage[]) : []);
      })
      .then(() => setChatLoading(false), () => setChatLoading(false));
  }, [tab, application, chat, chatLoading]);

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
    // Vaga é opcional (cadastro reserva permite job_opening_id null).
    const targetJobId = jobOpeningId || null;
    // Área é obrigatória (fonte do kanban).
    if (!area) {
      setError('Selecione uma área.');
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
        address_street: cand.address_street?.trim() || null,
        address_number: cand.address_number?.trim() || null,
        address_complement: cand.address_complement?.trim() || null,
        address_neighborhood: cand.address_neighborhood?.trim() || null,
        address_city: cand.address_city?.trim() || null,
        address_state: cand.address_state?.trim() || null,
        address_zip: cand.address_zip?.replace(/\D/g, '') || null,
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
          job_opening_id: targetJobId,
          candidate_id: candidate.id,
          area,
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
    // Double-click pattern: 1º arma, 2º executa.
    if (!confirmDeleteApp) {
      setConfirmDeleteApp(true);
      if (confirmAppTimer.current) clearTimeout(confirmAppTimer.current);
      confirmAppTimer.current = setTimeout(() => setConfirmDeleteApp(false), 3000);
      return;
    }
    if (confirmAppTimer.current) clearTimeout(confirmAppTimer.current);
    setConfirmDeleteApp(false);
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
    if (!confirmDeleteCand) {
      setConfirmDeleteCand(true);
      if (confirmCandTimer.current) clearTimeout(confirmCandTimer.current);
      confirmCandTimer.current = setTimeout(() => setConfirmDeleteCand(false), 3000);
      return;
    }
    if (confirmCandTimer.current) clearTimeout(confirmCandTimer.current);
    setConfirmDeleteCand(false);
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

  // Leitura dos payloads gerados automaticamente pelo fluxo /trabalhe-conosco.
  const extracted = (application?.extracted_payload ?? null) as Record<string, unknown> | null;
  const interview = (application?.interview_payload ?? null) as {
    disc_profile?: { dominant?: string; scores?: Record<string, number>; notes?: string };
    star_scores?: { situation?: number; task?: number; action?: number; result?: number; notes?: string };
    fit_summary?: { pros?: string[]; cons?: string[]; recommendation?: string };
    availability?: string | null;
    salary_expectation?: string | null;
  } | null;
  const screener = application?.screener_payload as
    | { pros?: string[]; cons?: string[]; recommendation?: string; score?: number; summary?: string }
    | null;

  const hasChat = !!application?.pre_screening_session_id;
  const tabs: { key: TabKey; label: string; icon: typeof UserCircle2 }[] = [
    { key: 'candidato', label: 'Candidato', icon: UserCircle2 },
    { key: 'cv',        label: 'Currículo', icon: FileText },
    ...(!isNew ? [{ key: 'extracao'   as const, label: 'Extração',   icon: FileSearch }] : []),
    ...(!isNew ? [{ key: 'entrevista' as const, label: 'Entrevista', icon: Sparkles }] : []),
    ...(hasChat ? [{ key: 'chat' as const, label: 'Chat', icon: MessageCircle }] : []),
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
              title="Remove somente esta candidatura (mantém o cadastro do candidato para outras vagas)."
              className={`px-3 py-2 text-xs font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                confirmDeleteApp
                  ? 'bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-300 dark:ring-red-700'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
              }`}
            >
              {confirmDeleteApp
                ? <><AlertTriangle className="w-3.5 h-3.5" /> Confirmar exclusão?</>
                : <><Trash2 className="w-3.5 h-3.5" /> Candidatura</>
              }
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
        <>
        {showHireGap && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Faltam dados pra efetivar contratação: <strong>{missingForHire.join(', ')}</strong>.
            </span>
          </div>
        )}
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
            <div>
              <label className={labelCls}><Calendar className="w-3 h-3 inline mr-1" />Data de nascimento</label>
              <input
                type="date"
                value={cand.birth_date ?? ''}
                onChange={(e) => setCand((c) => ({ ...c, birth_date: e.target.value || null }))}
                className={inputCls}
              />
            </div>
            {!isNew && application?.candidate && (
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  onClick={handleDeleteCandidate}
                  disabled={saving}
                  title="Remove o cadastro do candidato e TODAS as candidaturas dele (ação permanente, afeta outras vagas)."
                  className={`w-full px-3 py-2 text-xs font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                    confirmDeleteCand
                      ? 'bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-300 dark:ring-red-700 border border-red-700'
                      : 'border border-red-200 dark:border-red-800 bg-white dark:bg-transparent text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}
                >
                  {confirmDeleteCand
                    ? <><AlertTriangle className="w-3.5 h-3.5" /> Clique novamente para confirmar exclusão permanente</>
                    : <><Trash2 className="w-3.5 h-3.5" /> Excluir candidato e todas as candidaturas</>
                  }
                </button>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                  Apaga o cadastro completo do candidato em todas as vagas.
                </p>
              </div>
            )}
          </div>
        </DrawerCard>
        <DrawerCard title="Endereço" icon={MapPin}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>CEP</label>
              <div className="relative">
                <input
                  type="text"
                  value={cand.address_zip ? maskCep(cand.address_zip) : ''}
                  onChange={(e) => setCand((c) => ({ ...c, address_zip: e.target.value.replace(/\D/g, '') || null }))}
                  onBlur={(e) => handleCepBlur(e.target.value)}
                  className={inputCls}
                  placeholder="00000-000"
                />
                {cepLoading && (
                  <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>Logradouro</label>
              <input
                type="text"
                value={cand.address_street ?? ''}
                onChange={(e) => setCand((c) => ({ ...c, address_street: e.target.value || null }))}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Número</label>
                <input
                  type="text"
                  value={cand.address_number ?? ''}
                  onChange={(e) => setCand((c) => ({ ...c, address_number: e.target.value || null }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Complemento</label>
                <input
                  type="text"
                  value={cand.address_complement ?? ''}
                  onChange={(e) => setCand((c) => ({ ...c, address_complement: e.target.value || null }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Bairro</label>
              <input
                type="text"
                value={cand.address_neighborhood ?? ''}
                onChange={(e) => setCand((c) => ({ ...c, address_neighborhood: e.target.value || null }))}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-[1fr,80px] gap-3">
              <div>
                <label className={labelCls}>Cidade</label>
                <input
                  type="text"
                  value={cand.address_city ?? ''}
                  onChange={(e) => setCand((c) => ({ ...c, address_city: e.target.value || null }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>UF</label>
                <input
                  type="text"
                  maxLength={2}
                  value={cand.address_state ?? ''}
                  onChange={(e) => setCand((c) => ({ ...c, address_state: e.target.value.toUpperCase() || null }))}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </DrawerCard>
        </>
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

      {/* ── Extração do CV (read-only, preenchido pelo agente resume_extractor) ── */}
      {tab === 'extracao' && application && !extracted && (
        <DrawerCard title="Dados extraídos do currículo" icon={FileSearch}>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            A extração do CV é feita automaticamente quando o candidato se inscreve via
            /trabalhe-conosco. Se este candidato veio de cadastro manual, anexe o currículo e
            a extração será executada no próximo salvamento.
          </p>
        </DrawerCard>
      )}
      {tab === 'extracao' && application && extracted && (
        <>
          {/* Card 1 — Resumo (inclui summary, formação, experiência e score do screener) */}
          <DrawerCard title="Resumo" icon={FileSearch}>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {typeof extracted.summary === 'string' && extracted.summary.trim() ? (
                <div>
                  <div className={labelCls}>Resumo profissional</div>
                  <p className="whitespace-pre-wrap">{String(extracted.summary)}</p>
                </div>
              ) : null}
              {Array.isArray(extracted.education) && extracted.education.length > 0 && (
                <div>
                  <div className={labelCls}>Formação</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {(extracted.education as unknown[]).map((e, i) => (
                      <li key={i}>
                        {typeof e === 'string'
                          ? e
                          : JSON.stringify(e)
                              .replace(/[{}"]/g, '')
                              .replace(/,/g, ' · ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(extracted.experience) && extracted.experience.length > 0 && (
                <div>
                  <div className={labelCls}>Experiência</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {(extracted.experience as unknown[]).map((e, i) => (
                      <li key={i}>
                        {typeof e === 'string'
                          ? e
                          : JSON.stringify(e)
                              .replace(/[{}"]/g, '')
                              .replace(/,/g, ' · ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {screener?.score !== undefined && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className={labelCls}>Score vs. vaga (resume_screener)</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-brand-primary dark:text-brand-secondary">
                      {screener.score ?? '—'}
                    </span>
                    <span className="text-xs text-gray-400">/100</span>
                  </div>
                  {screener.summary && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{screener.summary}</p>
                  )}
                </div>
              )}
            </div>
          </DrawerCard>

          {/* Card 2 — Habilidades (tags) */}
          <DrawerCard title="Habilidades" icon={Award}>
            {Array.isArray(extracted.skills) && extracted.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {(extracted.skills as string[]).map((s, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-[11px] bg-brand-primary/5 dark:bg-brand-secondary/10 border border-brand-primary/15 dark:border-brand-secondary/20 text-gray-700 dark:text-gray-200">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nenhuma habilidade extraída do currículo.
              </p>
            )}
          </DrawerCard>
        </>
      )}

      {/* ── Entrevista (read-only, pre_screening_interviewer) ──── */}
      {tab === 'entrevista' && application && (
        <>
          {/* Estados especiais (sem payload ainda) */}
          {!application.interview_report && !interview && (
            <DrawerCard title="Entrevista de pré-candidatura" icon={Sparkles}>
              {application.pre_screening_status === 'running' ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Entrevista em andamento — o candidato ainda está respondendo.
                </div>
              ) : application.pre_screening_status === 'abandoned' ? (
                <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  O candidato não concluiu a entrevista (sessão expirada ou abandonada).
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  A entrevista é conduzida automaticamente pelo agente
                  <code> pre_screening_interviewer </code> após o candidato enviar o currículo em
                  /trabalhe-conosco. Quando finalizar, o relatório e o payload estruturado aparecem aqui.
                </p>
              )}
            </DrawerCard>
          )}

          {/* Card 1 — Payload estruturado da pré-candidatura */}
          {interview && (
            <DrawerCard title="Entrevista de pré-candidatura" icon={Sparkles}>
              {application.pre_screening_status === 'running' && (
                <div className="mb-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Entrevista em andamento — o candidato ainda está respondendo.
                </div>
              )}
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                {interview.fit_summary?.recommendation && (
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                      interview.fit_summary.recommendation === 'avancar'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : interview.fit_summary.recommendation === 'considerar'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      Recomendação: {interview.fit_summary.recommendation}
                    </span>
                  </div>
                )}
                {interview.disc_profile && (
                  <div>
                    <div className={labelCls}>Perfil DISC</div>
                    <div className="flex gap-2 items-baseline mb-1">
                      <span className="text-2xl font-bold text-brand-primary dark:text-brand-secondary">
                        {interview.disc_profile.dominant ?? '—'}
                      </span>
                      <span className="text-xs text-gray-400">(dominante)</span>
                    </div>
                    {interview.disc_profile.scores && (
                      <div className="flex gap-3 text-xs">
                        {(['D','I','S','C'] as const).map((k) => (
                          <span key={k}>
                            <span className="font-semibold">{k}:</span> {interview.disc_profile!.scores![k] ?? '—'}
                          </span>
                        ))}
                      </div>
                    )}
                    {interview.disc_profile.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{interview.disc_profile.notes}</p>
                    )}
                  </div>
                )}
                {interview.star_scores && (
                  <div>
                    <div className={labelCls}>Exemplo STAR</div>
                    <div className="flex gap-3 text-xs">
                      {(['situation','task','action','result'] as const).map((k) => (
                        <span key={k}>
                          <span className="font-semibold capitalize">{k}:</span> {interview.star_scores![k] ?? '—'}/10
                        </span>
                      ))}
                    </div>
                    {interview.star_scores.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{interview.star_scores.notes}</p>
                    )}
                  </div>
                )}
                {interview.fit_summary?.pros && interview.fit_summary.pros.length > 0 && (
                  <div>
                    <div className={labelCls}>Pontos fortes</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {interview.fit_summary.pros.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {interview.fit_summary?.cons && interview.fit_summary.cons.length > 0 && (
                  <div>
                    <div className={labelCls}>Pontos de atenção</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {interview.fit_summary.cons.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {(interview.availability || interview.salary_expectation) && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                    {interview.availability && <div><strong>Disponibilidade:</strong> {interview.availability}</div>}
                    {interview.salary_expectation && <div><strong>Expectativa salarial:</strong> {interview.salary_expectation}</div>}
                  </div>
                )}
              </div>
            </DrawerCard>
          )}

          {/* Card 2 — Relatório completo em texto corrido */}
          {application.interview_report && (
            <DrawerCard title="Relatório completo" icon={MessagesSquare}>
              <pre className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                {application.interview_report}
              </pre>
            </DrawerCard>
          )}
        </>
      )}

      {/* ── Chat da pré-triagem (read-only) ──────────────────────── */}
      {tab === 'chat' && application && (
        <DrawerCard title="Conversa com a IA" icon={MessageCircle}>
          {chatLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando conversa…
            </div>
          ) : chatError ? (
            <p className="text-xs text-red-600 dark:text-red-400">Erro ao carregar: {chatError}</p>
          ) : !chat || chat.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ainda não há mensagens nesta pré-triagem.
            </p>
          ) : (
            <div className="space-y-2">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    m.role === 'assistant'
                      ? 'bg-brand-primary/5 dark:bg-brand-secondary/10 border border-brand-primary/15 dark:border-brand-secondary/20 text-gray-800 dark:text-gray-100'
                      : 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 ml-6'
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5 text-gray-400 dark:text-gray-500">
                    {m.role === 'assistant' ? 'Entrevistadora IA' : 'Candidato'}
                    {m.at && (
                      <span className="ml-2 normal-case font-normal">
                        {new Date(m.at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">
                    {m.role === 'assistant' ? renderInline(m.text) : m.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DrawerCard>
      )}

      {/* ── Pipeline ─────────────────────────────────────────────── */}
      {tab === 'pipeline' && (
        <DrawerCard title="Candidatura e pipeline" icon={ClipboardList}>
          <div className="space-y-3">
            <SelectDropdown
              label="Área *"
              value={area}
              onChange={(e) => setArea(e.target.value as JobArea)}
            >
              {(Object.keys(JOB_AREA_LABELS) as JobArea[]).map((k) => (
                <option key={k} value={k}>{JOB_AREA_LABELS[k]}</option>
              ))}
            </SelectDropdown>
            <SelectDropdown
              label="Vaga (opcional — deixe em branco para base reserva)"
              value={jobOpeningId}
              onChange={(e) => setJobOpeningId(e.target.value)}
              disabled={!isNew}
            >
              <option value="">— Base reserva —</option>
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
