import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useRealtimeRows } from '../../hooks/useRealtimeRows';
import type { ContactRequest, ContactStatus } from '../../types/admin.types';
import SendWhatsAppModal from '../../components/SendWhatsAppModal';
import {
  MessageSquare, Search, X, ChevronRight, Loader2, RefreshCw,
  Phone, Mail, Clock, Star, ChevronDown, MessageCircle,
  History, GraduationCap, CalendarPlus, Filter, AlertTriangle,
} from 'lucide-react';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; dot: string }> = {
  new:           { label: 'Novo',            color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500' },
  first_contact: { label: 'Primeiro Contato',color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  follow_up:     { label: 'Follow-up',       color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',   dot: 'bg-amber-400' },
  resolved:      { label: 'Resolvido',       color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  archived:      { label: 'Arquivado',       color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',          dot: 'bg-gray-400' },
  contacted:     { label: 'Contactado',      color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',       dot: 'bg-cyan-500' },
  converted:     { label: 'Convertido',      color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',   dot: 'bg-green-600' },
  closed:        { label: 'Fechado',         color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',          dot: 'bg-gray-500' },
};

const REASON_LABELS: Record<string, string> = {
  matricula: 'Interesse em Matrícula', informacoes: 'Informações Gerais',
  financeiro: 'Financeiro', pedagogico: 'Pedagógico',
  infraestrutura: 'Infraestrutura', outros: 'Outros',
};

const BEST_TIME_LABELS: Record<string, string> = { morning: 'Manhã', afternoon: 'Tarde' };

function formatDate(d: string) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatDateTime(d: string) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }

function agingText(createdAt: string): { text: string; warn: boolean } {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3600000);
  if (hours < 24) return { text: `${hours}h`, warn: false };
  const days = Math.floor(hours / 24);
  return { text: `${days}d`, warn: days >= 2 };
}

// ── History ──────────────────────────────────────────────────────────────────
interface HistoryEntry { id: string; event_type: string; description: string; created_at: string; }

function TimelineTab({ contactId }: { contactId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('contact_history')
      .select('id, event_type, description, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setHistory((data as HistoryEntry[]) || []); setLoading(false); });
  }, [contactId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;
  if (history.length === 0) return <p className="text-xs text-gray-400 text-center py-4">Nenhum evento registrado.</p>;

  return (
    <div className="space-y-3">
      {history.map((e) => (
        <div key={e.id} className="flex gap-2.5">
          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            {e.event_type === 'whatsapp_sent' ? <MessageCircle className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
          <div>
            <p className="text-xs text-gray-700 dark:text-gray-300">{e.description}</p>
            <p className="text-[10px] text-gray-400">{formatDateTime(e.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────
interface DrawerProps {
  contact: ContactRequest | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<ContactRequest>) => void;
  onRefresh: () => void;
}

function ContactDrawer({ contact, onClose, onUpdate, onRefresh: _onRefresh }: DrawerProps) {
  const { profile } = useAdminAuth();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState<ContactStatus | ''>('');
  const [nextDate, setNextDate] = useState('');
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [tab, setTab] = useState<'info' | 'timeline'>('info');
  const [converting, setConverting] = useState<'enrollment' | 'appointment' | null>(null);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [adminProfiles, setAdminProfiles] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').in('role', ['super_admin', 'admin', 'coordinator']).eq('is_active', true)
      .then(({ data }) => setAdminProfiles((data as { id: string; full_name: string }[]) || []));
  }, []);

  useEffect(() => {
    if (contact) {
      setNotes(contact.internal_notes || '');
      setNewStatus('');
      setNextDate(contact.next_contact_date || '');
      setAssignedTo(contact.assigned_to || '');
      setTab('info');
    }
  }, [contact]);

  if (!contact) return null;
  const s = STATUS_CONFIG[contact.status] || STATUS_CONFIG.new;

  async function changeStatus() {
    if (!newStatus) return;
    setSaving(true);
    const { error } = await supabase.from('contact_requests').update({ status: newStatus }).eq('id', contact!.id);
    if (!error) onUpdate(contact!.id, { status: newStatus });
    setSaving(false);
    setNewStatus('');
  }

  async function saveNotes() {
    setSaving(true);
    const { error } = await supabase.from('contact_requests').update({ internal_notes: notes }).eq('id', contact!.id);
    if (!error) {
      onUpdate(contact!.id, { internal_notes: notes });
      await supabase.from('contact_history').insert({
        contact_id: contact!.id, event_type: 'note', description: 'Notas internas atualizadas', created_by: profile?.id || null,
      });
    }
    setSaving(false);
  }

  async function saveNextDate() {
    setSaving(true);
    const { error } = await supabase.from('contact_requests').update({ next_contact_date: nextDate || null }).eq('id', contact!.id);
    if (!error) onUpdate(contact!.id, { next_contact_date: nextDate || null });
    setSaving(false);
  }

  async function saveAssignedTo(newAssigned: string) {
    setAssignedTo(newAssigned);
    const val = newAssigned || null;
    await supabase.from('contact_requests').update({ assigned_to: val }).eq('id', contact!.id);
    onUpdate(contact!.id, { assigned_to: val });
  }

  async function toggleLead() {
    setSaving(true);
    const newVal = !contact!.is_lead;
    const { error } = await supabase.from('contact_requests').update({ is_lead: newVal }).eq('id', contact!.id);
    if (!error) onUpdate(contact!.id, { is_lead: newVal });
    setSaving(false);
  }

  async function convertToEnrollment() {
    setConverting('enrollment');
    const { data, error } = await supabase.from('enrollments').insert({
      guardian_name: contact!.name,
      guardian_cpf: '',
      guardian_phone: contact!.phone,
      guardian_email: contact!.email || null,
      guardian_zip_code: '', guardian_street: '', guardian_number: '',
      guardian_neighborhood: '', guardian_city: '', guardian_state: 'PE',
      student_name: '',
      student_birth_date: '2020-01-01',
      student_zip_code: '', student_street: '', student_number: '',
      student_neighborhood: '', student_city: '', student_state: 'PE',
      father_name: '', father_cpf: '', father_phone: '', mother_name: '', mother_cpf: '', mother_phone: '',
      segment: contact!.segment_interest || null,
      origin: 'website',
      status: 'new',
      tags: [],
      docs_checklist: {},
      internal_notes: `Convertido do contato #${contact!.id.slice(0,8)}`,
    }).select('id').single();

    if (!error && data) {
      await supabase.from('contact_requests').update({
        status: 'converted',
        converted_to_enrollment_id: data.id,
      }).eq('id', contact!.id);
      onUpdate(contact!.id, { status: 'converted' as ContactStatus, converted_to_enrollment_id: data.id });
      await supabase.from('contact_history').insert({
        contact_id: contact!.id, event_type: 'conversion', description: 'Convertido em pré-matrícula', created_by: profile?.id || null,
      });
    }
    setConverting(null);
  }

  async function convertToAppointment() {
    setConverting('appointment');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const { data, error } = await supabase.from('visit_appointments').insert({
      visitor_name: contact!.name,
      visitor_phone: contact!.phone,
      visitor_email: contact!.email || null,
      visit_reason: 'conhecer_escola',
      companions: [],
      appointment_date: dateStr,
      appointment_time: '09:00',
      duration_minutes: 30,
      status: 'pending',
      origin: 'internal',
      contact_request_id: contact!.id,
    }).select('id').single();

    if (!error && data) {
      await supabase.from('contact_requests').update({
        converted_to_appointment_id: data.id,
      }).eq('id', contact!.id);
      onUpdate(contact!.id, { converted_to_appointment_id: data.id });
      await supabase.from('contact_history').insert({
        contact_id: contact!.id, event_type: 'appointment_created', description: 'Visita agendada a partir do contato', created_by: profile?.id || null,
      });
    }
    setConverting(null);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[#003876]/10 dark:bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{contact.name}</p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
                </span>
                {contact.is_lead && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#ffd700]/20 text-yellow-700 dark:text-yellow-400">
                    <Star className="w-3 h-3" /> Lead
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ml-2 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-5 flex-shrink-0">
          {([['info', 'Detalhes', MessageSquare], ['timeline', 'Histórico', History]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all ${
                tab === key
                  ? 'border-[#003876] dark:border-[#ffd700] text-[#003876] dark:text-[#ffd700]'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'info' && (
            <>
              {/* Contact info */}
              <div className="space-y-2">
                {[
                  { icon: Phone, label: 'Telefone', value: contact.phone },
                  { icon: Mail, label: 'E-mail', value: contact.email || '—' },
                  { icon: Clock, label: 'Melhor horário', value: BEST_TIME_LABELS[contact.best_time || ''] || '—' },
                  { icon: MessageSquare, label: 'Motivo', value: REASON_LABELS[contact.contact_reason || ''] || contact.contact_reason || '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {contact.message && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Mensagem</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{contact.message}</p>
                </div>
              )}

              {/* Interests grid */}
              <div className="grid grid-cols-2 gap-2">
                {contact.segment_interest && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                    <p className="text-[10px] text-gray-400 uppercase mb-0.5">Segmento</p>
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{contact.segment_interest}</p>
                  </div>
                )}
                {contact.student_count && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                    <p className="text-[10px] text-gray-400 uppercase mb-0.5">Nº de alunos</p>
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{contact.student_count}</p>
                  </div>
                )}
                {contact.how_found_us && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                    <p className="text-[10px] text-gray-400 uppercase mb-0.5">Como nos encontrou</p>
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{contact.how_found_us}</p>
                  </div>
                )}
                {contact.wants_visit && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2.5">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase mb-0.5">Visita</p>
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Quer agendar visita</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">Recebido em {formatDate(contact.created_at)}</p>

              {/* Lead toggle */}
              <button
                onClick={toggleLead}
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-colors ${
                  contact.is_lead
                    ? 'bg-[#ffd700]/20 text-yellow-700 dark:text-yellow-400 border border-[#ffd700]/30'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#ffd700]'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${contact.is_lead ? 'fill-current' : ''}`} />
                {contact.is_lead ? 'Remover qualificação de Lead' : 'Qualificar como Lead'}
              </button>

              {/* Next contact date */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Próximo contato</label>
                <div className="flex gap-2">
                  <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none" />
                  <button onClick={saveNextDate} disabled={saving || nextDate === (contact.next_contact_date || '')}
                    className="px-3 py-2 bg-[#003876] text-white rounded-xl text-xs disabled:opacity-40 hover:bg-[#002855] transition-colors">
                    {saving ? '...' : 'Salvar'}
                  </button>
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Responsável</label>
                <div className="relative">
                  <select value={assignedTo} onChange={(e) => saveAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 pr-9 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none appearance-none">
                    <option value="">Ninguém atribuído</option>
                    {adminProfiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Internal notes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Notas internas</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas visíveis apenas para a equipe..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none resize-none" />
                <div className="flex justify-end mt-2">
                  <button onClick={saveNotes} disabled={saving || notes === (contact.internal_notes || '')}
                    className="text-xs px-3 py-1.5 bg-[#003876] text-white rounded-lg disabled:opacity-40 hover:bg-[#002855] transition-colors">
                    {saving ? 'Salvando...' : 'Salvar notas'}
                  </button>
                </div>
              </div>

              {/* Status change */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Alterar status</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ContactStatus)}
                      className="w-full px-3 py-2.5 pr-9 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none appearance-none">
                      <option value="">Selecionar status...</option>
                      {(Object.entries(STATUS_CONFIG) as [ContactStatus, typeof STATUS_CONFIG[ContactStatus]][])
                        .filter(([k]) => k !== contact.status)
                        .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button onClick={changeStatus} disabled={!newStatus || saving}
                    className="px-4 py-2 bg-[#003876] text-white rounded-xl text-sm disabled:opacity-40 hover:bg-[#002855] transition-colors">
                    {saving ? '...' : 'OK'}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <button onClick={() => setShowWhatsApp(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl text-sm font-medium transition-colors">
                  <MessageCircle className="w-4 h-4" /> Enviar WhatsApp
                </button>

                {!contact.converted_to_enrollment_id && (
                  <button onClick={convertToEnrollment} disabled={converting === 'enrollment'}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-[#003876]/20 dark:border-[#ffd700]/20 text-[#003876] dark:text-[#ffd700] hover:bg-[#003876]/5 dark:hover:bg-[#ffd700]/5 rounded-xl text-xs font-medium transition-colors disabled:opacity-40">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {converting === 'enrollment' ? 'Convertendo...' : 'Converter em Pré-Matrícula'}
                  </button>
                )}
                {contact.converted_to_enrollment_id && (
                  <div className="text-center py-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    Convertido em pré-matrícula
                  </div>
                )}

                {!contact.converted_to_appointment_id && (
                  <button onClick={convertToAppointment} disabled={converting === 'appointment'}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium transition-colors disabled:opacity-40">
                    <CalendarPlus className="w-3.5 h-3.5" />
                    {converting === 'appointment' ? 'Agendando...' : 'Agendar Visita'}
                  </button>
                )}
                {contact.converted_to_appointment_id && (
                  <div className="text-center py-1.5 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    Visita agendada
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'timeline' && <TimelineTab contactId={contact.id} />}
        </div>
      </aside>

      {showWhatsApp && contact && (
        <SendWhatsAppModal
          module="contato"
          phone={contact.phone}
          recipientName={contact.name}
          recordId={contact.id}
          variables={{
            contact_name: contact.name,
            contact_phone: contact.phone,
            contact_reason: REASON_LABELS[contact.contact_reason || ''] || contact.contact_reason || '',
            contact_status: STATUS_CONFIG[contact.status]?.label || contact.status,
            school_name: 'Colégio Batista',
            current_date: new Date().toLocaleDateString('pt-BR'),
          }}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<ContactRequest | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setContacts(data as ContactRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: keep list in sync with INSERT/UPDATE/DELETE events
  useRealtimeRows<ContactRequest>({
    table: 'contact_requests',
    setRows: setContacts,
    onSelectedPatch: (row) => {
      setSelected((prev) => (prev?.id === row.id ? { ...prev, ...row } : prev));
    },
  });

  function handleUpdate(id: string, patch: Partial<ContactRequest>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  const reasons = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => { if (c.contact_reason) set.add(c.contact_reason); });
    return Array.from(set);
  }, [contacts]);

  const filtered = useMemo(() => contacts.filter((c) => {
    const matchSearch = search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchReason = reasonFilter === 'all' || c.contact_reason === reasonFilter;
    const cDate = c.created_at.split('T')[0];
    const matchDateFrom = !dateFrom || cDate >= dateFrom;
    const matchDateTo = !dateTo || cDate <= dateTo;
    return matchSearch && matchStatus && matchReason && matchDateFrom && matchDateTo;
  }), [contacts, search, statusFilter, reasonFilter, dateFrom, dateTo]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: contacts.length };
    for (const k of Object.keys(STATUS_CONFIG) as ContactStatus[]) c[k] = contacts.filter((x) => x.status === k).length;
    return c;
  }, [contacts]);

  const activeStatuses = (Object.keys(STATUS_CONFIG) as ContactStatus[]).filter((k) => counts[k] > 0 || k === statusFilter);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <MessageSquare className="w-8 h-8" />
            Contatos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as solicitações de contato.</p>
        </div>
        <button onClick={fetchData}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#003876] dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === 'all' ? 'bg-[#003876] text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#003876]'}`}>
          Todos <span className="opacity-70">{counts.all}</span>
        </button>
        {activeStatuses.map((k) => {
          const sc = STATUS_CONFIG[k];
          return (
            <button key={k} onClick={() => setStatusFilter(k)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === k ? 'bg-[#003876] text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#003876]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
              <span className="opacity-70">{counts[k]}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar por nome, telefone ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
        </div>
        <div className="relative">
          <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none text-sm appearance-none">
            <option value="all">Todos os motivos</option>
            {reasons.map((r) => <option key={r} value={r}>{REASON_LABELS[r] || r}</option>)}
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Data inicial"
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none text-sm" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Data final"
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none text-sm" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-[#003876] animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum contato encontrado.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Contato</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">Motivo</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Data</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Idade</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="py-3 px-5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.new;
                  const aging = agingText(c.created_at);
                  const isUnanswered = ['new'].includes(c.status);
                  return (
                    <tr key={c.id} onClick={() => setSelected(c)}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-gray-800 dark:text-gray-200">{c.name}</p>
                              {c.is_lead && <Star className="w-3 h-3 text-[#ffd700] fill-[#ffd700]" />}
                            </div>
                            <p className="text-xs text-gray-400">{c.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 hidden md:table-cell text-gray-600 dark:text-gray-400 text-xs">
                        {REASON_LABELS[c.contact_reason || ''] || c.contact_reason || '—'}
                      </td>
                      <td className="py-3 px-5 hidden lg:table-cell text-gray-500 dark:text-gray-400 text-xs">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="py-3 px-5 hidden lg:table-cell">
                        {isUnanswered && aging.warn ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                            <AlertTriangle className="w-3 h-3" /> {aging.text}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">{aging.text}</span>
                        )}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} /> {sc.label}
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
            {filtered.length} contato{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {selected && (
        <ContactDrawer contact={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} onRefresh={fetchData} />
      )}
    </div>
  );
}
