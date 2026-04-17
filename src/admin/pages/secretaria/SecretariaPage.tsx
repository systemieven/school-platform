import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Heart, RefreshCw, ArrowRightLeft,
  PanelLeftClose, PanelLeftOpen,
  Check, Loader2, Trash2, Plus, X, Search, ChevronDown,
  ShieldCheck, HeartPulse, Stethoscope, AlertTriangle, Bell,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { SelectDropdown, SearchableSelect } from '../../components/FormField';
import type {
  DocumentTemplate,
  DocumentRequest,
  DocumentRequestStatus,
  DocumentType,
  StudentHealthRecord,
  StudentMedicalCertificate,
  HealthRecordUpdateRequest,
  HealthUpdateRequestStatus,
  MedicationEntry,
  EmergencyContact,
  BloodType,
  ReenrollmentCampaign,
  ReenrollmentCampaignStatus,
  ReenrollmentApplication,
  StudentTransfer,
  StudentTransferType,
  StudentTransferStatus,
} from '../../types/admin.types';
import {
  DOCUMENT_REQUEST_STATUS_LABELS,
  DOCUMENT_REQUEST_STATUS_COLORS,
  DOCUMENT_TYPE_LABELS,
  HEALTH_UPDATE_STATUS_LABELS,
  REENROLLMENT_CAMPAIGN_STATUS_LABELS,
  REENROLLMENT_CAMPAIGN_STATUS_COLORS,
  REENROLLMENT_APPLICATION_STATUS_LABELS,
  STUDENT_TRANSFER_TYPE_LABELS,
  STUDENT_TRANSFER_STATUS_LABELS,
} from '../../types/admin.types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(str: string | null | undefined): string {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('pt-BR');
}

const STATUS_COLOR_MAP: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  green:  'bg-emerald-100 text-emerald-700',
  red:    'bg-red-100 text-red-700',
  gray:   'bg-gray-100 text-gray-600',
};

function StatusBadge({ label, color }: { label: string; color: string }) {
  const cls = STATUS_COLOR_MAP[color] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</p>
    </div>
  );
}

// ── Tab 1: Declarações ─────────────────────────────────────────────────────────

interface TemplateDrawerState {
  open: boolean;
  editing: DocumentTemplate | null;
}

