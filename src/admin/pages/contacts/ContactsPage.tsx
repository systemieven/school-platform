import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type { ContactRequest, ContactStatus } from '../../types/admin.types';
import {
  MessageSquare, Search, X, ChevronRight, Loader2, RefreshCw,
  Phone, Mail, Clock, Tag, Star, ChevronDown, Calendar,
} from 'lucide-react';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; dot: string }> = {
  new:           { label: 'Novo',            color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500' },
  first_contact: { label: 'Primeiro contato',color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  follow_up:     { label: 'Follow-up',       color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',   dot: 'bg-amber-400' },
  resolved:      { label: 'Resolvido',       color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  archived:      { label: 'Arquivado',       color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',          dot: 'bg-gray-400' },
  contacted:     { label: 'Contactado',      color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',       dot: 'bg-cyan-500' },
  converted:     { label: 'Convertido',      color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',   dot: 'bg-green-600' },
  closed:        { label: 'Fechado',         color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',          dot: 'bg-gray-500' },
};

const REASON_LABELS: Record<string, string> = {
  matricula:         'Interesse em Matrícula',
  informacoes:       'Informações Gerais',
  financeiro:        'Financeiro',
  pedagogico:        'Pedagógico',
  infraestrutura:    'Infraestrutura',
  outros:            'Outros',
};

const BEST_TIME_LABELS: Record<string, string> = {
  morning: 'Manhã', afternoon: 'Tarde',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Drawer ───────────────────────────────────────────────────────────────────
interface DrawerProps {
  contact: ContactRequest | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<ContactRequest>) => void;
}

function ContactDrawer({ contact, onClose, onUpdate }: DrawerProps) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState<ContactStatus | ''>('');
  const [nextDate, setNextDate] = useState('');

  useEffect(() => {
    if (contact) {
      setNotes(contact.internal_notes || '');
      setNewStatus('');
      setNextDate(contact.next_contact_date || '');
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
    if (!error) onUpdate(contact!.id, { internal_notes: notes });
    setSaving(false);
  }

  async function saveNextDate() {
    setSaving(true);
    const { error } = await supabase.from('contact_requests').update({ next_contact_date: nextDate || null }).eq('id', contact!.id);
    if (!error) onUpdate(contact!.id, { next_contact_date: nextDate || null });
    setSaving(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[#003876]/10 dark:bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-[#003876] dark:text-[#ffd700]">
                {contact.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{contact.name}</p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                {contact.is_lead && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#ffd700]/20 text-yellow-700 dark:text-yellow-400">
                    <Star className="w-3 h-3" />
                    Lead
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ml-2 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Contact info */}
          <div className="space-y-2">
            {[
              { icon: Phone, label: 'Telefone', value: contact.phone },
              { icon: Mail,  label: 'E-mail',   value: contact.email || '—' },
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

          {/* Message */}
          {contact.message && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Mensagem</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{contact.message}</p>
            </div>
          )}

          {/* Interests */}
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

          {/* Received */}
          <p className="text-xs text-gray-400">Recebido em {formatDate(contact.created_at)}</p>

          {/* Next contact date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Próximo contato
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none"
              />
              <button
                onClick={saveNextDate}
                disabled={saving || nextDate === (contact.next_contact_date || '')}
                className="px-3 py-2 bg-[#003876] text-white rounded-xl text-xs disabled:opacity-40 hover:bg-[#002855] transition-colors"
              >
                {saving ? '…' : 'Salvar'}
              </button>
            </div>
          </div>

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
                disabled={saving || notes === (contact.internal_notes || '')}
                className="text-xs px-3 py-1.5 bg-[#003876] text-white rounded-lg disabled:opacity-40 hover:bg-[#002855] transition-colors"
              >
                {saving ? 'Salvando…' : 'Salvar notas'}
              </button>
            </div>
          </div>

          {/* Status change */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Alterar status</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ContactStatus)}
                  className="w-full px-3 py-2.5 pr-9 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none appearance-none"
                >
                  <option value="">Selecionar status...</option>
                  {(Object.entries(STATUS_CONFIG) as [ContactStatus, typeof STATUS_CONFIG[ContactStatus]][])
                    .filter(([k]) => k !== contact.status)
                    .map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <button
                onClick={changeStatus}
                disabled={!newStatus || saving}
                className="px-4 py-2 bg-[#003876] text-white rounded-xl text-sm disabled:opacity-40 hover:bg-[#002855] transition-colors"
              >
                {saving ? '…' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
  const [selected, setSelected] = useState<ContactRequest | null>(null);

  useEffect(() => { fetchContacts(); }, []);

  async function fetchContacts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setContacts(data as ContactRequest[]);
    setLoading(false);
  }

  function handleUpdate(id: string, patch: Partial<ContactRequest>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  const filtered = useMemo(() => contacts.filter((c) => {
    const matchSearch =
      search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  }), [contacts, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: contacts.length };
    for (const k of Object.keys(STATUS_CONFIG) as ContactStatus[]) {
      c[k] = contacts.filter((x) => x.status === k).length;
    }
    return c;
  }, [contacts]);

  // Only show statuses with records + active filter
  const activeStatuses = (Object.keys(STATUS_CONFIG) as ContactStatus[]).filter(
    (k) => counts[k] > 0 || k === statusFilter,
  );

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <MessageSquare className="w-8 h-8" />
            Contatos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as solicitações de contato do site.</p>
        </div>
        <button
          onClick={fetchContacts}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#003876] dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            statusFilter === 'all' ? 'bg-[#003876] text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#003876]'
          }`}
        >
          Todos <span className="opacity-70">{counts.all}</span>
        </button>
        {activeStatuses.map((k) => {
          const s = STATUS_CONFIG[k];
          return (
            <button
              key={k}
              onClick={() => setStatusFilter(k)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === k ? 'bg-[#003876] text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#003876]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label}
              <span className="opacity-70">{counts[k]}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none text-sm"
        />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
        </div>
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
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="py-3 px-5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const s = STATUS_CONFIG[c.status] || STATUS_CONFIG.new;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
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
            {filtered.length} contato{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {selected && (
        <ContactDrawer
          contact={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
