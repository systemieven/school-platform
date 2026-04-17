import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type { FinancialContract, FinancialPlan, FinancialContractStatus } from '../../types/admin.types';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Loader2, Search, ChevronDown, Play, Pause, X as XIcon,
  Save, Check, FileSignature, User, Calendar, Tag, Pencil,
  Upload, FileText, ExternalLink, Link as LinkIcon, Download, Trash2,
} from 'lucide-react';
import { SelectDropdown } from '../../components/FormField';

const STORAGE_BUCKET = 'financial-contracts';
const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

interface ContractForm {
  id: string | null;
  student_id: string;
  plan_id: string;
  notes: string;
  signed_document_url: string | null;
  signed_document_path: string | null;
}

const EMPTY_FORM: ContractForm = {
  id: null,
  student_id: '',
  plan_id: '',
  notes: '',
  signed_document_url: null,
  signed_document_path: null,
};

export default function FinancialContractsPage() {
  const { profile } = useAdminAuth();
  const [contracts, setContracts] = useState<FinancialContract[]>([]);
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string; enrollment_number: string; class_id: string | null }[]>([]);
  const [classMap, setClassMap] = useState<Record<string, { name: string; school_year: number; series_name: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FinancialContractStatus | 'all'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<ContractForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, pRes, sRes, clsRes] = await Promise.all([
      supabase.from('financial_contracts')
        .select('*, student:students(full_name, enrollment_number, class_id), plan:financial_plans(name, amount, installments)')
        .order('created_at', { ascending: false }),
      supabase.from('financial_plans').select('*').eq('is_active', true).order('name'),
      supabase.from('students').select('id, full_name, enrollment_number, class_id').eq('status', 'active').order('full_name'),
      supabase.from('school_classes').select('id, name, school_year, series:school_series(name)'),
    ]);
    setContracts((cRes.data ?? []) as unknown as FinancialContract[]);
    setPlans((pRes.data ?? []) as FinancialPlan[]);
    setStudents((sRes.data ?? []) as typeof students);
    const map: Record<string, { name: string; school_year: number; series_name: string | null }> = {};
    type ClsRow = { id: string; name: string; school_year: number; series: { name: string } | { name: string }[] | null };
    for (const c of ((clsRes.data ?? []) as unknown as ClsRow[])) {
      const ser = Array.isArray(c.series) ? c.series[0] ?? null : c.series;
      map[c.id] = { name: c.name, school_year: c.school_year, series_name: ser?.name ?? null };
    }
    setClassMap(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contracts.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = c.student?.full_name?.toLowerCase() || '';
      const enroll = c.student?.enrollment_number?.toLowerCase() || '';
      if (!name.includes(q) && !enroll.includes(q)) return false;
    }
    return true;
  });

  function fmt(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setFile(null);
    setError('');
    setIsEdit(false);
    setDrawerOpen(true);
  }

  function openEdit(c: FinancialContract) {
    setForm({
      id: c.id,
      student_id: c.student_id,
      plan_id: c.plan_id,
      notes: c.notes ?? '',
      signed_document_url: c.signed_document_url,
      signed_document_path: c.signed_document_path,
    });
    setFile(null);
    setError('');
    setIsEdit(true);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_FORM);
    setFile(null);
    setError('');
  }

  function handleFileSelect(f: File | null) {
    setError('');
    if (!f) { setFile(null); return; }
    if (!ALLOWED_MIME.includes(f.type)) {
      setError('Formato não suportado. Use PDF, DOC, DOCX, JPG ou PNG.');
      return;
    }
    if (f.size > MAX_SIZE) {
      setError('Arquivo muito grande. Máximo de 20 MB.');
      return;
    }
    setFile(f);
  }

  async function uploadSignedDocument(contractId: string): Promise<{ url: string; path: string } | null> {
    if (!file) return null;
    setUploading(true);
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${contractId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      setError(`Upload falhou: ${upErr.message}`);
      return null;
    }
    const { data: urlData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 anos
    setUploading(false);
    return { url: urlData?.signedUrl ?? '', path };
  }

  async function handleSave() {
    if (!form.student_id || !form.plan_id || !profile) return;
    setSaving(true);
    setError('');

    let contractId = form.id;
    let signedUrl = form.signed_document_url;
    let signedPath = form.signed_document_path;

    // Create contract first if new (so we have id for storage path)
    if (!isEdit) {
      const basePayload = {
        student_id: form.student_id,
        plan_id: form.plan_id,
        school_year: new Date().getFullYear(),
        status: 'draft' as const,
        notes: form.notes || null,
        signed_document_url: form.signed_document_url?.trim() || null,
        signed_document_path: null,
        created_by: profile.id,
      };
      const { data: inserted, error: insErr } = await supabase
        .from('financial_contracts')
        .insert(basePayload)
        .select('id')
        .single();
      if (insErr || !inserted) {
        setError(insErr?.message || 'Falha ao criar contrato');
        setSaving(false);
        return;
      }
      contractId = inserted.id;
      signedUrl = basePayload.signed_document_url;
      signedPath = null;
    }

    // Upload file if selected — replaces any previous upload
    if (file && contractId) {
      // Remove old file if any
      if (signedPath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([signedPath]);
      }
      const uploaded = await uploadSignedDocument(contractId);
      if (!uploaded) { setSaving(false); return; }
      signedUrl = uploaded.url;
      signedPath = uploaded.path;
    }

    // Update if edit (or if we need to persist uploaded file url/path on a brand new contract)
    if (isEdit && contractId) {
      const updatePayload = {
        student_id: form.student_id,
        plan_id: form.plan_id,
        notes: form.notes || null,
        signed_document_url: signedUrl,
        signed_document_path: signedPath,
        updated_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from('financial_contracts')
        .update(updatePayload)
        .eq('id', contractId);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
      logAudit({ action: 'update', module: 'financial-contracts', description: 'Contrato atualizado', newData: { id: contractId } });
    } else if (contractId && (signedPath || (signedUrl && signedUrl !== form.signed_document_url))) {
      // New contract with uploaded file: persist url+path
      await supabase
        .from('financial_contracts')
        .update({ signed_document_url: signedUrl, signed_document_path: signedPath, updated_at: new Date().toISOString() })
        .eq('id', contractId);
      logAudit({ action: 'create', module: 'financial-contracts', description: 'Contrato criado com documento', newData: { id: contractId } });
    } else if (!isEdit) {
      logAudit({ action: 'create', module: 'financial-contracts', description: 'Contrato criado', newData: { id: contractId } });
    }

    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { setSaved(false); closeDrawer(); load(); }, 1200);
    setSaving(false);
  }

  async function removeSignedDocument() {
    if (!form.id) return;
    if (form.signed_document_path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([form.signed_document_path]);
    }
    await supabase
      .from('financial_contracts')
      .update({ signed_document_url: null, signed_document_path: null, updated_at: new Date().toISOString() })
      .eq('id', form.id);
    setForm((p) => ({ ...p, signed_document_url: null, signed_document_path: null }));
    setFile(null);
    logAudit({ action: 'update', module: 'financial-contracts', description: 'Documento assinado removido', newData: { id: form.id } });
    load();
  }

  async function activateContract(id: string) {
    await supabase.from('financial_contracts').update({ status: 'active', activated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    await supabase.rpc('generate_installments_for_contract', { p_contract_id: id });
    logAudit({ action: 'update', module: 'financial-contracts', description: 'Contrato ativado + parcelas geradas', newData: { id } });
    load();
  }

  async function suspendContract(id: string) {
    await supabase.from('financial_contracts').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', id);
    logAudit({ action: 'update', module: 'financial-contracts', description: 'Contrato suspenso', newData: { id } });
    load();
  }

  async function cancelContract(id: string) {
    await supabase.from('financial_contracts').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('financial_installments').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('contract_id', id).in('status', ['pending', 'overdue']);
    logAudit({ action: 'update', module: 'financial-contracts', description: 'Contrato cancelado + parcelas pendentes canceladas', newData: { id } });
    load();
  }

  async function openSignedDocument(c: FinancialContract) {
    if (!c.signed_document_url) return;
    // If stored in Supabase (has path), refresh the signed URL
    if (c.signed_document_path) {
      const { data } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(c.signed_document_path, 60 * 60); // 1 hora
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    window.open(c.signed_document_url, '_blank', 'noopener,noreferrer');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{contracts.length} contrato{contracts.length !== 1 && 's'}</p>
        <PermissionGate moduleKey="financial-contracts" action="create">
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors shadow-lg shadow-brand-primary/20">
            <FileSignature className="w-4 h-4" /> Novo Contrato
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por aluno..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FinancialContractStatus | 'all')}
            className="appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
            <option value="all">Todos os status</option>
            {(['draft', 'active', 'suspended', 'cancelled', 'concluded'] as FinancialContractStatus[]).map((s) => (
              <option key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Contracts list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileSignature className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhum contrato encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">{c.student?.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">
                      {c.student?.enrollment_number} · {c.plan?.name}
                      {(() => {
                        const cls = c.student?.class_id ? classMap[c.student.class_id] : null;
                        if (!cls) return null;
                        const composed = [cls.series_name, cls.name].filter(Boolean).join(' ');
                        return <> · {composed} {cls.school_year}</>;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${CONTRACT_STATUS_COLORS[c.status]}`}>
                    {CONTRACT_STATUS_LABELS[c.status]}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{c.net_amount ? fmt(c.net_amount) : c.plan ? fmt(c.plan.amount) : '—'}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3" /> {c.school_year}</p>
                  </div>
                </div>
              </div>

              <PermissionGate moduleKey="financial-contracts" action="edit">
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex-wrap">
                  {c.signed_document_url && (
                    <button onClick={() => openSignedDocument(c)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium">
                      <Download className="w-3 h-3" /> Contrato Assinado
                    </button>
                  )}
                  <button onClick={() => openEdit(c)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  {c.status === 'draft' && (
                    <button onClick={() => activateContract(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors font-medium">
                      <Play className="w-3 h-3" /> Ativar + Gerar Parcelas
                    </button>
                  )}
                  {c.status === 'active' && (
                    <button onClick={() => suspendContract(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors font-medium">
                      <Pause className="w-3 h-3" /> Suspender
                    </button>
                  )}
                  {(c.status === 'draft' || c.status === 'active' || c.status === 'suspended') && (
                    <button onClick={() => cancelContract(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-auto">
                      <XIcon className="w-3 h-3" /> Cancelar
                    </button>
                  )}
                </div>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}

      {/* Drawer: New / Edit Contract */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={isEdit ? 'Editar Contrato' : 'Novo Contrato'}
        icon={FileSignature}
        width="w-[480px]"
        footer={
          <div className="flex gap-3">
            <button onClick={closeDrawer} disabled={saving || uploading} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancelar</button>
            <button onClick={handleSave} disabled={!form.student_id || !form.plan_id || saving || uploading}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {(saving || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {uploading ? 'Enviando...' : saving ? 'Salvando...' : saved ? 'Salvo!' : isEdit ? 'Salvar' : 'Criar Contrato'}
            </button>
          </div>
        }
      >
        <DrawerCard title="Aluno e Plano" icon={User}>
          <SelectDropdown label="Aluno *" value={form.student_id} onChange={(e) => setForm((p) => ({ ...p, student_id: e.target.value }))}>
            <option value="">Selecione o aluno</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.enrollment_number})</option>)}
          </SelectDropdown>
          <SelectDropdown label="Plano *" value={form.plan_id} onChange={(e) => setForm((p) => ({ ...p, plan_id: e.target.value }))}>
            <option value="">Selecione o plano</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.amount)}</option>)}
          </SelectDropdown>
        </DrawerCard>

        <DrawerCard title="Contrato Assinado" icon={FileText}>
          {/* Current document */}
          {form.signed_document_url && !file && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {form.signed_document_path ? 'Documento armazenado' : 'Link externo'}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{form.signed_document_url}</p>
              </div>
              <a href={form.signed_document_url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button type="button" onClick={removeSignedDocument}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* File upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              {form.signed_document_url ? 'Substituir por novo arquivo' : 'Upload do arquivo'}
            </label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-primary cursor-pointer transition-colors bg-white dark:bg-gray-900">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="flex-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                {file ? file.name : 'PDF, DOC, DOCX, JPG, PNG — máx. 20MB'}
              </span>
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                className="hidden" />
            </label>
            {file && (
              <button type="button" onClick={() => setFile(null)}
                className="mt-1.5 text-[11px] text-red-500 hover:underline">
                Remover seleção
              </button>
            )}
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">ou</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* External URL input */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Link externo</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={!form.signed_document_path ? (form.signed_document_url ?? '') : ''}
                onChange={(e) => setForm((p) => ({ ...p, signed_document_url: e.target.value || null, signed_document_path: null }))}
                disabled={!!form.signed_document_path || !!file}
                placeholder="https://docusign.com/…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Cole um link externo (DocuSign, Google Drive, OneDrive, etc.) se o contrato já estiver hospedado fora do sistema.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{error}</p>
          )}
        </DrawerCard>

        <DrawerCard title="Observações" icon={Tag}>
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Observações sobre o contrato..."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none resize-none" />
        </DrawerCard>
      </Drawer>
    </div>
  );
}