function TemplateDrawer({
  state,
  onClose,
  onSaved,
}: {
  state: TemplateDrawerState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!state.editing;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('declaracao_matricula');
  const [description, setDescription] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [htmlContent, setHtmlContent] = useState('');
  const [variablesRaw, setVariablesRaw] = useState('');

  useEffect(() => {
    if (state.open) {
      if (state.editing) {
        setName(state.editing.name);
        setDocumentType(state.editing.document_type);
        setDescription(state.editing.description ?? '');
        setRequiresApproval(state.editing.requires_approval);
        setIsActive(state.editing.is_active);
        setHtmlContent(state.editing.html_content);
        setVariablesRaw((state.editing.variables ?? []).join(', '));
      } else {
        setName('');
        setDocumentType('declaracao_matricula');
        setDescription('');
        setRequiresApproval(true);
        setIsActive(true);
        setHtmlContent('');
        setVariablesRaw('');
      }
      setSaved(false);
      setError('');
    }
  }, [state.open, state.editing]);

  async function handleSave() {
    if (!name.trim()) { setError('Nome obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        document_type: documentType,
        description: description.trim() || null,
        requires_approval: requiresApproval,
        is_active: isActive,
        html_content: htmlContent,
        variables: variablesRaw.split(',').map((v) => v.trim()).filter(Boolean),
      };
      const { error: saveError } = isEdit
        ? await supabase.from('document_templates').update(payload).eq('id', state.editing!.id)
        : await supabase.from('document_templates').insert(payload);
      if (saveError) throw saveError;
      setSaved(true);
      onSaved();
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!state.editing) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from('document_templates').delete().eq('id', state.editing.id);
      if (deleteError) throw deleteError;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao excluir');
    } finally {
      setSaving(false);
    }
  }

  const footer = isEdit ? (
    <div className="flex items-center gap-2">
      <button onClick={handleDelete} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
                   hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5">
        <Trash2 className="w-3.5 h-3.5" /> Excluir
      </button>
      <div className="flex-1" />
      <button onClick={onClose} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600
                   text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !name.trim()}
        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
      </button>
    </div>
  ) : (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300
                   hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !name.trim()}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Criar Template'}
      </button>
    </div>
  );

  return (
    <Drawer open={state.open} onClose={onClose}
      title={isEdit ? 'Editar Template' : 'Novo Template'}
      icon={FileText} width="w-[520px]" footer={footer}>
      <DrawerCard title="Informações" icon={FileText}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              placeholder="Ex: Declaração de Matrícula" />
          </div>
          <SelectDropdown label="Tipo de Documento" value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
            {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((k) => (
              <option key={k} value={k}>{DOCUMENT_TYPE_LABELS[k]}</option>
            ))}
          </SelectDropdown>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
              placeholder="Breve descrição do template" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Requer aprovação</span>
            <button onClick={() => setRequiresApproval(!requiresApproval)}
              className={`relative w-10 h-5 rounded-full transition-colors ${requiresApproval ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${requiresApproval ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Ativo</span>
            <button onClick={() => setIsActive(!isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Conteúdo HTML" icon={FileText}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">HTML do documento</label>
            <textarea value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)} rows={12}
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-y"
              placeholder="<html>...</html>" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Variáveis (separadas por vírgula)</label>
            <input value={variablesRaw} onChange={(e) => setVariablesRaw(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              placeholder="nome_completo, matricula, turma" />
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Variáveis disponíveis:{' '}
              {['{{nome_completo}}', '{{matricula}}', '{{turma}}', '{{serie}}', '{{ano_letivo}}', '{{data_emissao}}', '{{escola}}'].map((v) => (
                <code key={v} className="bg-gray-100 dark:bg-gray-700 rounded px-1 mr-1">{v}</code>
              ))}
            </p>
          </div>
        </div>
      </DrawerCard>
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mx-1">
          {error}
        </p>
      )}
    </Drawer>
  );
}

interface RejectModalProps {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function RejectModal({ open, onConfirm, onCancel, loading }: RejectModalProps) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3">Recusar solicitação</h3>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
          placeholder="Motivo da recusa (obrigatório)" />
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
            Cancelar
          </button>
          <button onClick={() => onConfirm(reason)} disabled={!reason.trim() || loading}
            className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
}

function SecretariaDeclaracoesTab() {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentRequestStatus | 'all'>('all');
  const [templateDrawer, setTemplateDrawer] = useState<TemplateDrawerState>({ open: false, editing: null });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null }>({ open: false, requestId: null });
  const [rejectLoading, setRejectLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { data, error } = await supabase
        .from('document_requests')
        .select('*, template:document_templates(name, document_type), student:students(full_name, enrollment_code)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data ?? []) as unknown as DocumentRequest[]);
    } catch (e: unknown) {
      setFetchError((e as Error).message ?? 'Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filtered = requests.filter((r) => {
    const nameMatch = !search || r.student?.full_name?.toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === 'all' || r.status === statusFilter;
    return nameMatch && statusMatch;
  });

  const kpi = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    generated: requests.filter((r) => r.status === 'generated').length,
    delivered: requests.filter((r) => r.status === 'delivered').length,
  };

  async function handleApprove(req: DocumentRequest) {
    setActionError('');
    setActionLoading(req.id);
    try {
      const { error: updError } = await supabase
        .from('document_requests')
        .update({ status: 'approved' })
        .eq('id', req.id);
      if (updError) throw updError;
      await supabase.functions.invoke('generate-document', { body: { request_id: req.id } });
      fetchRequests();
    } catch (e: unknown) {
      setActionError((e as Error).message ?? 'Erro ao aprovar');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeliver(req: DocumentRequest) {
    setActionError('');
    setActionLoading(req.id);
    try {
      const { error } = await supabase
        .from('document_requests')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw error;
      fetchRequests();
    } catch (e: unknown) {
      setActionError((e as Error).message ?? 'Erro ao marcar entrega');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectModal.requestId) return;
    setActionError('');
    setRejectLoading(true);
    try {
      const { error } = await supabase
        .from('document_requests')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', rejectModal.requestId);
      if (error) throw error;
      setRejectModal({ open: false, requestId: null });
      fetchRequests();
    } catch (e: unknown) {
      setActionError((e as Error).message ?? 'Erro ao recusar');
    } finally {
      setRejectLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {fetchError && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {fetchError}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Solicitações" value={kpi.total} />
        <KpiCard label="Aguardando" value={kpi.pending} />
        <KpiCard label="Geradas" value={kpi.generated} />
        <KpiCard label="Entregues" value={kpi.delivered} />
      </div>

      {actionError && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 w-52"
              placeholder="Buscar aluno…" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DocumentRequestStatus | 'all')}
              className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 appearance-none">
              <option value="all">Todos os status</option>
              {(Object.keys(DOCUMENT_REQUEST_STATUS_LABELS) as DocumentRequestStatus[]).map((s) => (
                <option key={s} value={s}>{DOCUMENT_REQUEST_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <button onClick={() => setTemplateDrawer({ open: true, editing: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors">
          <FileText className="w-4 h-4" /> Novo Template
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
            <tr>
              {['Data', 'Aluno', 'Matrícula', 'Documento', 'Tipo', 'Status', 'Ações'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Nenhuma solicitação encontrada</td></tr>
            ) : filtered.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{fmtDate(req.created_at)}</td>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{req.student?.full_name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{req.student?.enrollment_code ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{req.template?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {req.template?.document_type ? DOCUMENT_TYPE_LABELS[req.template.document_type] : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={DOCUMENT_REQUEST_STATUS_LABELS[req.status]}
                    color={DOCUMENT_REQUEST_STATUS_COLORS[req.status]}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {req.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(req)} disabled={actionLoading === req.id}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1">
                          {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Aprovar
                        </button>
                        <button onClick={() => setRejectModal({ open: true, requestId: req.id })}
                          className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    {req.status === 'generated' && (
                      <button onClick={() => handleDeliver(req)} disabled={actionLoading === req.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1">
                        {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Entregar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TemplateDrawer state={templateDrawer} onClose={() => setTemplateDrawer({ open: false, editing: null })} onSaved={fetchRequests} />
      <RejectModal
        open={rejectModal.open}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectModal({ open: false, requestId: null })}
        loading={rejectLoading}
      />
    </div>
  );
}

// ── Tab 2: Fichas de Saúde ─────────────────────────────────────────────────────

type HealthRecordWithStudent = StudentHealthRecord & {
  student: {
    id: string;
    full_name: string;
    class_id?: string | null;
    school_classes?: {
      id: string;
      name: string;
      segment_id: string;
      series_id: string;
      segment?: { id: string; name: string } | null;
      series?: { id: string; name: string } | null;
    } | null;
  } | null;
};

interface StudentOption { id: string; full_name: string; }

function HealthDrawer({
  record,
  studentOptions,
  open,
  onClose,
  onSaved,
}: {
  record: HealthRecordWithStudent | null;
  studentOptions: StudentOption[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!record;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [bloodType, setBloodType] = useState<BloodType | ''>('');
  const [healthPlan, setHealthPlan] = useState('');
  const [healthPlanNumber, setHealthPlanNumber] = useState('');
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergiesRaw, setAllergiesRaw] = useState('');
  const [allergyNotes, setAllergyNotes] = useState('');
  const [usesMedication, setUsesMedication] = useState(false);
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([{ name: '', phone: '', rel: '' }]);
  const [authorizedPhoto, setAuthorizedPhoto] = useState(false);
  const [authorizedFirstAid, setAuthorizedFirstAid] = useState(false);
  const [authorizedEvacuation, setAuthorizedEvacuation] = useState(false);

  useEffect(() => {
    if (open) {
      if (record) {
        setSelectedStudentId(record.student_id);
        setBloodType(record.blood_type ?? '');
        setHealthPlan(record.health_plan ?? '');
        setHealthPlanNumber(record.health_plan_number ?? '');
        setHasAllergies(record.has_allergies);
        setAllergiesRaw((record.allergies ?? []).join(', '));
        setAllergyNotes(record.allergy_notes ?? '');
        setUsesMedication(record.uses_medication);
        setMedications(record.medications ?? []);
        if (record.emergency_contacts && record.emergency_contacts.length > 0) {
          setEmergencyContacts(record.emergency_contacts);
        } else {
          setEmergencyContacts([{
            name:  record.emergency_contact_name  ?? '',
            phone: record.emergency_contact_phone ?? '',
            rel:   record.emergency_contact_rel   ?? '',
          }]);
        }
        setAuthorizedPhoto(record.authorized_photo);
        setAuthorizedFirstAid(record.authorized_first_aid);
        setAuthorizedEvacuation(record.authorized_evacuation);
      } else {
        setSelectedStudentId('');
        setBloodType('');
        setHealthPlan('');
        setHealthPlanNumber('');
        setHasAllergies(false);
        setAllergiesRaw('');
        setAllergyNotes('');
        setUsesMedication(false);
        setMedications([]);
        setEmergencyContacts([{ name: '', phone: '', rel: '' }]);
        setAuthorizedPhoto(false);
        setAuthorizedFirstAid(false);
        setAuthorizedEvacuation(false);
      }
      setSaved(false);
      setError('');
    }
  }, [open, record]);

  function addMedication() {
    setMedications((prev) => [...prev, { name: '', dose: '', frequency: '', instructions: '' }]);
  }

  function removeMedication(idx: number) {
    setMedications((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMedication(idx: number, field: keyof MedicationEntry, value: string) {
    setMedications((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  function addEmergencyContact() {
    setEmergencyContacts((prev) => [...prev, { name: '', phone: '', rel: '' }]);
  }
  function removeEmergencyContact(idx: number) {
    setEmergencyContacts((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateEmergencyContact(idx: number, field: keyof EmergencyContact, value: string) {
    setEmergencyContacts((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  async function handleSave() {
    const studentId = record?.student_id ?? selectedStudentId;
    if (!studentId) { setError('Selecione um aluno'); return; }
    setSaving(true);
    try {
      const payload = {
        student_id: studentId,
        blood_type: bloodType || null,
        health_plan: healthPlan.trim() || null,
        health_plan_number: healthPlanNumber.trim() || null,
        has_allergies: hasAllergies,
        allergies: hasAllergies ? allergiesRaw.split(',').map((v) => v.trim()).filter(Boolean) : null,
        allergy_notes: hasAllergies ? allergyNotes.trim() || null : null,
        uses_medication: usesMedication,
        medications: usesMedication ? medications : null,
        // Guarda array completo + mantém campos legados com o primeiro contato
        emergency_contacts: emergencyContacts.filter(c => c.name || c.phone),
        emergency_contact_name:  emergencyContacts[0]?.name.trim()  || null,
        emergency_contact_phone: emergencyContacts[0]?.phone.trim() || null,
        emergency_contact_rel:   emergencyContacts[0]?.rel.trim()   || null,
        authorized_photo: authorizedPhoto,
        authorized_first_aid: authorizedFirstAid,
        authorized_evacuation: authorizedEvacuation,
      };
      const { error: saveError } = record
        ? await supabase.from('student_health_records').update(payload).eq('id', record.id)
        : await supabase.from('student_health_records').upsert({ ...payload }, { onConflict: 'student_id' });
      if (saveError) throw saveError;
      setSaved(true);
      onSaved();
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!record) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from('student_health_records').delete().eq('id', record.id);
      if (deleteError) throw deleteError;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao excluir');
    } finally {
      setSaving(false);
    }
  }

  const bloodTypes: Array<BloodType | ''> = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const footer = isEdit ? (
    <div className="flex items-center gap-2">
      <button onClick={handleDelete} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
                   hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5">
        <Trash2 className="w-3.5 h-3.5" /> Excluir
      </button>
      <div className="flex-1" />
      <button onClick={onClose} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600
                   text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving}
        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
      </button>
    </div>
  ) : (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300
                   hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || (!record && !selectedStudentId)}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Criar Ficha'}
      </button>
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose}
      title={isEdit ? `Ficha: ${record?.student?.full_name ?? ''}` : 'Nova Ficha de Saúde'}
      icon={Heart} width="w-[520px]" footer={footer}>

      {!isEdit && (
        <DrawerCard title="Aluno" icon={Search}>
          <SearchableSelect
            label="Selecione o aluno *"
            value={selectedStudentId}
            onChange={(val) => setSelectedStudentId(val)}
            options={studentOptions.map((s) => ({ value: s.id, label: s.full_name }))}
            placeholder="Selecione o aluno..."
          />
        </DrawerCard>
      )}

      <DrawerCard title="Dados Básicos" icon={Heart}>
        <div className="space-y-3">
          <SelectDropdown label="Tipo Sanguíneo" value={bloodType} onChange={(e) => setBloodType(e.target.value as BloodType | '')}>
            {bloodTypes.map((bt) => <option key={bt} value={bt}>{bt || '— Não informado —'}</option>)}
          </SelectDropdown>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Plano de Saúde</label>
            <input value={healthPlan} onChange={(e) => setHealthPlan(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              placeholder="Nome do plano" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Número do Plano</label>
            <input value={healthPlanNumber} onChange={(e) => setHealthPlanNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              placeholder="Número da carteirinha" />
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Alergias" icon={Heart}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Possui alergias</span>
            <button onClick={() => setHasAllergies(!hasAllergies)}
              className={`relative w-10 h-5 rounded-full transition-colors ${hasAllergies ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasAllergies ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {hasAllergies && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Alergias (separadas por vírgula)</label>
                <input value={allergiesRaw} onChange={(e) => setAllergiesRaw(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  placeholder="Amendoim, Lactose, Penicilina" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observações sobre alergias</label>
                <textarea value={allergyNotes} onChange={(e) => setAllergyNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
                  placeholder="Reações anteriores, cuidados especiais…" />
              </div>
            </>
          )}
        </div>
      </DrawerCard>

      <DrawerCard title="Medicamentos" icon={Heart}
        headerExtra={
          usesMedication ? (
            <button onClick={addMedication}
              className="flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary-dark font-medium">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          ) : undefined
        }>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Usa medicamentos</span>
            <button onClick={() => setUsesMedication(!usesMedication)}
              className={`relative w-10 h-5 rounded-full transition-colors ${usesMedication ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${usesMedication ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {usesMedication && medications.map((med, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Medicamento {idx + 1}</span>
                <button onClick={() => removeMedication(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {(['name', 'dose', 'frequency', 'instructions'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-gray-400 mb-0.5">
                    {field === 'name' ? 'Nome' : field === 'dose' ? 'Dose' : field === 'frequency' ? 'Frequência' : 'Instruções'}
                  </label>
                  <input value={med[field]} onChange={(e) => updateMedication(idx, field, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </DrawerCard>

      <DrawerCard title="Contato de Emergência e Autorizações" icon={ShieldCheck}>
        <div className="space-y-3">

          {/* Lista de contatos de emergência */}
          {emergencyContacts.map((contact, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 overflow-hidden">
              {/* Header do contato */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-brand-primary/10 text-brand-primary text-[10px] font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex-1">
                  {idx === 0 ? 'Contato Principal' : `Contato ${idx + 1}`}
                </span>
                {emergencyContacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmergencyContact(idx)}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Remover contato"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Campos */}
              <div className="p-3 grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Contato</label>
                  <input
                    value={contact.name}
                    onChange={(e) => updateEmergencyContact(idx, 'name', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
                  <input
                    value={contact.phone}
                    onChange={(e) => updateEmergencyContact(idx, 'phone', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    placeholder="(81) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Parentesco</label>
                  <input
                    value={contact.rel}
                    onChange={(e) => updateEmergencyContact(idx, 'rel', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    placeholder="Mãe, Pai, Avó…"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Botão adicionar */}
          <button
            type="button"
            onClick={addEmergencyContact}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-primary border border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-primary/40 rounded-xl px-3 py-2 transition-colors w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            Adicionar contato de emergência
          </button>

          <div className="space-y-2 pt-1">
            {(
              [
                ['authorizedPhoto', 'Autoriza uso de imagem/foto', authorizedPhoto, setAuthorizedPhoto],
                ['authorizedFirstAid', 'Autoriza primeiros socorros', authorizedFirstAid, setAuthorizedFirstAid],
                ['authorizedEvacuation', 'Autoriza evacuação de emergência', authorizedEvacuation, setAuthorizedEvacuation],
              ] as Array<[string, string, boolean, React.Dispatch<React.SetStateAction<boolean>>]>
            ).map(([key, label, val, setter]) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </DrawerCard>
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mx-1">
          {error}
        </p>
      )}
    </Drawer>
  );
}

// ── Reject Health Request Modal ───────────────────────────────────────────────

function RejectHealthRequestModal({
  open,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3">Recusar solicitação de atualização</h3>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
          placeholder="Motivo da recusa (obrigatório)" />
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
          <button onClick={() => onConfirm(reason)} disabled={!reason.trim() || loading}
            className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Recusar
          </button>
        </div>
      </div>
    </div>
  );
}

function certStatus(validUntil: string): 'valid' | 'expiring_soon' | 'expired' {
  const today = new Date();
  const exp = new Date(validUntil);
  if (exp < today) return 'expired';
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return 'expiring_soon';
  return 'valid';
}

const HEALTH_UPDATE_STATUS_COLORS: Record<HealthUpdateRequestStatus, string> = {
  pending:   'yellow',
  confirmed: 'green',
  rejected:  'red',
};

function SecretariaFichasSaudeTab() {
  const [records, setRecords] = useState<HealthRecordWithStudent[]>([]);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecordWithStudent | null>(null);
  const [fetchError, setFetchError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sortAZ, setSortAZ] = useState(false);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; segment_id: string }[]>([]);

  // Filtros para sub-aba Atestados
  const [certSearch, setCertSearch] = useState('');
  const [certStatusFilter, setCertStatusFilter] = useState<'all' | 'valid' | 'expiring_soon' | 'expired'>('all');
  const [certSortAZ, setCertSortAZ] = useState(false);

  // New state for expanded sections
  const [activeSubTab, setActiveSubTab] = useState<'fichas' | 'atestados' | 'pendentes'>('fichas');
  const [certs, setCerts] = useState<StudentMedicalCertificate[]>([]);
  const [updateRequests, setUpdateRequests] = useState<HealthRecordUpdateRequest[]>([]);
  const [alertCerts, setAlertCerts] = useState<StudentMedicalCertificate[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null }>({ open: false, requestId: null });
  const [rejectLoading, setRejectLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const [healthRes, certsRes, reqRes] = await Promise.all([
        supabase
          .from('student_health_records')
          .select('*, student:students(id, full_name, class_id, school_classes(id, name, segment_id, series_id, segment:school_segments(id, name), series:school_series(id, name)))')
          .order('created_at', { ascending: false }),
        supabase
          .from('student_medical_certificates')
          .select('*, student:students(id, full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('health_record_update_requests')
          .select('*, student:students(id, full_name), guardian:guardian_profiles(id, name)')
          .order('created_at', { ascending: false }),
      ]);
      if (healthRes.error) throw healthRes.error;
      setRecords((healthRes.data ?? []) as unknown as HealthRecordWithStudent[]);

      const allCerts = (certsRes.data ?? []) as unknown as StudentMedicalCertificate[];
      setCerts(allCerts);

      // Compute alert certs: active certs expiring within 30 days or already expired
      const today = new Date();
      const alertDay = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      setAlertCerts(allCerts.filter((c) => c.is_active && new Date(c.valid_until) <= alertDay));

      const reqs = (reqRes.data ?? []) as unknown as HealthRecordUpdateRequest[];
      setUpdateRequests(reqs);
      setPendingCount(reqs.filter((r) => r.status === 'pending').length);
    } catch (e: unknown) {
      setFetchError((e as Error).message ?? 'Erro ao carregar fichas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudentOptions = useCallback(async () => {
    const { data } = await supabase.from('students').select('id, full_name').order('full_name');
    setStudentOptions((data ?? []) as StudentOption[]);
  }, []);

  const fetchFilterData = useCallback(async () => {
    const [segRes, clsRes] = await Promise.all([
      supabase.from('school_segments').select('id, name').order('name'),
      supabase.from('school_classes').select('id, name, segment_id').eq('is_active', true).order('name'),
    ]);
    setSegments((segRes.data ?? []) as { id: string; name: string }[]);
    setClasses((clsRes.data ?? []) as { id: string; name: string; segment_id: string }[]);
  }, []);

  useEffect(() => { fetchRecords(); fetchStudentOptions(); fetchFilterData(); }, [fetchRecords, fetchStudentOptions, fetchFilterData]);

  async function confirmRequest(id: string) {
    const { error } = await supabase
      .from('health_record_update_requests')
      .update({ status: 'confirmed', reviewed_by: (await supabase.auth.getUser()).data.user?.id ?? null })
      .eq('id', id);
    if (!error) fetchRecords();
  }

  async function rejectRequest(reason: string) {
    if (!rejectModal.requestId) return;
    setRejectLoading(true);
    const { error } = await supabase
      .from('health_record_update_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      .eq('id', rejectModal.requestId);
    setRejectLoading(false);
    if (!error) {
      setRejectModal({ open: false, requestId: null });
      fetchRecords();
    }
  }

  // Filtered + sorted records
  const filteredClasses = segmentFilter
    ? classes.filter((c) => c.segment_id === segmentFilter)
    : classes;

  const filteredRecords = records
    .filter((r) => {
      const name = r.student?.full_name?.toLowerCase() ?? '';
      if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
      if (segmentFilter && r.student?.school_classes?.segment_id !== segmentFilter) return false;
      if (classFilter && r.student?.class_id !== classFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortAZ) return 0;
      return (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? '', 'pt-BR');
    });

  const filteredCerts = certs
    .filter((c) => {
      const name = (c as unknown as { student?: { full_name?: string } }).student?.full_name?.toLowerCase() ?? '';
      const doctor = c.doctor_name?.toLowerCase() ?? '';
      if (certSearch && !name.includes(certSearch.toLowerCase()) && !doctor.includes(certSearch.toLowerCase())) return false;
      if (certStatusFilter !== 'all' && certStatus(c.valid_until) !== certStatusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (!certSortAZ) return 0;
      const na = (a as unknown as { student?: { full_name?: string } }).student?.full_name ?? '';
      const nb = (b as unknown as { student?: { full_name?: string } }).student?.full_name ?? '';
      return na.localeCompare(nb, 'pt-BR');
    });

  const kpi = {
    total: records.length,
    allergies: records.filter((r) => r.has_allergies).length,
    specialNeeds: records.filter((r) => r.has_special_needs).length,
  };

  return (
    <div className="space-y-5">
      {fetchError && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {fetchError}
        </p>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total de Fichas" value={kpi.total} />
        <KpiCard label="Com Alergias" value={kpi.allergies} />
        <KpiCard label="Necessidades Especiais" value={kpi.specialNeeds} />
        <KpiCard label="Atualizações Pendentes" value={pendingCount} />
      </div>

      {/* Alert panel */}
      {alertCerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
            <Bell className="w-4 h-4" />
            {alertCerts.filter((c) => certStatus(c.valid_until) === 'expired').length > 0 && (
              <span>{alertCerts.filter((c) => certStatus(c.valid_until) === 'expired').length} atestado(s) vencido(s)</span>
            )}
            {alertCerts.filter((c) => certStatus(c.valid_until) !== 'expired').length > 0 && (
              <span>{alertCerts.filter((c) => certStatus(c.valid_until) !== 'expired').length} vencendo em até 30 dias</span>
            )}
          </div>
          <div className="space-y-1">
            {alertCerts.slice(0, 5).map((cert) => {
              const status = certStatus(cert.valid_until);
              return (
                <div key={cert.id} className="flex items-center justify-between text-xs">
                  <span className="text-amber-800 dark:text-amber-300">
                    {(cert as unknown as { student?: { full_name?: string } }).student?.full_name ?? cert.student_id} — {cert.doctor_name}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {status === 'expired' ? 'Vencido' : `Vence ${fmtDate(cert.valid_until)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-50 dark:bg-gray-900 rounded-xl p-1">
        {([
          ['fichas', 'Fichas', HeartPulse],
          ['atestados', 'Atestados', Stethoscope],
          ['pendentes', `Atualizações${pendingCount > 0 ? ` (${pendingCount})` : ''}`, AlertTriangle],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveSubTab(key as 'fichas' | 'atestados' | 'pendentes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${activeSubTab === key ? 'bg-white dark:bg-gray-800 shadow text-brand-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Sub-tab: Fichas */}
      {activeSubTab === 'fichas' && (
        <>
          {/* Search + filters bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome do aluno…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

            {/* Segmento */}
            <div className="relative">
              <select
                value={segmentFilter}
                onChange={(e) => { setSegmentFilter(e.target.value); setClassFilter(''); }}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 min-w-[150px]"
              >
                <option value="">Todos os segmentos</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Série/Turma */}
            <div className="relative">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 min-w-[160px]"
              >
                <option value="">Todas as turmas</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Sort A-Z toggle */}
            <button
              onClick={() => setSortAZ((v) => !v)}
              title={sortAZ ? 'Ordenação A-Z ativa — clique para desativar' : 'Ordenar por nome A-Z'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap ${
                sortAZ
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:text-brand-secondary'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sortAZ ? 'rotate-180' : ''}`} />
              A–Z
            </button>

            {/* Clear filters */}
            {(searchQuery || segmentFilter || classFilter) && (
              <button
                onClick={() => { setSearchQuery(''); setSegmentFilter(''); setClassFilter(''); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}

            {/* Nova Ficha */}
            <button onClick={() => { setSelectedRecord(null); setDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors whitespace-nowrap">
              <Heart className="w-4 h-4" /> Nova Ficha
            </button>
          </div>

          {/* Result count */}
          {(searchQuery || segmentFilter || classFilter) && !loading && (
            <p className="text-xs text-gray-400">
              {filteredRecords.length} resultado{filteredRecords.length !== 1 ? 's' : ''} encontrado{filteredRecords.length !== 1 ? 's' : ''}
            </p>
          )}

          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  {['Aluno', 'Segmento', 'Turma', 'Tipo Sanguíneo', 'Alergias', 'Medicamentos', 'NE', 'Ações'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {loading ? (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">Carregando…</td></tr>
                ) : filteredRecords.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                    {records.length === 0 ? 'Nenhuma ficha cadastrada' : 'Nenhuma ficha corresponde aos filtros aplicados'}
                  </td></tr>
                ) : filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{r.student?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{r.student?.school_classes?.segment?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.student?.school_classes?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.blood_type ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge label={r.has_allergies ? 'Sim' : 'Não'} color={r.has_allergies ? 'red' : 'gray'} /></td>
                    <td className="px-4 py-3"><StatusBadge label={r.uses_medication ? 'Sim' : 'Não'} color={r.uses_medication ? 'yellow' : 'gray'} /></td>
                    <td className="px-4 py-3"><StatusBadge label={r.has_special_needs ? 'Sim' : 'Não'} color={r.has_special_needs ? 'blue' : 'gray'} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelectedRecord(r); setDrawerOpen(true); }}
                        className="px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-xs font-medium transition-colors">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Sub-tab: Atestados */}
      {activeSubTab === 'atestados' && (
        <div className="space-y-3">
          {/* Barra de filtros */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-3 flex flex-wrap gap-2 items-center">
            {/* Busca */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={certSearch}
                onChange={(e) => setCertSearch(e.target.value)}
                placeholder="Buscar por aluno ou médico…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            {/* Status */}
            <div className="relative">
              <select
                value={certStatusFilter}
                onChange={(e) => setCertStatusFilter(e.target.value as typeof certStatusFilter)}
                className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 appearance-none"
              >
                <option value="all">Todos os status</option>
                <option value="valid">Válidos</option>
                <option value="expiring_soon">Vence em breve</option>
                <option value="expired">Vencidos</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {/* A-Z */}
            <button
              onClick={() => setCertSortAZ((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                certSortAZ
                  ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary dark:text-brand-secondary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-brand-primary/30 hover:text-brand-primary'
              }`}
            >
              A–Z
            </button>
            {/* Contagem */}
            <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
              {filteredCerts.length} {filteredCerts.length === 1 ? 'atestado' : 'atestados'}
            </span>
          </div>

          {/* Lista */}
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
          ) : filteredCerts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {certs.length === 0 ? 'Nenhum atestado registrado.' : 'Nenhum atestado encontrado para os filtros aplicados.'}
            </p>
          ) : filteredCerts.map((cert) => {
            const status = certStatus(cert.valid_until);
            const statusColors: Record<string, string> = {
              valid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
              expiring_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            };
            const statusLabels: Record<string, string> = { valid: 'Válido', expiring_soon: 'Vence em breve', expired: 'Vencido' };
            return (
              <div key={cert.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status]}`}>{statusLabels[status]}</span>
                    {!cert.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Substituído</span>}
                    <span className="text-xs text-gray-400 capitalize">{cert.uploaded_via === 'guardian_portal' ? 'Responsável' : 'Admin'}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {(cert as unknown as { student?: { full_name?: string } }).student?.full_name ?? cert.student_id}
                  </p>
                  <p className="text-xs text-gray-500">Dr. {cert.doctor_name} · CRM {cert.doctor_crm} · Válido até {fmtDate(cert.valid_until)}</p>
                </div>
                {cert.file_url && (
                  <a href={cert.file_url} target="_blank" rel="noopener noreferrer"
                    className="ml-3 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all">
                    Ver arquivo
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-tab: Atualizações Pendentes */}
      {activeSubTab === 'pendentes' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
          ) : updateRequests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma solicitação de atualização.</p>
          ) : updateRequests.map((req) => (
            <div key={req.id} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{req.student?.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-500">Por: {req.guardian?.name ?? '—'} · {fmtDate(req.created_at)}</p>
                </div>
                <StatusBadge
                  label={HEALTH_UPDATE_STATUS_LABELS[req.status]}
                  color={HEALTH_UPDATE_STATUS_COLORS[req.status]}
                />
              </div>

              {/* Diff: show changed fields */}
              <div className="space-y-1.5">
                {Object.entries(req.proposed_data).map(([field, newVal]) => {
                  const oldVal = req.current_snapshot[field];
                  const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                  if (!changed) return null;
                  return (
                    <div key={field} className="flex items-start gap-2 text-xs rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
                      <span className="font-medium text-gray-600 dark:text-gray-400 w-36 flex-shrink-0">{field}</span>
                      <span className="text-red-500 line-through truncate max-w-[120px]">{String(oldVal ?? '—')}</span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 truncate max-w-[120px]">{String(newVal)}</span>
                    </div>
                  );
                })}
              </div>

              {req.rejection_reason && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  Motivo da recusa: {req.rejection_reason}
                </p>
              )}

              {req.status === 'pending' && (
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setRejectModal({ open: true, requestId: req.id })}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors">
                    Recusar
                  </button>
                  <button onClick={() => confirmRequest(req.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Confirmar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <HealthDrawer
        record={selectedRecord}
        studentOptions={studentOptions}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={fetchRecords}
      />

      <RejectHealthRequestModal
        open={rejectModal.open}
        onConfirm={rejectRequest}
        onCancel={() => setRejectModal({ open: false, requestId: null })}
        loading={rejectLoading}
      />
    </div>
  );
}

// ── Tab 3: Rematrícula ─────────────────────────────────────────────────────────

function CampaignDrawer({
  campaign,
  open,
  onClose,
  onSaved,
}: {
  campaign: ReenrollmentCampaign | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!campaign;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear() + 1);
  const [status, setStatus] = useState<ReenrollmentCampaignStatus>('draft');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [earlyDeadline, setEarlyDeadline] = useState('');
  const [earlyDiscountPct, setEarlyDiscountPct] = useState(0);
  const [autoGenerateContract, setAutoGenerateContract] = useState(false);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    if (open) {
      if (campaign) {
        setTitle(campaign.title);
        setDescription(campaign.description ?? '');
        setSchoolYear(campaign.school_year);
        setStatus(campaign.status);
        setStartDate(campaign.start_date?.slice(0, 10) ?? '');
        setEndDate(campaign.end_date?.slice(0, 10) ?? '');
        setEarlyDeadline(campaign.early_deadline?.slice(0, 10) ?? '');
        setEarlyDiscountPct(campaign.early_discount_pct);
        setAutoGenerateContract(campaign.auto_generate_contract);
        setRequiresSignature(campaign.requires_signature);
        setInstructions(campaign.instructions ?? '');
      } else {
        setTitle('');
        setDescription('');
        setSchoolYear(new Date().getFullYear() + 1);
        setStatus('draft');
        setStartDate('');
        setEndDate('');
        setEarlyDeadline('');
        setEarlyDiscountPct(0);
        setAutoGenerateContract(false);
        setRequiresSignature(false);
        setInstructions('');
      }
      setSaved(false);
      setError('');
    }
  }, [open, campaign]);

  async function handleSave() {
    if (!title.trim()) { setError('Título obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        school_year: schoolYear,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        early_deadline: earlyDeadline || null,
        early_discount_pct: earlyDiscountPct,
        auto_generate_contract: autoGenerateContract,
        requires_signature: requiresSignature,
        instructions: instructions.trim() || null,
      };
      const { error: saveError } = campaign
        ? await supabase.from('reenrollment_campaigns').update(payload).eq('id', campaign.id)
        : await supabase.from('reenrollment_campaigns').insert(payload);
      if (saveError) throw saveError;
      setSaved(true);
      onSaved();
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!campaign) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from('reenrollment_campaigns').delete().eq('id', campaign.id);
      if (deleteError) throw deleteError;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao excluir');
    } finally {
      setSaving(false);
    }
  }

  const footer = isEdit ? (
    <div className="flex items-center gap-2">
      <button onClick={handleDelete} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
                   hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5">
        <Trash2 className="w-3.5 h-3.5" /> Excluir
      </button>
      <div className="flex-1" />
      <button onClick={onClose} disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600
                   text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !title.trim()}
        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all flex items-center gap-2
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
      </button>
    </div>
  ) : (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300
                   hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !title.trim()}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Criar Campanha'}
      </button>
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose}
      title={isEdit ? 'Editar Campanha' : 'Nova Campanha'}
      icon={RefreshCw} footer={footer}>
      <DrawerCard title="Informações" icon={RefreshCw}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              placeholder="Ex: Rematrícula 2026" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
              placeholder="Descrição opcional da campanha" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ano Letivo</label>
              <input type="number" value={schoolYear} onChange={(e) => setSchoolYear(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
            </div>
            <SelectDropdown label="Status" value={status} onChange={(e) => setStatus(e.target.value as ReenrollmentCampaignStatus)}>
              {(Object.keys(REENROLLMENT_CAMPAIGN_STATUS_LABELS) as ReenrollmentCampaignStatus[]).map((s) => (
                <option key={s} value={s}>{REENROLLMENT_CAMPAIGN_STATUS_LABELS[s]}</option>
              ))}
            </SelectDropdown>
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Datas e Desconto" icon={RefreshCw}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fim</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Prazo Antecipado</label>
              <input type="date" value={earlyDeadline} onChange={(e) => setEarlyDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desconto Antecipado (%)</label>
              <input type="number" min={0} max={100} value={earlyDiscountPct}
                onChange={(e) => setEarlyDiscountPct(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
            </div>
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Configurações" icon={RefreshCw}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Gerar contrato automaticamente</span>
            <button onClick={() => setAutoGenerateContract(!autoGenerateContract)}
              className={`relative w-10 h-5 rounded-full transition-colors ${autoGenerateContract ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoGenerateContract ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Requer assinatura</span>
            <button onClick={() => setRequiresSignature(!requiresSignature)}
              className={`relative w-10 h-5 rounded-full transition-colors ${requiresSignature ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${requiresSignature ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Instruções para os responsáveis</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
              placeholder="Instruções que serão exibidas para os responsáveis durante o processo de rematrícula" />
          </div>
        </div>
      </DrawerCard>
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mx-1">
          {error}
        </p>
      )}
    </Drawer>
  );
}

type ApplicationWithJoins = ReenrollmentApplication & {
  campaign: ReenrollmentCampaign | null;
  student: { id: string; full_name: string } | null;
};

function SecretariaRematriculaTab() {
  const [view, setView] = useState<'campaigns' | 'applications'>('campaigns');
  const [campaigns, setCampaigns] = useState<ReenrollmentCampaign[]>([]);
  const [applications, setApplications] = useState<ApplicationWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [campaignDrawerOpen, setCampaignDrawerOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<ReenrollmentCampaign | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithJoins | null>(null);
  const [fetchError, setFetchError] = useState('');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { data, error } = await supabase
        .from('reenrollment_campaigns')
        .select('*')
        .order('school_year', { ascending: false });
      if (error) throw error;
      setCampaigns(data ?? []);
    } catch (e: unknown) {
      setFetchError((e as Error).message ?? 'Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { data, error } = await supabase
        .from('reenrollment_applications')
        .select('*, campaign:reenrollment_campaigns(*), student:students(id, full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApplications((data ?? []) as unknown as ApplicationWithJoins[]);
    } catch (e: unknown) {
      setFetchError((e as Error).message ?? 'Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'campaigns') { fetchCampaigns(); } else { fetchApplications(); }
  }, [view, fetchCampaigns, fetchApplications]);

  const filteredApplications = campaignFilter === 'all'
    ? applications
    : applications.filter((a) => a.campaign_id === campaignFilter);

  function applicationStatusColor(status: ReenrollmentApplication['status']): string {
    if (status === 'completed') return 'green';
    if (status === 'cancelled') return 'red';
    if (status === 'confirmed' || status === 'signed' || status === 'contract_generated') return 'blue';
    return 'yellow';
  }

  return (
    <div className="space-y-5">
      {fetchError && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {fetchError}
        </p>
      )}
      <div className="flex gap-2">
        {(['campaigns', 'applications'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                        ${view === v
                          ? 'bg-brand-primary text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {v === 'campaigns' ? 'Campanhas' : 'Solicitações'}
          </button>
        ))}
      </div>

      {view === 'campaigns' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => { setEditingCampaign(null); setCampaignDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors">
              <RefreshCw className="w-4 h-4" /> Nova Campanha
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  {['Campanha', 'Ano', 'Período', 'Prazo Antecipado', 'Desconto', 'Status', 'Ações'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Carregando…</td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Nenhuma campanha criada</td></tr>
                ) : campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{c.title}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.school_year}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {c.start_date ? fmtDate(c.start_date) : '—'} → {c.end_date ? fmtDate(c.end_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.early_deadline ? fmtDate(c.early_deadline) : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.early_discount_pct > 0 ? `${c.early_discount_pct}%` : '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={REENROLLMENT_CAMPAIGN_STATUS_LABELS[c.status]}
                        color={REENROLLMENT_CAMPAIGN_STATUS_COLORS[c.status]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditingCampaign(c); setCampaignDrawerOpen(true); }}
                        className="px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-xs font-medium transition-colors">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'applications' && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 appearance-none">
                <option value="all">Todas as campanhas</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.school_year})</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  {['Aluno', 'Campanha', 'Status', 'Desc. Antecipado', 'Data Confirmação', 'Ações'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">Carregando…</td></tr>
                ) : filteredApplications.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">Nenhuma solicitação encontrada</td></tr>
                ) : filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{app.student?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {app.campaign ? `${app.campaign.title} (${app.campaign.school_year})` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={REENROLLMENT_APPLICATION_STATUS_LABELS[app.status]}
                        color={applicationStatusColor(app.status)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={app.early_discount_applied ? 'Sim' : 'Não'} color={app.early_discount_applied ? 'green' : 'gray'} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmtDate(app.confirmed_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelectedApplication(app); setDetailDrawerOpen(true); }}
                        className="px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-xs font-medium transition-colors">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CampaignDrawer
        campaign={editingCampaign}
        open={campaignDrawerOpen}
        onClose={() => setCampaignDrawerOpen(false)}
        onSaved={fetchCampaigns}
      />

      <Drawer open={detailDrawerOpen} onClose={() => setDetailDrawerOpen(false)}
        title="Detalhes da Solicitação" icon={RefreshCw}>
        {selectedApplication && (
          <>
            <DrawerCard title="Aluno e Campanha" icon={RefreshCw}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Aluno</span>
                  <span className="font-medium text-gray-800 dark:text-white">{selectedApplication.student?.full_name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Campanha</span>
                  <span className="font-medium text-gray-800 dark:text-white">
                    {selectedApplication.campaign
                      ? `${selectedApplication.campaign.title} (${selectedApplication.campaign.school_year})`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status</span>
                  <StatusBadge
                    label={REENROLLMENT_APPLICATION_STATUS_LABELS[selectedApplication.status]}
                    color={applicationStatusColor(selectedApplication.status)}
                  />
                </div>
              </div>
            </DrawerCard>
            <DrawerCard title="Datas e Desconto" icon={RefreshCw}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Desconto antecipado</span>
                  <StatusBadge label={selectedApplication.early_discount_applied ? 'Sim' : 'Não'} color={selectedApplication.early_discount_applied ? 'green' : 'gray'} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Confirmado em</span>
                  <span className="text-gray-700 dark:text-gray-300">{fmtDate(selectedApplication.confirmed_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Assinado em</span>
                  <span className="text-gray-700 dark:text-gray-300">{fmtDate(selectedApplication.signed_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Criado em</span>
                  <span className="text-gray-700 dark:text-gray-300">{fmtDate(selectedApplication.created_at)}</span>
                </div>
              </div>
            </DrawerCard>
            {selectedApplication.notes && (
              <DrawerCard title="Observações" icon={RefreshCw}>
                <p className="text-sm text-gray-600 dark:text-gray-300">{selectedApplication.notes}</p>
              </DrawerCard>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}

// ── Tab 4: Transferências ──────────────────────────────────────────────────────

type TransferWithJoins = StudentTransfer & {
  student: { id: string; full_name: string } | null;
  from_class: { id: string; name: string } | null;
  to_class: { id: string; name: string } | null;
};

interface ClassOption { id: string; name: string; }
interface StudentSimple { id: string; full_name: string; }

function TransferDrawer({
  open,
  onClose,
  onSaved,
  studentOptions,
  classOptions,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  studentOptions: StudentSimple[];
  classOptions: ClassOption[];
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState<StudentTransferType>('internal');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [destinationSchool, setDestinationSchool] = useState('');
  const [cancelFutureInstallments, setCancelFutureInstallments] = useState(true);
  const [notes, setNotes] = useState('');
  const [declarationNeeded, setDeclarationNeeded] = useState(false);

  useEffect(() => {
    if (open) {
      setStudentId('');
      setType('internal');
      setEffectiveDate('');
      setReason('');
      setToClassId('');
      setDestinationSchool('');
      setCancelFutureInstallments(true);
      setNotes('');
      setDeclarationNeeded(false);
      setSaved(false);
      setError('');
    }
  }, [open]);

  async function handleSave() {
    if (!studentId) { setError('Selecione um aluno'); return; }
    if (!effectiveDate) { setError('Data efetiva obrigatória'); return; }
    if (!reason.trim()) { setError('Motivo obrigatório'); return; }
    setSaving(true);
    try {
      if (type === 'internal') {
        const { error: rpcError } = await supabase.rpc('process_internal_transfer', {
          p_student_id: studentId,
          p_to_class_id: toClassId || null,
          p_effective_date: effectiveDate,
          p_reason: reason.trim(),
          p_notes: notes.trim() || null,
          p_declaration_needed: declarationNeeded,
          p_cancel_future_installments: cancelFutureInstallments,
        });
        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc('process_student_cancellation', {
          p_student_id: studentId,
          p_type: type,
          p_effective_date: effectiveDate,
          p_reason: reason.trim(),
          p_destination_school: destinationSchool.trim() || null,
          p_notes: notes.trim() || null,
          p_declaration_needed: declarationNeeded,
          p_cancel_future_installments: cancelFutureInstallments,
        });
        if (rpcError) throw rpcError;
      }
      setSaved(true);
      onSaved();
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao registrar movimentação');
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!studentId && !!effectiveDate && !!reason.trim();

  const footer = (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300
                   hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !canSave}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Registrar'}
      </button>
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose}
      title="Nova Movimentação" icon={ArrowRightLeft} footer={footer}>
      <DrawerCard title="Aluno e Tipo" icon={ArrowRightLeft}>
        <div className="space-y-3">
          <SearchableSelect
            label="Aluno *"
            value={studentId}
            onChange={(val) => setStudentId(val)}
            options={studentOptions.map((s) => ({ value: s.id, label: s.full_name }))}
            placeholder="Selecione o aluno..."
          />
          <SelectDropdown label="Tipo de Movimentação *" value={type} onChange={(e) => setType(e.target.value as StudentTransferType)}>
            {(Object.keys(STUDENT_TRANSFER_TYPE_LABELS) as StudentTransferType[]).map((t) => (
              <option key={t} value={t}>{STUDENT_TRANSFER_TYPE_LABELS[t]}</option>
            ))}
          </SelectDropdown>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data Efetiva *</label>
            <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Detalhes" icon={ArrowRightLeft}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Motivo *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
              placeholder="Descreva o motivo da movimentação" />
          </div>
          {type === 'internal' && (
            <SearchableSelect
              label="Turma de Destino"
              value={toClassId}
              onChange={(val) => setToClassId(val)}
              options={classOptions.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="— Selecionar turma —"
            />
          )}
          {type === 'transfer_out' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Escola de Destino</label>
              <input value={destinationSchool} onChange={(e) => setDestinationSchool(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                placeholder="Nome da escola de destino" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Cancelar parcelas futuras</span>
            <button onClick={() => setCancelFutureInstallments(!cancelFutureInstallments)}
              className={`relative w-10 h-5 rounded-full transition-colors ${cancelFutureInstallments ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cancelFutureInstallments ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Observações" icon={ArrowRightLeft}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas internas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
              placeholder="Observações adicionais" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Necessita declaração</span>
            <button onClick={() => setDeclarationNeeded(!declarationNeeded)}
              className={`relative w-10 h-5 rounded-full transition-colors ${declarationNeeded ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${declarationNeeded ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </DrawerCard>
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mx-1">
          {error}
        </p>
      )}
    </Drawer>
  );
}

const TRANSFER_TYPE_COLOR: Record<StudentTransferType, string> = {
  internal:     'blue',
  transfer_out: 'purple',
  trancamento:  'yellow',
  cancellation: 'red',
};

const TRANSFER_STATUS_COLOR: Record<StudentTransferStatus, string> = {
  pending:    'yellow',
  processing: 'blue',
  completed:  'green',
  reversed:   'red',
};

function SecretariaTransferenciasTab() {
  const [transfers, setTransfers] = useState<TransferWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<StudentTransferType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StudentTransferStatus | 'all'>('all');
  const [sortAZ, setSortAZ] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [studentOptions, setStudentOptions] = useState<StudentSimple[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [fetchError, setFetchError] = useState('');

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { data, error } = await supabase
        .from('student_transfers')
        .select('*, student:students(id, full_name), from_class:school_classes!from_class_id(id, name), to_class:school_classes!to_class_id(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTransfers((data ?? []) as unknown as TransferWithJoins[]);
    } catch (e: unknown) {
      setFetchError((e as Error).message ?? 'Erro ao carregar movimentações');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    const [studentsRes, classesRes] = await Promise.all([
      supabase.from('students').select('id, full_name').order('full_name'),
      supabase.from('school_classes').select('id, name').order('name'),
    ]);
    setStudentOptions((studentsRes.data ?? []) as StudentSimple[]);
    setClassOptions((classesRes.data ?? []) as ClassOption[]);
  }, []);

  useEffect(() => { fetchTransfers(); fetchOptions(); }, [fetchTransfers, fetchOptions]);

  const filtered = transfers
    .filter((t) => {
      const name = t.student?.full_name?.toLowerCase() ?? '';
      if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortAZ) return 0;
      return (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? '', 'pt-BR');
    });

  const kpi = {
    total: transfers.length,
    internal: transfers.filter((t) => t.type === 'internal').length,
    cancellations: transfers.filter((t) => t.type === 'cancellation' || t.type === 'trancamento').length,
  };

  return (
    <div className="space-y-5">
      {fetchError && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {fetchError}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Movimentações" value={kpi.total} />
        <KpiCard label="Transferências Internas" value={kpi.internal} />
        <KpiCard label="Cancelamentos / Trancamentos" value={kpi.cancellations} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-3 flex flex-wrap gap-2 items-center">
        {/* Busca */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por aluno…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>
        {/* Tipo */}
        <div className="relative">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as StudentTransferType | 'all')}
            className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 appearance-none">
            <option value="all">Todos os tipos</option>
            {(Object.keys(STUDENT_TRANSFER_TYPE_LABELS) as StudentTransferType[]).map((t) => (
              <option key={t} value={t}>{STUDENT_TRANSFER_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {/* Status */}
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StudentTransferStatus | 'all')}
            className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 appearance-none">
            <option value="all">Todos os status</option>
            {(Object.keys(STUDENT_TRANSFER_STATUS_LABELS) as StudentTransferStatus[]).map((s) => (
              <option key={s} value={s}>{STUDENT_TRANSFER_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {/* A-Z */}
        <button
          onClick={() => setSortAZ((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
            sortAZ
              ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary dark:text-brand-secondary'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-brand-primary/30 hover:text-brand-primary'
          }`}
        >
          A–Z
        </button>
        {/* Contagem */}
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        </span>
        {/* Nova movimentação */}
        <button onClick={() => setDrawerOpen(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors">
          <ArrowRightLeft className="w-4 h-4" /> Nova Movimentação
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
            <tr>
              {['Data', 'Aluno', 'Tipo', 'De → Para', 'Motivo', 'Status', 'Parcelas Cancel.'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Nenhuma movimentação encontrada</td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{fmtDate(t.effective_date)}</td>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{t.student?.full_name ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge label={STUDENT_TRANSFER_TYPE_LABELS[t.type]} color={TRANSFER_TYPE_COLOR[t.type]} />
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {t.from_class?.name ?? '—'} → {t.to_class?.name ?? (t.destination_school ?? '—')}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[180px]">
                  <span className="truncate block" title={t.reason}>{t.reason}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge label={STUDENT_TRANSFER_STATUS_LABELS[t.status]} color={TRANSFER_STATUS_COLOR[t.status]} />
                </td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{t.installments_cancelled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TransferDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={fetchTransfers}
        studentOptions={studentOptions}
        classOptions={classOptions}
      />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

interface TabDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabDef[] = [
  {
    key: 'declaracoes',
    label: 'Declarações',
    shortLabel: 'Declarações',
    icon: FileText,
    description: 'Solicitações de documentos e templates para emissão',
  },
  {
    key: 'fichas-saude',
    label: 'Fichas de Saúde',
    shortLabel: 'Fichas de Saúde',
    icon: Heart,
    description: 'Dados de saúde, alergias e contatos de emergência dos alunos',
  },
  {
    key: 'rematricula',
    label: 'Rematrícula',
    shortLabel: 'Rematrícula',
    icon: RefreshCw,
    description: 'Campanhas e solicitações de rematrícula',
  },
  {
    key: 'transferencias',
    label: 'Transferências',
    shortLabel: 'Transferências',
    icon: ArrowRightLeft,
    description: 'Transferências internas, saídas, trancamentos e cancelamentos',
  },
];

export default function SecretariaPage() {
  const [activeTab, setActiveTab] = useState('declaracoes');
  const [tabsCollapsed, setTabsCollapsed] = useState(false);

  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Secretaria Digital</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Declarações, fichas de saúde, rematrícula e movimentações de alunos
        </p>
      </div>

      <div className="flex gap-4">
        {/* Tab rail */}
        <nav className={`flex-shrink-0 transition-all duration-300 ${tabsCollapsed ? 'w-[52px]' : 'w-52'}`}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden sticky top-20">
            <button
              onClick={() => setTabsCollapsed(!tabsCollapsed)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700"
              title={tabsCollapsed ? 'Expandir abas' : 'Recolher abas'}
            >
              {tabsCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 mx-auto" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span className="text-xs font-medium">Recolher</span>
                </>
              )}
            </button>
            <div className="p-1.5 space-y-0.5">
              {TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    title={tabsCollapsed ? tab.label : undefined}
                    className={`
                      relative w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200
                      ${tabsCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5'}
                      ${isActive
                        ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/15'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-primary dark:hover:text-white'
                      }
                    `}
                  >
                    <TabIcon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-brand-secondary' : ''}`} />
                    {!tabsCollapsed && (
                      <span className="truncate text-left flex-1 text-[13px]">{tab.shortLabel}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Tab title bar */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <currentTab.icon className="w-[18px] h-[18px] text-brand-primary dark:text-brand-secondary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-brand-primary dark:text-white truncate">
                  {currentTab.label}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate hidden sm:block">{currentTab.description}</p>
              </div>
            </div>

            {/* Panel content */}
            <div className="p-6">
              {activeTab === 'declaracoes' && <SecretariaDeclaracoesTab />}
              {activeTab === 'fichas-saude' && <SecretariaFichasSaudeTab />}
              {activeTab === 'rematricula' && <SecretariaRematriculaTab />}
              {activeTab === 'transferencias' && <SecretariaTransferenciasTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
