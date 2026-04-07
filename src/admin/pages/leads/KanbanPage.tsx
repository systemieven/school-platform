import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import SendWhatsAppModal from '../../components/SendWhatsAppModal';
import {
  Kanban, Plus, MessageCircle, Phone, Clock, ChevronDown,
  Loader2, X, Save, AlertCircle, Star, User,
  TrendingUp, MoreHorizontal, Flag,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadStage {
  id: string;
  name: string;
  label: string;
  color: string;
  position: number;
  is_active: boolean;
}

type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface Lead {
  id: string;
  source_module: string;
  name: string;
  phone: string;
  email: string | null;
  stage: string;
  priority: Priority;
  assigned_to: string | null;
  segment_interest: string | null;
  tags: string[];
  score: number;
  next_contact_date: string | null;
  created_at: string;
  updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  low:    { label: 'Baixa',   color: 'text-gray-500',   dot: 'bg-gray-300' },
  medium: { label: 'Média',   color: 'text-blue-500',   dot: 'bg-blue-400' },
  high:   { label: 'Alta',    color: 'text-amber-500',  dot: 'bg-amber-400' },
  urgent: { label: 'Urgente', color: 'text-red-500',    dot: 'bg-red-500'  },
};

const SOURCE_LABELS: Record<string, string> = {
  contact:    'Contato',
  enrollment: 'Pré-Matrícula',
  manual:     'Manual',
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

// ── New Lead Modal ────────────────────────────────────────────────────────────

function NewLeadModal({ stages, onClose, onCreated }: {
  stages: LeadStage[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { profile } = useAdminAuth();
  const [form, setForm] = useState<Partial<Lead>>({
    name: '', phone: '', stage: stages[0]?.name || 'new_lead', priority: 'medium', source_module: 'manual',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name?.trim() || !form.phone?.trim()) { setError('Nome e telefone são obrigatórios.'); return; }
    setSaving(true);
    const { error: dbErr } = await supabase.from('leads').insert({
      ...form,
      assigned_to: profile?.id,
    });
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    onCreated();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-display font-bold text-gray-900 dark:text-white">Novo Lead</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: 'Nome *', key: 'name', placeholder: 'Nome completo', type: 'text' },
              { label: 'Telefone *', key: 'phone', placeholder: '(81) 99999-9999', type: 'tel' },
              { label: 'E-mail', key: 'email', placeholder: 'email@exemplo.com', type: 'email' },
              { label: 'Segmento', key: 'segment_interest', placeholder: 'Ed. Infantil, Fund. I...', type: 'text' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                <input
                  type={type}
                  value={(form as Record<string, unknown>)[key] as string || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Etapa inicial</label>
                <div className="relative">
                  <select
                    value={form.stage}
                    onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] dark:focus:border-[#ffd700]"
                  >
                    {stages.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prioridade</label>
                <div className="relative">
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Priority }))}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] dark:focus:border-[#ffd700]"
                  >
                    {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG[Priority]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
          <div className="flex gap-3 px-5 pb-5">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#003876] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#002855] transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Criar lead
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead, onWhatsApp, onDragStart,
}: {
  lead: Lead;
  onWhatsApp: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
}) {
  const p = PRIORITY_CONFIG[lead.priority];
  const days = daysSince(lead.updated_at);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-[#003876]/20 dark:hover:border-[#ffd700]/20 transition-all group select-none"
    >
      {/* Priority + source */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex items-center gap-1 text-[10px] font-medium ${p.color}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {p.label}
        </div>
        {lead.segment_interest && (
          <span className="text-[10px] bg-[#003876]/10 dark:bg-[#003876]/20 text-[#003876] dark:text-[#ffd700] px-2 py-0.5 rounded-full font-medium ml-auto">
            {lead.segment_interest}
          </span>
        )}
      </div>

      {/* Name */}
      <p className="font-semibold text-sm text-gray-800 dark:text-white leading-tight mb-1 group-hover:text-[#003876] dark:group-hover:text-[#ffd700] transition-colors">
        {lead.name}
      </p>

      {/* Phone */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2.5">
        <Phone className="w-3 h-3" />
        <span>{lead.phone}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Clock className="w-3 h-3" />
          <span>{days === 0 ? 'hoje' : `${days}d aqui`}</span>
        </div>
        <div className="flex items-center gap-1">
          {lead.source_module !== 'manual' && (
            <span className="text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">
              {SOURCE_LABELS[lead.source_module] || lead.source_module}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onWhatsApp(lead); }}
            className="p-1 text-gray-300 hover:text-green-500 dark:hover:text-green-400 transition-colors rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
            title="Enviar WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  stage, leads, onDrop, onWhatsApp,
}: {
  stage: LeadStage;
  leads: Lead[];
  onDrop: (leadId: string, stageName: string) => void;
  onWhatsApp: (lead: Lead) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragOver(true);
  };
  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) onDrop(leadId, stage.name);
  };

  return (
    <div
      className={`flex-shrink-0 w-64 flex flex-col rounded-2xl transition-colors ${
        isDragOver ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-gray-50 dark:bg-gray-800/50'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1 truncate">
          {stage.label}
        </span>
        <span className="text-[10px] font-bold bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 w-5 h-5 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className={`flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto ${isDragOver ? 'ring-2 ring-inset ring-blue-300 dark:ring-blue-600 rounded-b-2xl' : ''}`}>
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onWhatsApp={onWhatsApp}
            onDragStart={(e, l) => {
              e.dataTransfer.setData('leadId', l.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-center py-6 text-gray-300 dark:text-gray-600">
            <User className="w-6 h-6 mx-auto mb-1 opacity-50" />
            <p className="text-[11px]">Arraste leads aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const { profile } = useAdminAuth();
  const [stages, setStages]   = useState<LeadStage[]>([]);
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModal, setNewModal]   = useState(false);
  const [waLead, setWaLead]       = useState<Lead | null>(null);
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: stagesData }, { data: leadsData }] = await Promise.all([
      supabase.from('lead_stages').select('*').eq('is_active', true).order('position'),
      supabase.from('leads').select('*').order('updated_at', { ascending: false }),
    ]);
    setStages((stagesData as LeadStage[]) || []);
    setLeads((leadsData as Lead[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDrop = async (leadId: string, stageName: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === stageName) return;

    const fromStage = lead.stage;

    // Optimistic update
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: stageName, updated_at: new Date().toISOString() } : l));

    // Persist
    await supabase.from('leads').update({ stage: stageName }).eq('id', leadId);

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id:      leadId,
      type:         'stage_change',
      description:  `Movido de "${fromStage}" para "${stageName}"`,
      from_stage:   fromStage,
      to_stage:     stageName,
      performed_by: profile?.id,
    });
  };

  const filteredLeads = filterPriority === 'all'
    ? leads
    : leads.filter((l) => l.priority === filterPriority);

  const leadsByStage = (stageName: string) => filteredLeads.filter((l) => l.stage === stageName);

  // Stats
  const total = leads.length;
  const urgent = leads.filter((l) => l.priority === 'urgent' || l.priority === 'high').length;
  const converted = leads.filter((l) => l.stage === 'enrollment_confirmed').length;
  const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <Kanban className="w-8 h-8" />
            Kanban de Leads
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {total} lead{total !== 1 ? 's' : ''} no funil
          </p>
        </div>
        <button
          onClick={() => setNewModal(true)}
          className="inline-flex items-center gap-2 bg-[#003876] text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-[#002855] hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total', value: total, icon: User, color: 'text-[#003876] dark:text-white', bg: 'bg-[#003876]/5 dark:bg-white/5' },
          { label: 'Alta/Urgente', value: urgent, icon: Flag, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Taxa de conversão', value: `${convRate}%`, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-xs font-medium ${color}`}>{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {([['all', 'Todos'], ['urgent', 'Urgente'], ['high', 'Alta'], ['medium', 'Média'], ['low', 'Baixa']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterPriority(v)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filterPriority === v
                ? 'bg-[#003876] text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-3 h-full min-w-max">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.name}
                stage={stage}
                leads={leadsByStage(stage.name)}
                onDrop={handleDrop}
                onWhatsApp={setWaLead}
              />
            ))}
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {newModal && (
        <NewLeadModal
          stages={stages}
          onClose={() => setNewModal(false)}
          onCreated={() => { setNewModal(false); load(); }}
        />
      )}

      {/* WhatsApp Modal */}
      {waLead && (
        <SendWhatsAppModal
          module="contato"
          phone={waLead.phone}
          recipientName={waLead.name}
          recordId={waLead.id}
          variables={{
            contact_name:   waLead.name,
            contact_phone:  waLead.phone,
            contact_reason: waLead.segment_interest || '',
            contact_status: stages.find((s) => s.name === waLead.stage)?.label || waLead.stage,
            school_name:    'Colégio Batista',
            current_date:   new Date().toLocaleDateString('pt-BR'),
          }}
          onClose={() => setWaLead(null)}
        />
      )}
    </div>
  );
}
