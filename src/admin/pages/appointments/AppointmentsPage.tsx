import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type { VisitAppointment, AppointmentStatus } from '../../types/admin.types';
import SendWhatsAppModal from '../../components/SendWhatsAppModal';
import {
  CalendarCheck, Search, Filter, X, ChevronRight, Loader2,
  User, Phone, Clock, MapPin, Check, Ban, CheckCircle2,
  AlertCircle, RefreshCw, SlidersHorizontal, MessageCircle,
} from 'lucide-react';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Pendente',   color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',  dot: 'bg-amber-400' },
  confirmed: { label: 'Confirmado', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  completed: { label: 'Realizado',  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  cancelled: { label: 'Cancelado',  color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',      dot: 'bg-red-400' },
  no_show:   { label: 'Não veio',   color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',     dot: 'bg-gray-400' },
};

const REASON_LABELS: Record<string, string> = {
  conhecer_escola:      'Conhecer a Escola',
  matricula:            'Pré-Matrícula',
  entrega_documentos:   'Entrega de Documentos',
  conversa_pedagogica:  'Conversa Pedagógica',
  outros:               'Outros',
};

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(t: string) {
  return t.slice(0, 5);
}
function formatPhone(p: string) {
  const n = p.replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return p;
}

// ── Drawer ───────────────────────────────────────────────────────────────────
interface DrawerProps {
  apt: VisitAppointment | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<VisitAppointment>) => void;
}

function AppointmentDrawer({ apt, onClose, onUpdate }: DrawerProps) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  useEffect(() => {
    if (apt) {
      setNotes(apt.internal_notes || '');
      setCancelReason('');
      setShowCancelForm(false);
    }
  }, [apt]);

  if (!apt) return null;
  const s = STATUS_CONFIG[apt.status];

  async function changeStatus(newStatus: AppointmentStatus, extra?: Record<string, unknown>) {
    setSaving(true);
    const patch: Record<string, unknown> = { status: newStatus, ...extra };
    if (newStatus === 'confirmed') patch.confirmed_at = new Date().toISOString();
    if (newStatus === 'cancelled') patch.cancelled_at = new Date().toISOString();

    const { error } = await supabase.from('visit_appointments').update(patch).eq('id', apt!.id);
    if (!error) onUpdate(apt!.id, patch as Partial<VisitAppointment>);
    setSaving(false);
    setShowCancelForm(false);
  }

  async function saveNotes() {
    setSaving(true);
    const { error } = await supabase.from('visit_appointments').update({ internal_notes: notes }).eq('id', apt!.id);
    if (!error) onUpdate(apt!.id, { internal_notes: notes });
    setSaving(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#003876]/10 dark:bg-white/10 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-[#003876] dark:text-[#ffd700]">
                {apt.visitor_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{apt.visitor_name}</p>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: CalendarCheck, label: 'Data', value: formatDate(apt.appointment_date) },
              { icon: Clock,         label: 'Horário', value: formatTime(apt.appointment_time) },
              { icon: Phone,         label: 'Telefone', value: formatPhone(apt.visitor_phone) },
              { icon: MapPin,        label: 'Motivo', value: REASON_LABELS[apt.visit_reason] || apt.visit_reason },
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

          {/* Email */}
          {apt.visitor_email && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">E-mail</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{apt.visitor_email}</p>
            </div>
          )}

          {/* Origin */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Origem:</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${apt.origin === 'internal' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
              {apt.origin === 'internal' ? 'Interno' : 'Site'}
            </span>
          </div>

          {/* Companions */}
          {Array.isArray(apt.companions) && apt.companions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Acompanhantes</p>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{apt.companions.length} acompanhante(s)</span>
              </div>
            </div>
          )}

          {/* Notes from visitor */}
          {apt.notes && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Observação do visitante</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{apt.notes}</p>
            </div>
          )}

          {/* Cancel reason */}
          {apt.status === 'cancelled' && apt.cancel_reason && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-[11px] font-medium text-red-500 uppercase tracking-wide mb-1">Motivo do cancelamento</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{apt.cancel_reason}</p>
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
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={saveNotes}
                disabled={saving || notes === (apt.internal_notes || '')}
                className="text-xs px-3 py-1.5 bg-[#003876] text-white rounded-lg disabled:opacity-40 hover:bg-[#002855] transition-colors"
              >
                {saving ? 'Salvando…' : 'Salvar notas'}
              </button>
            </div>
          </div>

          {/* Cancel form */}
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
                  {saving ? 'Salvando…' : 'Confirmar cancelamento'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions footer */}
        {!showCancelForm && (
          <div className="border-t border-gray-100 dark:border-gray-700 p-4 flex-shrink-0 space-y-2">
            {/* WhatsApp */}
            <button
              onClick={() => setShowWhatsApp(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar WhatsApp
            </button>
            {apt.status === 'pending' && (
              <>
                <button
                  onClick={() => changeStatus('confirmed')}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Agendamento
                </button>
                <button
                  onClick={() => setShowCancelForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  Cancelar Agendamento
                </button>
              </>
            )}
            {apt.status === 'confirmed' && (
              <>
                <button
                  onClick={() => changeStatus('completed')}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Marcar como Realizado
                </button>
                <button
                  onClick={() => setShowCancelForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  Cancelar Agendamento
                </button>
              </>
            )}
            {apt.status === 'confirmed' && (
              <button
                onClick={() => changeStatus('no_show')}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                <AlertCircle className="w-4 h-4" />
                Registrar Não Compareceu
              </button>
            )}
            {(apt.status === 'cancelled' || apt.status === 'no_show') && (
              <button
                onClick={() => changeStatus('pending')}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reabrir como Pendente
              </button>
            )}
          </div>
        )}
      </aside>

      {/* WhatsApp modal */}
      {showWhatsApp && apt && (
        <SendWhatsAppModal
          module="agendamento"
          phone={apt.visitor_phone}
          recipientName={apt.visitor_name}
          recordId={apt.id}
          variables={{
            visitor_name:     apt.visitor_name,
            visitor_phone:    formatPhone(apt.visitor_phone),
            appointment_date: formatDate(apt.appointment_date),
            appointment_time: formatTime(apt.appointment_time),
            visit_reason:     REASON_LABELS[apt.visit_reason] || apt.visit_reason,
            companions_count: String(Array.isArray(apt.companions) ? apt.companions.length : 0),
            school_name:      'Colégio Batista',
            current_date:     new Date().toLocaleDateString('pt-BR'),
          }}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<VisitAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [selected, setSelected] = useState<VisitAppointment | null>(null);

  useEffect(() => { fetchAppointments(); }, []);

  async function fetchAppointments() {
    setLoading(true);
    const { data, error } = await supabase
      .from('visit_appointments')
      .select('*')
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true });
    if (!error && data) setAppointments(data as VisitAppointment[]);
    setLoading(false);
  }

  function handleUpdate(id: string, patch: Partial<VisitAppointment>) {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const matchSearch =
        search === '' ||
        a.visitor_name.toLowerCase().includes(search.toLowerCase()) ||
        a.visitor_phone.includes(search);
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [appointments, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: appointments.length };
    for (const s of Object.keys(STATUS_CONFIG) as AppointmentStatus[]) {
      c[s] = appointments.filter((a) => a.status === s).length;
    }
    return c;
  }, [appointments]);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <CalendarCheck className="w-8 h-8" />
            Agendamentos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as visitas agendadas pelo site.</p>
        </div>
        <button
          onClick={fetchAppointments}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#003876] dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([['all', 'Todos'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key as AppointmentStatus | 'all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              statusFilter === key
                ? 'bg-[#003876] text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#003876] dark:hover:border-white/30'
            }`}
          >
            {key !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[key as AppointmentStatus]?.dot}`} />}
            {label}
            <span className={`ml-0.5 text-[10px] font-semibold ${statusFilter === key ? 'opacity-80' : 'opacity-60'}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none text-sm transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
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
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Visitante</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">Data / Hora</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Motivo</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="py-3 px-5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((apt) => {
                  const s = STATUS_CONFIG[apt.status];
                  return (
                    <tr
                      key={apt.id}
                      onClick={() => setSelected(apt)}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-5">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{apt.visitor_name}</p>
                        <p className="text-xs text-gray-400">{formatPhone(apt.visitor_phone)}</p>
                      </td>
                      <td className="py-3 px-5 hidden md:table-cell">
                        <p className="text-gray-700 dark:text-gray-300 font-medium">{formatDate(apt.appointment_date)}</p>
                        <p className="text-xs text-gray-400">{formatTime(apt.appointment_time)}</p>
                      </td>
                      <td className="py-3 px-5 hidden lg:table-cell text-gray-600 dark:text-gray-400">
                        {REASON_LABELS[apt.visit_reason] || apt.visit_reason}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
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
            {filtered.length} agendamento{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' && ` com status "${STATUS_CONFIG[statusFilter as AppointmentStatus]?.label}"`}
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <AppointmentDrawer
          apt={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
