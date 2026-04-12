import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useRealtimeRows } from '../../hooks/useRealtimeRows';
import type { Enrollment, EnrollmentStatus } from '../../types/admin.types';
import SendWhatsAppModal from '../../components/SendWhatsAppModal';
import {
  GraduationCap, Search, X, ChevronRight, Loader2, RefreshCw,
  User, Phone, MapPin, FileText, CheckCircle2,
  Clock, ChevronDown, MessageCircle, Plus,
  History, ClipboardCheck, CalendarPlus, Edit3, Save,
  Check, XCircle, Filter,
} from 'lucide-react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';
import { useBranding } from '../../../contexts/BrandingContext';

// ── Pipeline config ──────────────────────────────────────────────────────────
const PIPELINE: { key: EnrollmentStatus; label: string; color: string; dot: string }[] = [
  { key: 'new',                  label: 'Novo',                color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500' },
  { key: 'under_review',         label: 'Em Análise',          color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  { key: 'docs_pending',         label: 'Docs. Pendentes',     color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',    dot: 'bg-amber-400' },
  { key: 'docs_received',        label: 'Docs. Recebidos',     color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',       dot: 'bg-cyan-500' },
  { key: 'interview_scheduled',  label: 'Entrevista Agendada', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  { key: 'approved',             label: 'Aprovado',            color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { key: 'confirmed',            label: 'Matrícula Confirmada',color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',    dot: 'bg-green-600' },
  { key: 'archived',             label: 'Arquivado',           color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',          dot: 'bg-gray-400' },
];


const ORIGIN_LABELS: Record<string, string> = {
  website: 'Site', in_person: 'Presencial', phone: 'Telefone', referral: 'Indicação',
};

const SEGMENT_OPTIONS = [
  { value: 'infantil', label: 'Ed. Infantil' },
  { value: 'fundamental1', label: 'Fund. I' },
  { value: 'fundamental2', label: 'Fund. II' },
  { value: 'medio', label: 'Ensino Médio' },
];

function age(birthDate: string) {
  const d = new Date(birthDate + 'T00:00:00');
  const today = new Date();
  let a = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) a--;
  return a;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── History entry type ───────────────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  event_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// ── Document Checklist Tab ───────────────────────────────────────────────────
function DocsChecklistTab({ enrollment, onUpdate }: { enrollment: Enrollment; onUpdate: (id: string, patch: Partial<Enrollment>) => void }) {
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(enrollment.docs_checklist || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'enrollment')
      .eq('key', 'required_docs_list')
      .single()
      .then(({ data }) => {
        if (data?.value) {
          const docs = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (Array.isArray(docs)) setRequiredDocs(docs);
        }
      });
  }, []);

  useEffect(() => {
    setChecklist(enrollment.docs_checklist || {});
  }, [enrollment.id, enrollment.docs_checklist]);

  const toggleDoc = (doc: string) => {
    setChecklist((prev) => ({ ...prev, [doc]: !prev[doc] }));
  };

  const saveChecklist = async () => {
    setSaving(true);
    const { error } = await supabase.from('enrollments').update({ docs_checklist: checklist }).eq('id', enrollment.id);
    if (!error) {
      logAudit({ action: 'update', module: 'enrollments', recordId: enrollment.id, description: `Checklist de documentos atualizado para matrícula de ${enrollment.guardian_name}`, newData: checklist });
      onUpdate(enrollment.id, { docs_checklist: checklist });
    }
    setSaving(false);
  };

  const receivedCount = requiredDocs.filter((d) => checklist[d]).length;
  const hasChanges = JSON.stringify(checklist) !== JSON.stringify(enrollment.docs_checklist || {});

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Documentos recebidos</span>
          <span className="text-xs font-bold text-brand-primary dark:text-brand-secondary">
            {receivedCount}/{requiredDocs.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-brand-primary dark:bg-brand-secondary h-2 rounded-full transition-all duration-300"
            style={{ width: requiredDocs.length ? `${(receivedCount / requiredDocs.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Checklist */}
      {requiredDocs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Nenhum documento configurado. Configure em Ajustes &gt; Matrículas.
        </p>
      ) : (
        <div className="space-y-1">
          {requiredDocs.map((doc) => (
            <button
              key={doc}
              onClick={() => toggleDoc(doc)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
                checklist[doc]
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700'
              }`}
            >
              {checklist[doc] ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
              )}
              <span className={checklist[doc] ? 'line-through opacity-70' : ''}>{doc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Save button */}
      {hasChanges && (
        <button
          onClick={saveChecklist}
          disabled={saving}
          className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar checklist'}
        </button>
      )}
    </div>
  );
}

// ── Timeline Tab ─────────────────────────────────────────────────────────────
function TimelineTab({ enrollmentId }: { enrollmentId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('enrollment_history')
      .select('id, event_type, description, old_value, new_value, created_at')
      .eq('enrollment_id', enrollmentId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setHistory((data as HistoryEntry[]) || []);
        setLoading(false);
      });
  }, [enrollmentId]);

  const eventIcon = (type: string) => {
    switch (type) {
      case 'status_change': return <ChevronRight className="w-3.5 h-3.5" />;
      case 'whatsapp_sent': return <MessageCircle className="w-3.5 h-3.5" />;
      case 'document_received': return <FileText className="w-3.5 h-3.5" />;
      case 'appointment_created': return <CalendarPlus className="w-3.5 h-3.5" />;
      case 'note': return <Edit3 className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const eventColor = (type: string) => {
    switch (type) {
      case 'status_change': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400';
      case 'whatsapp_sent': return 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400';
      case 'document_received': return 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400';
      case 'appointment_created': return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;

  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[17px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-4">
        {history.map((entry) => (
          <div key={entry.id} className="flex gap-3 relative">
            <div className={`w-[35px] h-[35px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ${eventColor(entry.event_type)}`}>
              {eventIcon(entry.event_type)}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm text-gray-800 dark:text-gray-200">{entry.description}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(entry.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tags Manager ─────────────────────────────────────────────────────────────
function TagsManager({ enrollment, onUpdate }: { enrollment: Enrollment; onUpdate: (id: string, patch: Partial<Enrollment>) => void }) {
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const addTag = async () => {
    if (!newTag.trim()) return;
    const updated = [...(enrollment.tags || []), newTag.trim()];
    setSaving(true);
    const { error } = await supabase.from('enrollments').update({ tags: updated }).eq('id', enrollment.id);
    if (!error) onUpdate(enrollment.id, { tags: updated });
    setSaving(false);
    setNewTag('');
  };

  const removeTag = async (tag: string) => {
    const updated = (enrollment.tags || []).filter((t) => t !== tag);
    const { error } = await supabase.from('enrollments').update({ tags: updated }).eq('id', enrollment.id);
    if (!error) onUpdate(enrollment.id, { tags: updated });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(enrollment.tags || []).map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 bg-brand-primary/10 dark:bg-brand-secondary/10 text-brand-primary dark:text-brand-secondary text-xs font-medium px-2.5 py-1 rounded-full">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          placeholder="Nova tag..."
          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary outline-none"
        />
        <button
          onClick={addTag}
          disabled={saving || !newTag.trim()}
          className="px-3 py-1.5 text-xs bg-brand-primary text-white rounded-lg disabled:opacity-40 hover:bg-brand-primary-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────
interface DrawerProps {
  enrollment: Enrollment | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Enrollment>) => void;
}

function EnrollmentDrawer({ enrollment: enr, onClose, onUpdate }: DrawerProps) {
  const { profile } = useAdminAuth();
  const { identity } = useBranding();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState<EnrollmentStatus | ''>('');
  const [archiveReason, setArchiveReason] = useState('');
  const [tab, setTab] = useState<'details' | 'docs' | 'timeline'>('details');
  const [section, setSection] = useState<'guardian' | 'student' | 'parents'>('guardian');
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState<'docs' | 'interview' | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (enr) {
      setNotes(enr.internal_notes || '');
      setNewStatus('');
      setArchiveReason('');
    }
  }, [enr]);

  if (!enr) return null;

  const currentPipeline = PIPELINE.find((p) => p.key === enr.status) || PIPELINE[0];

  function startEditing() {
    setEditData({
      guardian_name: enr!.guardian_name, guardian_cpf: enr!.guardian_cpf, guardian_phone: enr!.guardian_phone,
      guardian_email: enr!.guardian_email || '', guardian_street: enr!.guardian_street, guardian_number: enr!.guardian_number,
      guardian_complement: enr!.guardian_complement || '', guardian_neighborhood: enr!.guardian_neighborhood,
      guardian_city: enr!.guardian_city, guardian_state: enr!.guardian_state,
      student_name: enr!.student_name, student_birth_date: enr!.student_birth_date, student_cpf: enr!.student_cpf || '',
      last_grade: enr!.last_grade || '', previous_school_name: enr!.previous_school_name || '',
      father_name: enr!.father_name, father_cpf: enr!.father_cpf, father_phone: enr!.father_phone, father_email: enr!.father_email || '',
      mother_name: enr!.mother_name, mother_cpf: enr!.mother_cpf, mother_phone: enr!.mother_phone, mother_email: enr!.mother_email || '',
    });
    setEditing(true);
  }

  async function saveEdits() {
    setSaving(true);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(editData)) {
      const orig = (enr as unknown as Record<string, unknown>)[k];
      if (v !== (orig || '')) patch[k] = v || null;
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('enrollments').update(patch).eq('id', enr!.id);
      if (!error) {
        logAudit({ action: 'update', module: 'enrollments', recordId: enr!.id, description: `Dados da matrícula editados: ${Object.keys(patch).join(', ')}`, newData: patch });
        onUpdate(enr!.id, patch as Partial<Enrollment>);
        await supabase.from('enrollment_history').insert({
          enrollment_id: enr!.id, event_type: 'data_edit',
          description: `Dados editados: ${Object.keys(patch).join(', ')}`, created_by: profile?.id || null,
        });
      }
    }
    setEditing(false);
    setSaving(false);
  }

  const ef = (key: string) => editData[key] ?? '';
  const setEf = (key: string, val: string) => setEditData((prev) => ({ ...prev, [key]: val }));
  const editFieldClass = 'w-full px-2 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none';

  async function changeStatus() {
    if (!newStatus || !enr) return;
    setSaving(true);
    const patch: Record<string, unknown> = {
      status: newStatus,
      reviewed_by: profile?.id || null,
    };
    if (newStatus === 'confirmed') {
      patch.confirmed_at = new Date().toISOString();
    }
    if (newStatus === 'archived') {
      if (!archiveReason.trim()) { setSaving(false); return; }
      patch.archive_reason = archiveReason;
      patch.archived_at = new Date().toISOString();
    }
    const { error } = await supabase.from('enrollments').update(patch).eq('id', enr.id);
    if (!error) {
      logAudit({ action: 'status_change', module: 'enrollments', recordId: enr.id, description: `Status da matrícula de ${enr.student_name || enr.guardian_name} alterado para ${newStatus}`, oldData: { status: enr.status }, newData: { status: newStatus } });
      if (newStatus === 'confirmed') {
        const { data: numData } = await supabase.rpc('generate_enrollment_number');
        const enrollNum = (numData as string) || `${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
        await supabase.from('enrollments').update({ enrollment_number: enrollNum }).eq('id', enr.id);
        await supabase.from('students').insert({
          enrollment_id: enr.id,
          enrollment_number: enrollNum,
          full_name: enr.student_name,
          birth_date: enr.student_birth_date || null,
          cpf: enr.student_cpf || null,
          guardian_name: enr.guardian_name,
          guardian_phone: enr.guardian_phone,
          guardian_email: enr.guardian_email || null,
          status: 'active',
        });
      }
      onUpdate(enr.id, patch as Partial<Enrollment>);
    }
    setSaving(false);
    setNewStatus('');
  }

  async function saveNotes() {
    if (!enr) return;
    setSaving(true);
    const { error } = await supabase.from('enrollments').update({ internal_notes: notes }).eq('id', enr.id);
    if (!error) {
      logAudit({ action: 'update', module: 'enrollments', recordId: enr.id, description: `Notas internas atualizadas na matrícula de ${enr.student_name || enr.guardian_name}` });
      onUpdate(enr.id, { internal_notes: notes });
      await supabase.from('enrollment_history').insert({
        enrollment_id: enr.id,
        event_type: 'note',
        description: 'Notas internas atualizadas',
        created_by: profile?.id || null,
      });
    }
    setSaving(false);
  }

  async function createAppointment(reason: string) {
    if (!enr) return;
    setCreatingAppointment(reason === 'Entrega de documentos' ? 'docs' : 'interview');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const { error } = await supabase.from('visit_appointments').insert({
      visitor_name: enr.guardian_name,
      visitor_phone: enr.guardian_phone,
      visitor_email: enr.guardian_email || null,
      visit_reason: reason,
      companions: [],
      appointment_date: dateStr,
      appointment_time: '09:00',
      duration_minutes: 30,
      status: 'pending',
      origin: 'internal',
      enrollment_id: enr.id,
    });

    if (!error) {
      logAudit({ action: 'create', module: 'enrollments', recordId: enr.id, description: `Agendamento criado a partir da matrícula: ${reason}` });
      await supabase.from('enrollment_history').insert({
        enrollment_id: enr.id,
        event_type: 'appointment_created',
        description: `Agendamento criado: ${reason}`,
        created_by: profile?.id || null,
      });
    }
    setCreatingAppointment(null);
  }

  const pendingDocsCount = (() => {
    const cl = enr.docs_checklist || {};
    return Object.values(cl).filter((v) => !v).length;
  })();

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-brand-primary/10 dark:bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-brand-primary dark:text-brand-secondary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{enr.student_name}</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${currentPipeline.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${currentPipeline.dot}`} />
                  {currentPipeline.label}
                </span>
                {enr.enrollment_number && (
                  <span className="text-xs text-gray-400">#{enr.enrollment_number}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ml-2 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-5 flex-shrink-0">
          {([
            ['details', 'Detalhes', User],
            ['docs', 'Documentos', ClipboardCheck],
            ['timeline', 'Histórico', History],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all ${
                tab === key
                  ? 'border-brand-primary dark:border-brand-secondary text-brand-primary dark:text-brand-secondary'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {key === 'docs' && pendingDocsCount > 0 && (
                <span className="bg-amber-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingDocsCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ── Details tab ── */}
          {tab === 'details' && (
            <>
              {/* Meta */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Criado', value: formatDate(enr.created_at) },
                  { label: 'Origem', value: ORIGIN_LABELS[enr.origin] || enr.origin },
                  { label: 'Idade', value: `${age(enr.student_birth_date)} anos` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                  </div>
                ))}
              </div>

              {/* Segment */}
              {enr.segment && (
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {SEGMENT_OPTIONS.find((s) => s.value === enr.segment)?.label || enr.segment}
                  </span>
                </div>
              )}

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Tags</label>
                <TagsManager enrollment={enr} onUpdate={onUpdate} />
              </div>

              {/* Edit toggle + Detail sections */}
              <div className="flex items-center justify-between">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1 flex-1">
                  {([['guardian', 'Responsável'], ['student', 'Aluno'], ['parents', 'Pais']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSection(key)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        section === key
                          ? 'bg-white dark:bg-gray-700 text-brand-primary dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {!editing ? (
                  <button onClick={startEditing} className="ml-2 p-1.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Editar dados">
                    <Edit3 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="ml-2 flex gap-1">
                    <button onClick={saveEdits} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Salvar">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Cancelar">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {section === 'guardian' && !editing && (
                <div className="space-y-2">
                  {[
                    { label: 'Nome', value: enr.guardian_name, icon: User },
                    { label: 'CPF', value: enr.guardian_cpf, icon: FileText },
                    { label: 'Telefone', value: enr.guardian_phone, icon: Phone },
                    { label: 'E-mail', value: enr.guardian_email || '—', icon: FileText },
                    { label: 'Endereço', value: `${enr.guardian_street}, ${enr.guardian_number}${enr.guardian_complement ? `, ${enr.guardian_complement}` : ''} — ${enr.guardian_neighborhood}, ${enr.guardian_city}/${enr.guardian_state}`, icon: MapPin },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
                      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {section === 'guardian' && editing && (
                <div className="space-y-2">
                  {([
                    ['guardian_name', 'Nome'], ['guardian_cpf', 'CPF'], ['guardian_phone', 'Telefone'], ['guardian_email', 'E-mail'],
                    ['guardian_street', 'Rua'], ['guardian_number', 'Número'], ['guardian_complement', 'Complemento'],
                    ['guardian_neighborhood', 'Bairro'], ['guardian_city', 'Cidade'], ['guardian_state', 'Estado'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                      <input value={ef(key)} onChange={(e) => setEf(key, e.target.value)} className={editFieldClass} />
                    </div>
                  ))}
                </div>
              )}

              {section === 'student' && !editing && (
                <div className="space-y-2">
                  {[
                    { label: 'Nome', value: enr.student_name },
                    { label: 'Nascimento', value: `${formatDate(enr.student_birth_date)} (${age(enr.student_birth_date)} anos)` },
                    { label: 'CPF', value: enr.student_cpf || '—' },
                    { label: 'Primeira escola', value: enr.first_school ? 'Sim' : 'Não' },
                    { label: 'Última série', value: enr.last_grade || '—' },
                    { label: 'Escola anterior', value: enr.previous_school_name || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col py-2 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
                    </div>
                  ))}
                </div>
              )}
              {section === 'student' && editing && (
                <div className="space-y-2">
                  {([
                    ['student_name', 'Nome'], ['student_birth_date', 'Data de Nascimento'], ['student_cpf', 'CPF'],
                    ['last_grade', 'Última série'], ['previous_school_name', 'Escola anterior'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                      <input type={key === 'student_birth_date' ? 'date' : 'text'} value={ef(key)} onChange={(e) => setEf(key, e.target.value)} className={editFieldClass} />
                    </div>
                  ))}
                </div>
              )}

              {section === 'parents' && !editing && (
                <div className="space-y-4">
                  {[
                    { title: 'Pai', name: enr.father_name, cpf: enr.father_cpf, phone: enr.father_phone, email: enr.father_email },
                    { title: 'Mãe', name: enr.mother_name, cpf: enr.mother_cpf, phone: enr.mother_phone, email: enr.mother_email },
                  ].map(({ title, name, cpf, phone, email }) => (
                    <div key={title} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{name || '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">CPF: {cpf || '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tel: {phone || '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">E-mail: {email || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
              {section === 'parents' && editing && (
                <div className="space-y-4">
                  {([
                    { title: 'Pai', prefix: 'father' },
                    { title: 'Mãe', prefix: 'mother' },
                  ] as const).map(({ title, prefix }) => (
                    <div key={prefix} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
                      {(['name', 'cpf', 'phone', 'email'] as const).map((f) => {
                        const key = `${prefix}_${f}`;
                        const labels: Record<string, string> = { name: 'Nome', cpf: 'CPF', phone: 'Telefone', email: 'E-mail' };
                        return (
                          <div key={key}>
                            <p className="text-[10px] text-gray-400 uppercase mb-0.5">{labels[f]}</p>
                            <input value={ef(key)} onChange={(e) => setEf(key, e.target.value)} className={editFieldClass} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Internal notes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Notas internas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas visíveis apenas para a equipe..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={saveNotes}
                    disabled={saving || notes === (enr.internal_notes || '')}
                    className="text-xs px-3 py-1.5 bg-brand-primary text-white rounded-lg disabled:opacity-40 hover:bg-brand-primary-dark transition-colors"
                  >
                    {saving ? 'Salvando...' : 'Salvar notas'}
                  </button>
                </div>
              </div>

              {/* Status change */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Alterar status</label>
                <div className="relative">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as EnrollmentStatus)}
                    className="w-full px-3 py-2.5 pr-9 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none appearance-none"
                  >
                    <option value="">Selecione o novo status...</option>
                    {PIPELINE.filter((p) => p.key !== enr.status).map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>

                {newStatus === 'archived' && (
                  <textarea
                    value={archiveReason}
                    onChange={(e) => setArchiveReason(e.target.value)}
                    rows={2}
                    placeholder="Motivo do arquivamento (obrigatório)..."
                    className="mt-2 w-full px-3 py-2 text-sm rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 outline-none resize-none"
                  />
                )}

                {newStatus && (
                  <button
                    onClick={changeStatus}
                    disabled={saving || (newStatus === 'archived' && !archiveReason.trim())}
                    className="mt-2 w-full py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    {saving ? 'Salvando...' : `Mover para "${PIPELINE.find((p) => p.key === newStatus)?.label}"`}
                  </button>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowWhatsApp(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl text-sm font-medium transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Enviar WhatsApp
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => createAppointment('Entrega de documentos')}
                    disabled={creatingAppointment === 'docs'}
                    className="flex items-center justify-center gap-1.5 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    {creatingAppointment === 'docs' ? 'Criando...' : 'Agendar Docs'}
                  </button>
                  <button
                    onClick={() => createAppointment('Entrevista de matrícula')}
                    disabled={creatingAppointment === 'interview'}
                    className="flex items-center justify-center gap-1.5 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    {creatingAppointment === 'interview' ? 'Criando...' : 'Agendar Entrevista'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Docs tab ── */}
          {tab === 'docs' && (
            <DocsChecklistTab enrollment={enr} onUpdate={onUpdate} />
          )}

          {/* ── Timeline tab ── */}
          {tab === 'timeline' && (
            <TimelineTab enrollmentId={enr.id} />
          )}
        </div>
      </aside>

      {showWhatsApp && enr && (
        <SendWhatsAppModal
          module="matricula"
          phone={enr.guardian_phone}
          recipientName={enr.guardian_name}
          recordId={enr.id}
          variables={{
            guardian_name:      enr.guardian_name,
            student_name:       enr.student_name,
            enrollment_status:  PIPELINE.find((p) => p.key === enr.status)?.label || enr.status,
            enrollment_number:  enr.enrollment_number || 'Pendente',
            pending_docs:       '',
            school_name:        identity.school_name || '',
            current_date:       new Date().toLocaleDateString('pt-BR'),
          }}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </>
  );
}

// ── Manual Creation Modal ────────────────────────────────────────────────────
interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

// ── Mask helpers ─────────────────────────────────────────────────────────────
function maskCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

function isValidCPF(cpf: string) {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i);
  let r = (sum * 10) % 11; if (r >= 10) r = 0;
  if (r !== +d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i);
  r = (sum * 10) % 11; if (r >= 10) r = 0;
  return r === +d[10];
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function CreateEnrollmentModal({ onClose, onCreated }: CreateModalProps) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    origin: 'in_person' as string,
    segment: '',
    guardian_name: '',
    guardian_cpf: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_zip_code: '',
    guardian_street: '',
    guardian_number: '',
    guardian_complement: '',
    guardian_neighborhood: '',
    guardian_city: '',
    guardian_state: 'PE',
    student_name: '',
    student_birth_date: '',
    student_cpf: '',
    first_school: false,
    last_grade: '',
    previous_school_name: '',
    father_name: '',
    father_cpf: '',
    father_phone: '',
    father_email: '',
    mother_name: '',
    mother_cpf: '',
    mother_phone: '',
    mother_email: '',
    internal_notes: '',
  });

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const fieldClass = (err?: string) =>
    `w-full px-3 py-2 text-sm rounded-xl border ${err ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : 'border-gray-200 dark:border-gray-700 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-brand-primary/20'} bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 outline-none`;
  const labelClass = 'block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';

  const setCPF = (key: string, raw: string) => {
    const masked = maskCPF(raw);
    set(key, masked);
    const digits = masked.replace(/\D/g, '');
    if (digits.length === 11) {
      setErrors((p) => ({ ...p, [key]: isValidCPF(masked) ? '' : 'CPF inválido' }));
    } else {
      setErrors((p) => ({ ...p, [key]: '' }));
    }
  };

  const setPhone = (key: string, raw: string) => {
    set(key, maskPhone(raw));
    setErrors((p) => ({ ...p, [key]: '' }));
  };

  const setEmail = (key: string, val: string) => {
    set(key, val);
    setErrors((p) => ({ ...p, [key]: val && !isValidEmail(val) ? 'E-mail inválido' : '' }));
  };

  // ── Field helpers ──
  const cpfField = (key: string, label: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        value={(form as unknown as Record<string, string>)[key]}
        onChange={(e) => setCPF(key, e.target.value)}
        placeholder="000.000.000-00"
        className={fieldClass(errors[key])}
        inputMode="numeric"
      />
      {errors[key] && <p className="text-[10px] text-red-500 mt-0.5">{errors[key]}</p>}
    </div>
  );

  const phoneField = (key: string, label: string, required = false) => (
    <div>
      <label className={labelClass}>{label}{required && ' *'}</label>
      <input
        value={(form as unknown as Record<string, string>)[key]}
        onChange={(e) => setPhone(key, e.target.value)}
        placeholder="(00) 00000-0000"
        className={fieldClass(errors[key])}
        inputMode="numeric"
        required={required}
      />
    </div>
  );

  const emailField = (key: string, label: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="email"
        value={(form as unknown as Record<string, string>)[key]}
        onChange={(e) => setEmail(key, e.target.value)}
        placeholder="email@exemplo.com"
        className={fieldClass(errors[key])}
      />
      {errors[key] && <p className="text-[10px] text-red-500 mt-0.5">{errors[key]}</p>}
    </div>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Block if there are active validation errors
    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) return;
    if (!form.guardian_name || !form.guardian_phone || !form.student_name || !form.student_birth_date) return;

    setSaving(true);
    const payload = {
      ...form,
      status: 'new',
      student_zip_code: form.guardian_zip_code,
      student_street: form.guardian_street,
      student_number: form.guardian_number,
      student_complement: form.guardian_complement,
      student_neighborhood: form.guardian_neighborhood,
      student_city: form.guardian_city,
      student_state: form.guardian_state,
      tags: [],
      docs_checklist: {},
    };

    const { error } = await supabase.from('enrollments').insert(payload);
    setSaving(false);
    if (!error) {
      logAudit({ action: 'create', module: 'enrollments', description: `Nova pré-matrícula criada para ${form.student_name || form.guardian_name}`, newData: form as unknown as Record<string, unknown> });
      onCreated();
      onClose();
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white flex-shrink-0">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova Pré-Matrícula
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form id="enrollment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── Origem ── */}
          <SettingsCard title="Origem" description="Canal de entrada da pré-matrícula">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Origem</label>
                <select value={form.origin} onChange={(e) => set('origin', e.target.value)} className={fieldClass()}>
                  <option value="in_person">Presencial</option>
                  <option value="phone">Telefone</option>
                  <option value="referral">Indicação</option>
                  <option value="website">Site</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Segmento</label>
                <select value={form.segment} onChange={(e) => set('segment', e.target.value)} className={fieldClass()}>
                  <option value="">Selecione...</option>
                  {SEGMENT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </SettingsCard>

          {/* ── Responsável ── */}
          <SettingsCard title="Responsável">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Nome *</label>
                <input value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} className={fieldClass()} required />
              </div>
              {emailField('guardian_email', 'E-mail')}
              <div className="grid grid-cols-2 gap-3">
                {cpfField('guardian_cpf', 'CPF')}
                {phoneField('guardian_phone', 'Telefone', true)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>CEP</label>
                  <input value={form.guardian_zip_code} onChange={(e) => set('guardian_zip_code', e.target.value)} className={fieldClass()} />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <input value={form.guardian_state} onChange={(e) => set('guardian_state', e.target.value)} className={fieldClass()} maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Rua</label>
                  <input value={form.guardian_street} onChange={(e) => set('guardian_street', e.target.value)} className={fieldClass()} />
                </div>
                <div>
                  <label className={labelClass}>Número</label>
                  <input value={form.guardian_number} onChange={(e) => set('guardian_number', e.target.value)} className={fieldClass()} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Bairro</label>
                  <input value={form.guardian_neighborhood} onChange={(e) => set('guardian_neighborhood', e.target.value)} className={fieldClass()} />
                </div>
                <div>
                  <label className={labelClass}>Cidade</label>
                  <input value={form.guardian_city} onChange={(e) => set('guardian_city', e.target.value)} className={fieldClass()} />
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* ── Aluno ── */}
          <SettingsCard title="Aluno">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Nome *</label>
                <input value={form.student_name} onChange={(e) => set('student_name', e.target.value)} className={fieldClass()} required />
              </div>
              <div>
                <label className={labelClass}>Data de Nascimento *</label>
                <input type="date" value={form.student_birth_date} onChange={(e) => set('student_birth_date', e.target.value)} className={fieldClass()} required />
              </div>
              {cpfField('student_cpf', 'CPF')}
              <div className="col-span-2">
                <Toggle
                  checked={form.first_school as boolean}
                  onChange={(v) => set('first_school', v)}
                  label="Primeira escola"
                />
              </div>
              {!form.first_school && (
                <>
                  <div>
                    <label className={labelClass}>Última série</label>
                    <input value={form.last_grade} onChange={(e) => set('last_grade', e.target.value)} className={fieldClass()} />
                  </div>
                  <div>
                    <label className={labelClass}>Escola anterior</label>
                    <input value={form.previous_school_name} onChange={(e) => set('previous_school_name', e.target.value)} className={fieldClass()} />
                  </div>
                </>
              )}
            </div>
          </SettingsCard>

          {/* ── Pai ── */}
          <SettingsCard title="Pai">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Nome</label>
                <input value={form.father_name} onChange={(e) => set('father_name', e.target.value)} className={fieldClass()} />
              </div>
              {emailField('father_email', 'E-mail')}
              <div className="grid grid-cols-2 gap-3">
                {cpfField('father_cpf', 'CPF')}
                {phoneField('father_phone', 'Telefone')}
              </div>
            </div>
          </SettingsCard>

          {/* ── Mãe ── */}
          <SettingsCard title="Mãe">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Nome</label>
                <input value={form.mother_name} onChange={(e) => set('mother_name', e.target.value)} className={fieldClass()} />
              </div>
              {emailField('mother_email', 'E-mail')}
              <div className="grid grid-cols-2 gap-3">
                {cpfField('mother_cpf', 'CPF')}
                {phoneField('mother_phone', 'Telefone')}
              </div>
            </div>
          </SettingsCard>

          {/* ── Observações ── */}
          <SettingsCard title="Observações">
            <textarea
              value={form.internal_notes}
              onChange={(e) => set('internal_notes', e.target.value)}
              rows={3}
              placeholder="Notas internas..."
              className={fieldClass() + ' resize-none'}
            />
          </SettingsCard>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            form="enrollment-form"
            disabled={saving}
            className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Criando...' : 'Criar Pré-Matrícula'}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'all'>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Enrollment | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setEnrollments(data as Enrollment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: keep list in sync with INSERT/UPDATE/DELETE events
  useRealtimeRows<Enrollment>({
    table: 'enrollments',
    setRows: setEnrollments,
    onSelectedPatch: (row) => {
      setSelected((prev) => (prev?.id === row.id ? { ...prev, ...row } : prev));
    },
  });

  function handleUpdate(id: string, patch: Partial<Enrollment>) {
    setEnrollments((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  const filtered = useMemo(() => enrollments.filter((e) => {
    const matchSearch =
      search === '' ||
      e.student_name.toLowerCase().includes(search.toLowerCase()) ||
      e.guardian_name.toLowerCase().includes(search.toLowerCase()) ||
      e.guardian_phone.includes(search);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchSegment = segmentFilter === 'all' || e.segment === segmentFilter;
    return matchSearch && matchStatus && matchSegment;
  }), [enrollments, search, statusFilter, segmentFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: enrollments.length };
    for (const p of PIPELINE) c[p.key] = enrollments.filter((e) => e.status === p.key).length;
    return c;
  }, [enrollments]);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-primary dark:text-white flex items-center gap-3">
            <GraduationCap className="w-8 h-8" />
            Pré-Matrículas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie o pipeline de matrículas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 text-sm bg-brand-primary text-white px-4 py-2.5 rounded-xl hover:bg-brand-primary-dark transition-colors font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Matrícula
          </button>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-primary dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pipeline filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            statusFilter === 'all' ? 'bg-brand-primary text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-brand-primary'
          }`}
        >
          Todos <span className="opacity-70">{counts.all}</span>
        </button>
        {PIPELINE.map((p) => (
          counts[p.key] > 0 || statusFilter === p.key ? (
            <button
              key={p.key}
              onClick={() => setStatusFilter(p.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === p.key
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-brand-primary'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
              {p.label}
              <span className="opacity-70">{counts[p.key]}</span>
            </button>
          ) : null
        ))}
      </div>

      {/* Search + Segment filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
        </div>
        <div className="relative">
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm appearance-none"
          >
            <option value="all">Todos os segmentos</option>
            {SEGMENT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhuma pré-matrícula encontrada.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Aluno / Responsável</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">Contato</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Segmento</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Data</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="py-3 px-5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((enr) => {
                  const p = PIPELINE.find((s) => s.key === enr.status) || PIPELINE[0];
                  return (
                    <tr
                      key={enr.id}
                      onClick={() => setSelected(enr)}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-5">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{enr.student_name}</p>
                        <p className="text-xs text-gray-400">{enr.guardian_name}</p>
                        {enr.tags && enr.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {enr.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{t}</span>
                            ))}
                            {enr.tags.length > 3 && <span className="text-[9px] text-gray-400">+{enr.tags.length - 3}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-5 hidden md:table-cell text-gray-600 dark:text-gray-400">
                        {enr.guardian_phone}
                      </td>
                      <td className="py-3 px-5 hidden lg:table-cell text-gray-500 dark:text-gray-400 text-xs">
                        {SEGMENT_OPTIONS.find((s) => s.value === enr.segment)?.label || enr.segment || '—'}
                      </td>
                      <td className="py-3 px-5 hidden lg:table-cell text-gray-500 dark:text-gray-400 text-xs">
                        {formatDate(enr.created_at)}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${p.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                          {p.label}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {selected && (
        <EnrollmentDrawer
          enrollment={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}

      {showCreate && (
        <CreateEnrollmentModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
