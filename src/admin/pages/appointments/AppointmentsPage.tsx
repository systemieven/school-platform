import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useRealtimeRows } from '../../hooks/useRealtimeRows';
import type { VisitAppointment, AppointmentStatus } from '../../types/admin.types';
import SendWhatsAppModal from '../../components/SendWhatsAppModal';
import {
  CalendarCheck, Search, X, ChevronRight, ChevronDown, Loader2,
  User, Phone, Clock, MapPin, Check, Ban, CheckCircle2,
  AlertCircle, RefreshCw, MessageCircle,
  History, Filter, Square, CheckSquare,
  LayoutList, CalendarDays, ChevronLeft,
  StickyNote, Send,
} from 'lucide-react';
import { SettingsCard } from '../../components/SettingsCard';
import { useBranding } from '../../../contexts/BrandingContext';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; dot: string }> = {
  pending:        { label: 'Pendente',     color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',  dot: 'bg-amber-400' },
  confirmed:      { label: 'Confirmado',   color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  comparecimento: { label: 'Compareceu',   color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  completed:      { label: 'Realizado',    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  cancelled:      { label: 'Cancelado',    color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',      dot: 'bg-red-400' },
  no_show:        { label: 'Não Veio',     color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',     dot: 'bg-gray-400' },
};

// Fallback — overridden by visit_settings from DB
const DEFAULT_REASON_LABELS: Record<string, string> = {
  conhecer_escola:      'Conhecer a Escola',
  matricula:            'Pré-Matrícula',
  entrega_documentos:   'Entrega de Documentos',
  conversa_pedagogica:  'Conversa Pedagógica',
  outros:               'Outros',
};

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(t: string) { return t.slice(0, 5); }
function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function formatPhone(p: string) {
  const n = p.replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return p;
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : '';
  if (d.length <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ── History entry ────────────────────────────────────────────────────────────
interface HistoryEntry { id: string; event_type: string; description: string; created_at: string; }

function TimelinePanel({ appointmentId }: { appointmentId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('appointment_history')
      .select('id, event_type, description, created_at')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setHistory((data as HistoryEntry[]) || []); setLoading(false); });
  }, [appointmentId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;
  if (history.length === 0) return <p className="text-xs text-gray-400 text-center py-4">Nenhum evento registrado.</p>;

  return (
    <div className="space-y-3">
      {history.map((e) => (
        <div key={e.id} className="flex gap-2.5">
          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ChevronRight className="w-3 h-3" />
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

// ── Create Modal ─────────────────────────────────────────────────────────────
function CreateAppointmentModal({ onClose, onCreated, reasonLabels }: { onClose: () => void; onCreated: () => void; reasonLabels: Record<string, string> }) {
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [form, setForm] = useState({
    visitor_name: '',
    visitor_phone: '',
    visitor_email: '',
    visit_reason: 'conhecer_escola',
    appointment_date: '',
    appointment_time: '09:00',
    notes: '',
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));
  const fieldClass = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none';
  const fieldClassError = `${fieldClass} border-red-400 dark:border-red-500`;
  const labelClass = 'block text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';

  function validateEmail(v: string) {
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setEmailError('E-mail inválido');
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.visitor_name || !form.visitor_phone || !form.appointment_date) return;
    if (!validateEmail(form.visitor_email)) return;
    setSaving(true);
    const { error } = await supabase.from('visit_appointments').insert({
      ...form,
      companions: [],
      duration_minutes: 30,
      status: 'pending',
      origin: 'internal',
    });
    setSaving(false);
    if (!error) {
      logAudit({ action: 'create', module: 'appointments', description: `Agendamento criado para ${form.visitor_name}`, newData: form as Record<string, unknown> });
      onCreated(); onClose();
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4" />
            <h2 className="font-semibold text-sm">Novo Agendamento</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form id="create-appointment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <SettingsCard title="Visitante">
            <div>
              <label className={labelClass}>Nome *</label>
              <input value={form.visitor_name} onChange={(e) => set('visitor_name', e.target.value)} className={fieldClass} placeholder="Nome completo" required />
            </div>
            <div>
              <label className={labelClass}>Telefone *</label>
              <input
                type="tel"
                placeholder="(81) 99999-9999"
                value={form.visitor_phone}
                onChange={(e) => set('visitor_phone', maskPhone(e.target.value))}
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>E-mail</label>
              <input
                type="email"
                placeholder="email@exemplo.com"
                value={form.visitor_email}
                onChange={(e) => { set('visitor_email', e.target.value); if (emailError) validateEmail(e.target.value); }}
                onBlur={(e) => validateEmail(e.target.value)}
                className={emailError ? fieldClassError : fieldClass}
              />
              {emailError && <p className="text-[11px] text-red-500 mt-1">{emailError}</p>}
            </div>
          </SettingsCard>

          <SettingsCard title="Visita">
            <div>
              <label className={labelClass}>Motivo</label>
              <div className="relative">
                <select value={form.visit_reason} onChange={(e) => set('visit_reason', e.target.value)} className={`${fieldClass} appearance-none pr-9`}>
                  {Object.entries(reasonLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Data *</label>
                <input type="date" value={form.appointment_date} onChange={(e) => set('appointment_date', e.target.value)} className={fieldClass} required />
              </div>
              <div>
                <label className={labelClass}>Horário</label>
                <input type="time" value={form.appointment_time} onChange={(e) => set('appointment_time', e.target.value)} className={fieldClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Observações</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={fieldClass + ' resize-none'} placeholder="Opcional..." />
            </div>
          </SettingsCard>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="create-appointment-form" disabled={saving} className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Criando…</> : 'Criar Agendamento'}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Internal notes helpers ───────────────────────────────────────────────────
interface InternalNote {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

function parseNotes(raw: string | null): InternalNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as InternalNote[];
  } catch { /* legacy plain text — wrap as single note */ }
  // Legacy: plain string stored before badge format
  return [{
    id: 'legacy',
    text: raw,
    author_id: '',
    author_name: 'Equipe',
    created_at: '',
  }];
}

// ── Drawer ───────────────────────────────────────────────────────────────────
interface DrawerProps {
  apt: VisitAppointment | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<VisitAppointment>) => void;
  reasonLabels: Record<string, string>;
}

function AppointmentDrawer({ apt, onClose, onUpdate, reasonLabels: REASON_LABELS }: DrawerProps) {
  const { profile } = useAdminAuth();
  const { identity } = useBranding();
  const [saving, setSaving] = useState(false);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [tab, setTab] = useState<'info' | 'timeline'>('info');
  const [confirmTrack, setConfirmTrack] = useState<{
    id: string; status: string; sent_at: string; responded_at: string | null;
    response_button_id: string | null; response_button_text: string | null;
  } | null>(null);

  useEffect(() => {
    if (apt) {
      setInternalNotes(parseNotes(apt.internal_notes));
      setNewNote('');
      setCancelReason('');
      setShowCancelForm(false);
      setTab('info');
      // Load confirmation tracking
      supabase
        .from('confirmation_tracking')
        .select('id, status, sent_at, responded_at, response_button_id, response_button_text')
        .eq('appointment_id', apt.id)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setConfirmTrack(data as typeof confirmTrack));
    }
  }, [apt]);

  if (!apt) return null;
  const s = STATUS_CONFIG[apt.status];

  async function changeStatus(newStatus: AppointmentStatus, extra?: Record<string, unknown>) {
    setSaving(true);
    const patch: Record<string, unknown> = { status: newStatus, ...extra };
    if (newStatus === 'confirmed') { patch.confirmed_at = new Date().toISOString(); patch.confirmed_by = profile?.id || null; }
    if (newStatus === 'cancelled') { patch.cancelled_at = new Date().toISOString(); patch.cancelled_by = profile?.id || null; }
    const { error } = await supabase.from('visit_appointments').update(patch).eq('id', apt!.id);
    if (!error) {
      logAudit({ action: 'status_change', module: 'appointments', recordId: apt!.id, description: `Status do agendamento de ${apt!.visitor_name} alterado para ${newStatus}`, oldData: { status: apt!.status }, newData: { status: newStatus } });
      onUpdate(apt!.id, patch as Partial<VisitAppointment>);
    }
    setSaving(false);
    setShowCancelForm(false);
  }

  async function addNote() {
    const text = newNote.trim();
    if (!text || !profile) return;
    const note: InternalNote = {
      id: crypto.randomUUID(),
      text,
      author_id: profile.id,
      author_name: profile.full_name || 'Equipe',
      created_at: new Date().toISOString(),
    };
    const updated = [...internalNotes, note];
    setSaving(true);
    const { error } = await supabase
      .from('visit_appointments')
      .update({ internal_notes: JSON.stringify(updated) })
      .eq('id', apt!.id);
    if (!error) {
      setInternalNotes(updated);
      setNewNote('');
      onUpdate(apt!.id, { internal_notes: JSON.stringify(updated) });
      logAudit({ action: 'update', module: 'appointments', recordId: apt!.id, description: `Nota interna adicionada ao agendamento de ${apt!.visitor_name}` });
      await supabase.from('appointment_history').insert({
        appointment_id: apt!.id,
        event_type: 'note',
        description: 'Nota interna adicionada',
        created_by: profile.id,
      });
    }
    setSaving(false);
  }

  async function deleteNote(id: string) {
    const updated = internalNotes.filter((n) => n.id !== id);
    setSaving(true);
    const { error } = await supabase
      .from('visit_appointments')
      .update({ internal_notes: updated.length ? JSON.stringify(updated) : null })
      .eq('id', apt!.id);
    if (!error) {
      setInternalNotes(updated);
      onUpdate(apt!.id, { internal_notes: updated.length ? JSON.stringify(updated) : null });
    }
    setSaving(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base text-white truncate">{apt.visitor_name}</h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                {apt.confirmation_status === 'awaiting' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    <Clock className="w-2.5 h-2.5" />
                    Aguardando
                  </span>
                )}
                {apt.confirmation_status === 'confirmed' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Via WhatsApp
                  </span>
                )}
                {apt.confirmation_status === 'cancelled' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <Ban className="w-2.5 h-2.5" />
                    Via WhatsApp
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white/70 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-5 flex-shrink-0">
          {([['info', 'Detalhes', CalendarCheck], ['timeline', 'Histórico', History]] as const).map(([key, label, Icon]) => (
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
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'info' && (
            <>
              {/* Dados da visita */}
              <SettingsCard title="Dados da Visita" icon={CalendarCheck}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: CalendarCheck, label: 'Data', value: formatDate(apt.appointment_date) },
                    { icon: Clock, label: 'Horário', value: formatTime(apt.appointment_time) },
                    { icon: Phone, label: 'Telefone', value: formatPhone(apt.visitor_phone) },
                    { icon: MapPin, label: 'Motivo', value: REASON_LABELS[apt.visit_reason] || apt.visit_reason },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                    </div>
                  ))}
                </div>

                {apt.visitor_email && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">E-mail</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{apt.visitor_email}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Origem:</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${apt.origin === 'internal' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                    {apt.origin === 'internal' ? 'Interno' : 'Site'}
                  </span>
                </div>

                {Array.isArray(apt.companions) && apt.companions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{apt.companions.length} acompanhante(s)</span>
                  </div>
                )}
              </SettingsCard>

              {apt.notes && (
                <SettingsCard title="Observação do Visitante" icon={AlertCircle}>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{apt.notes}</p>
                </SettingsCard>
              )}

              {apt.status === 'cancelled' && apt.cancel_reason && (
                <SettingsCard title="Motivo do Cancelamento" icon={Ban}>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{apt.cancel_reason}</p>
                </SettingsCard>
              )}

              {/* Confirmation tracking info */}
              {confirmTrack && (
                <SettingsCard title="Confirmação via WhatsApp" icon={MessageCircle}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Status:</span>
                      {confirmTrack.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          <Clock className="w-3 h-3" /> Aguardando resposta
                        </span>
                      )}
                      {confirmTrack.status === 'confirmed' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Confirmado
                        </span>
                      )}
                      {confirmTrack.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                          <Ban className="w-3 h-3" /> Cancelado
                        </span>
                      )}
                      {confirmTrack.status === 'expired' && (
                        <span className="text-xs font-medium text-gray-400">Expirado</span>
                      )}
                      {confirmTrack.status === 'ignored' && (
                        <span className="text-xs font-medium text-gray-400">Resposta não reconhecida</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      Enviado em {new Date(confirmTrack.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {confirmTrack.responded_at && (
                      <div className="text-xs text-gray-400">
                        Respondido em {new Date(confirmTrack.responded_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {confirmTrack.response_button_text && (
                          <> — botão &ldquo;{confirmTrack.response_button_text}&rdquo;</>
                        )}
                      </div>
                    )}
                  </div>
                </SettingsCard>
              )}

              {/* Internal notes */}
              <SettingsCard title="Notas Internas" icon={StickyNote}>
                {internalNotes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {internalNotes.map((note) => (
                      <span
                        key={note.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs rounded-full max-w-full"
                        title={`${note.author_name} · ${new Date(note.created_at).toLocaleDateString('pt-BR')}`}
                      >
                        <span className="truncate max-w-[200px]">{note.text}</span>
                        {note.author_id === profile?.id && (
                          <button
                            onClick={() => deleteNote(note.id)}
                            disabled={saving}
                            className="flex-shrink-0 text-amber-400 hover:text-red-500 transition-colors disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {internalNotes.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Nenhuma nota ainda. Adicione abaixo.</p>
                )}
                <div className="flex gap-2 pt-1">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } }}
                    placeholder="Nova nota..."
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none"
                  />
                  <button
                    onClick={addNote}
                    disabled={!newNote.trim() || saving}
                    className="px-3 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl transition-colors disabled:opacity-40 flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </SettingsCard>

              {showCancelForm && (
                <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Motivo do cancelamento</p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                    placeholder="Informe o motivo..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-red-200 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowCancelForm(false)} className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Voltar</button>
                    <button
                      onClick={() => changeStatus('cancelled', { cancel_reason: cancelReason })}
                      disabled={!cancelReason.trim() || saving}
                      className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg disabled:opacity-40 hover:bg-red-600 transition-colors"
                    >
                      {saving ? 'Salvando...' : 'Confirmar cancelamento'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'timeline' && <TimelinePanel appointmentId={apt.id} />}
        </div>

        {/* Actions footer */}
        {tab === 'info' && !showCancelForm && (
          <div className="border-t border-gray-100 dark:border-gray-700 p-4 flex-shrink-0 space-y-2">
            <button
              onClick={() => setShowWhatsApp(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar WhatsApp
            </button>
            {apt.status === 'pending' && (
              <>
                <button onClick={() => changeStatus('confirmed')} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Agendamento
                </button>
                <button onClick={() => setShowCancelForm(true)} className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors">
                  <Ban className="w-4 h-4" /> Cancelar Agendamento
                </button>
              </>
            )}
            {apt.status === 'confirmed' && (
              <>
                <button onClick={() => changeStatus('completed')} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  <Check className="w-4 h-4" /> Marcar como Realizado
                </button>
                <button onClick={() => setShowCancelForm(true)} className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors">
                  <Ban className="w-4 h-4" /> Cancelar Agendamento
                </button>
                <button onClick={() => changeStatus('no_show')} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm transition-colors disabled:opacity-50">
                  <AlertCircle className="w-4 h-4" /> Registrar Não Compareceu
                </button>
              </>
            )}
            {(apt.status === 'cancelled' || apt.status === 'no_show') && (
              <button onClick={() => changeStatus('pending')} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm transition-colors">
                <RefreshCw className="w-4 h-4" /> Reabrir como Pendente
              </button>
            )}
          </div>
        )}
      </aside>

      {showWhatsApp && apt && (
        <SendWhatsAppModal
          module="agendamento"
          phone={apt.visitor_phone}
          recipientName={apt.visitor_name}
          recordId={apt.id}
          variables={{
            visitor_name: apt.visitor_name,
            visitor_phone: formatPhone(apt.visitor_phone),
            appointment_date: formatDate(apt.appointment_date),
            appointment_time: formatTime(apt.appointment_time),
            visit_reason: REASON_LABELS[apt.visit_reason] || apt.visit_reason,
            companions_count: String(Array.isArray(apt.companions) ? apt.companions.length : 0),
            school_name: identity.school_name || '',
            current_date: new Date().toLocaleDateString('pt-BR'),
          }}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function CalendarView({ appointments, onClickAppointment, reasonLabels }: {
  appointments: VisitAppointment[];
  onClickAppointment: (apt: VisitAppointment) => void;
  reasonLabels: Record<string, string>;
}) {
  const [calDate, setCalDate] = useState(() => new Date());
  const [dayPopover, setDayPopover] = useState<string | null>(null); // ISO date

  const year = calDate.getFullYear();
  const month = calDate.getMonth();

  // Group appointments by date (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const map: Record<string, VisitAppointment[]> = {};
    appointments.forEach((a) => {
      (map[a.appointment_date] ??= []).push(a);
    });
    return map;
  }, [appointments]);

  // Build calendar grid cells
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const cells: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - firstWeekday;
    if (dayOffset < 0) {
      cells.push({ date: new Date(year, month - 1, daysInPrevMonth + dayOffset + 1), isCurrentMonth: false });
    } else if (dayOffset < daysInMonth) {
      cells.push({ date: new Date(year, month, dayOffset + 1), isCurrentMonth: true });
    } else {
      cells.push({ date: new Date(year, month + 1, dayOffset - daysInMonth + 1), isCurrentMonth: false });
    }
  }

  function isoDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const today = isoDate(new Date());

  function prevMonth() { setCalDate(new Date(year, month - 1, 1)); setDayPopover(null); }
  function nextMonth() { setCalDate(new Date(year, month + 1, 1)); setDayPopover(null); }

  const popoverApts = dayPopover ? (byDate[dayPopover] ?? []).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)) : [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <button onClick={prevMonth} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
          {MONTH_LABELS[month]} {year}
        </h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const iso = isoDate(cell.date);
          const apts = byDate[iso] ?? [];
          const isToday = iso === today;
          const isSelected = iso === dayPopover;
          const statusCounts = apts.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {} as Record<string, number>);

          return (
            <button
              key={i}
              onClick={() => setDayPopover(isSelected ? null : iso)}
              className={`min-h-[80px] p-1.5 text-left border-b border-r border-gray-50 dark:border-gray-700/50 transition-colors ${
                !cell.isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-800/30' : 'hover:bg-blue-50/30 dark:hover:bg-blue-900/10'
              } ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-brand-primary/20' : ''}`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1 ${
                isToday
                  ? 'bg-brand-primary dark:bg-brand-secondary text-white dark:text-brand-primary'
                  : cell.isCurrentMonth
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-300 dark:text-gray-600'
              }`}>
                {cell.date.getDate()}
              </span>
              {apts.length > 0 && (
                <div className="space-y-0.5">
                  {(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as AppointmentStatus[]).map((s) =>
                    (statusCounts[s] ?? 0) > 0 ? (
                      <div key={s} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-none ${STATUS_CONFIG[s].color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_CONFIG[s].dot}`} />
                        <span className="font-medium">{statusCounts[s]}</span>
                        <span className="truncate hidden sm:inline">{STATUS_CONFIG[s].label}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Day popover */}
      {dayPopover && popoverApts.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {new Date(dayPopover + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h4>
            <button onClick={() => setDayPopover(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {popoverApts.map((apt) => {
              const sc = STATUS_CONFIG[apt.status];
              return (
                <button
                  key={apt.id}
                  onClick={() => onClickAppointment(apt)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left border border-gray-100 dark:border-gray-700"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{apt.visitor_name}</p>
                    <p className="text-xs text-gray-400 truncate">{reasonLabels[apt.visit_reason] || apt.visit_reason}</p>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{formatTime(apt.appointment_time)}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${sc.color}`}>{sc.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const { profile } = useAdminAuth();
  const [appointments, setAppointments] = useState<VisitAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<VisitAppointment | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSaving, setBatchSaving] = useState(false);
  const [REASON_LABELS, setReasonLabels] = useState<Record<string, string>>(DEFAULT_REASON_LABELS);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Load visit reasons from DB
  useEffect(() => {
    supabase.from('visit_settings').select('reason_key, reason_label').eq('is_active', true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map: Record<string, string> = {};
          (data as { reason_key: string; reason_label: string }[]).forEach((r) => { map[r.reason_key] = r.reason_label; });
          setReasonLabels(map);
        }
      });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('visit_appointments')
      .select('*')
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true });
    if (!error && data) setAppointments(data as VisitAppointment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: keep list in sync with INSERT/UPDATE/DELETE events
  useRealtimeRows<VisitAppointment>({
    table: 'visit_appointments',
    setRows: setAppointments,
    onSelectedPatch: (row) => {
      setSelected((prev) => (prev?.id === row.id ? { ...prev, ...row } : prev));
    },
  });

  function handleUpdate(id: string, patch: Partial<VisitAppointment>) {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  const reasons = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => set.add(a.visit_reason));
    return Array.from(set);
  }, [appointments]);

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const matchSearch = search === '' || a.visitor_name.toLowerCase().includes(search.toLowerCase()) || a.visitor_phone.includes(search);
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchReason = reasonFilter === 'all' || a.visit_reason === reasonFilter;
      const matchDateFrom = !dateFrom || a.appointment_date >= dateFrom;
      const matchDateTo = !dateTo || a.appointment_date <= dateTo;
      return matchSearch && matchStatus && matchReason && matchDateFrom && matchDateTo;
    });
  }, [appointments, search, statusFilter, reasonFilter, dateFrom, dateTo]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: appointments.length };
    for (const s of Object.keys(STATUS_CONFIG) as AppointmentStatus[]) c[s] = appointments.filter((a) => a.status === s).length;
    return c;
  }, [appointments]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  };

  async function batchAction(newStatus: AppointmentStatus) {
    if (selectedIds.size === 0) return;
    setBatchSaving(true);
    const ids = Array.from(selectedIds);
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'confirmed') { patch.confirmed_at = new Date().toISOString(); patch.confirmed_by = profile?.id || null; }
    if (newStatus === 'cancelled') { patch.cancelled_at = new Date().toISOString(); patch.cancelled_by = profile?.id || null; }

    const { error } = await supabase.from('visit_appointments').update(patch).in('id', ids);
    if (!error) {
      logAudit({ action: 'status_change', module: 'appointments', description: `Status de ${ids.length} agendamentos alterado em lote para ${newStatus}`, newData: { status: newStatus, count: ids.length } });
      setAppointments((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, ...patch } as VisitAppointment : a));
      setSelectedIds(new Set());
    }
    setBatchSaving(false);
  }

  const pendingSelected = filtered.filter((a) => selectedIds.has(a.id) && a.status === 'pending').length;

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-primary dark:text-white flex items-center gap-3">
            <CalendarCheck className="w-8 h-8" />
            Agendamentos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as visitas agendadas.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 shadow-sm text-brand-primary dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              title="Tabela"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-600 shadow-sm text-brand-primary dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              title="Calendário"
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 text-sm bg-brand-primary text-white px-4 py-2.5 rounded-xl hover:bg-brand-primary-dark transition-colors font-medium shadow-sm"
          >
            <CalendarCheck className="w-4 h-4" />
            Novo Agendamento
          </button>
          <button onClick={fetchData} className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-primary dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([['all', 'Todos'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key as AppointmentStatus | 'all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              statusFilter === key
                ? 'bg-brand-primary text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-brand-primary'
            }`}
          >
            {key !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[key as AppointmentStatus]?.dot}`} />}
            {label}
            <span className="ml-0.5 text-[10px] font-semibold opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Filters row */}
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
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm appearance-none"
          >
            <option value="all">Todos os motivos</option>
            {reasons.map((r) => <option key={r} value={r}>{REASON_LABELS[r] || r}</option>)}
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none text-sm"
          title="Data inicial"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none text-sm"
          title="Data final"
        />
      </div>

      {/* Batch actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-brand-primary/5 dark:bg-brand-secondary/5 border border-brand-primary/20 dark:border-brand-secondary/20 rounded-xl px-4 py-2.5">
          <span className="text-xs font-medium text-brand-primary dark:text-brand-secondary">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          {pendingSelected > 0 && (
            <>
              <button
                onClick={() => batchAction('confirmed')}
                disabled={batchSaving}
                className="text-xs px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-40 font-medium"
              >
                Confirmar ({pendingSelected})
              </button>
              <button
                onClick={() => batchAction('cancelled')}
                disabled={batchSaving}
                className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 font-medium"
              >
                Cancelar ({pendingSelected})
              </button>
            </>
          )}
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-auto">
            Limpar
          </button>
        </div>
      )}

      {/* Calendar or Table */}
      {viewMode === 'calendar' ? (
        <CalendarView
          appointments={filtered}
          onClickAppointment={setSelected}
          reasonLabels={REASON_LABELS}
        />
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <CalendarCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum agendamento encontrado.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                  <th className="py-3 px-3 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      {selectedIds.size === filtered.length && filtered.length > 0
                        ? <CheckSquare className="w-4 h-4" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Visitante</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">Data / Hora</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Motivo</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="py-3 px-4 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((apt) => {
                  const sc = STATUS_CONFIG[apt.status];
                  return (
                    <tr
                      key={apt.id}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3" onClick={(e) => { e.stopPropagation(); toggleSelect(apt.id); }}>
                        {selectedIds.has(apt.id)
                          ? <CheckSquare className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
                          : <Square className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                        }
                      </td>
                      <td className="py-3 px-4" onClick={() => setSelected(apt)}>
                        <p className="font-medium text-gray-800 dark:text-gray-200">{apt.visitor_name}</p>
                        <p className="text-xs text-gray-400">{formatPhone(apt.visitor_phone)}</p>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell" onClick={() => setSelected(apt)}>
                        <p className="text-gray-700 dark:text-gray-300 font-medium">{formatDate(apt.appointment_date)}</p>
                        <p className="text-xs text-gray-400">{formatTime(apt.appointment_time)}</p>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell text-gray-600 dark:text-gray-400" onClick={() => setSelected(apt)}>
                        {REASON_LABELS[apt.visit_reason] || apt.visit_reason}
                      </td>
                      <td className="py-3 px-4" onClick={() => setSelected(apt)}>
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                          {apt.confirmation_status === 'awaiting' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 w-fit">
                              <Clock className="w-2.5 h-2.5" />
                              Aguardando
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4" onClick={() => setSelected(apt)}>
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            {filtered.length} agendamento{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {selected && (
        <AppointmentDrawer apt={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} reasonLabels={REASON_LABELS} />
      )}

      {showCreate && (
        <CreateAppointmentModal onClose={() => setShowCreate(false)} onCreated={fetchData} reasonLabels={REASON_LABELS} />
      )}
    </div>
  );
}
