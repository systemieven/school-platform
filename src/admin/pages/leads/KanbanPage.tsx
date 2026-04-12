import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import SendWhatsAppModal from '../../components/SendWhatsAppModal';
import { sendWhatsAppTemplate } from '../../lib/whatsapp-api';
import { useBranding } from '../../../contexts/BrandingContext';
import {
  Kanban, Plus, MessageCircle, Phone, Clock, ChevronDown,
  Loader2, X, Save, AlertCircle, Star, User,
  TrendingUp, Flag, GraduationCap, Edit3, History,
  Calendar, Mail, Settings, Trash2, ChevronUp, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadStageAutoActions {
  send_template?:       string;  // whatsapp_templates UUID
  create_notification?: boolean;
}

interface LeadStage {
  id: string;
  name: string;
  label: string;
  color: string;
  position: number;
  is_active: boolean;
  auto_actions?: LeadStageAutoActions | null;
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

// ── Manage Stages Modal ───────────────────────────────────────────────────────

const STAGE_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
  '#64748b', 'var(--brand-primary)',
];

function ManageStagesModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(STAGE_COLORS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('lead_stages').select('*').order('position').then(({ data }) => {
      setStages((data as LeadStage[]) || []);
      setLoading(false);
    });
  }, []);

  async function saveEdit(stage: LeadStage) {
    setSaving(true);
    await supabase.from('lead_stages').update({ label: editLabel, color: editColor }).eq('id', stage.id);
    logAudit({ action: 'update', module: 'kanban', recordId: stage.id, description: `Etapa "${editLabel}" atualizada`, oldData: { label: stage.label, color: stage.color }, newData: { label: editLabel, color: editColor } });
    setStages((prev) => prev.map((s) => s.id === stage.id ? { ...s, label: editLabel, color: editColor } : s));
    setEditId(null);
    setSaving(false);
  }

  async function toggleActive(stage: LeadStage) {
    const next = !stage.is_active;
    await supabase.from('lead_stages').update({ is_active: next }).eq('id', stage.id);
    setStages((prev) => prev.map((s) => s.id === stage.id ? { ...s, is_active: next } : s));
  }

  async function moveStage(index: number, dir: -1 | 1) {
    const newStages = [...stages];
    const target = index + dir;
    if (target < 0 || target >= newStages.length) return;
    [newStages[index], newStages[target]] = [newStages[target], newStages[index]];
    // Re-assign positions
    const updates = newStages.map((s, i) => supabase.from('lead_stages').update({ position: i + 1 }).eq('id', s.id));
    await Promise.all(updates);
    setStages(newStages.map((s, i) => ({ ...s, position: i + 1 })));
  }

  async function deleteStage(stage: LeadStage) {
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('stage', stage.name);
    if ((count ?? 0) > 0) { setError(`A etapa "${stage.label}" tem leads. Mova-os antes de excluir.`); return; }
    await supabase.from('lead_stages').delete().eq('id', stage.id);
    logAudit({ action: 'delete', module: 'kanban', recordId: stage.id, description: `Etapa "${stage.label}" excluída` });
    setStages((prev) => prev.filter((s) => s.id !== stage.id));
  }

  async function addStage() {
    if (!newLabel.trim() || !newName.trim()) { setError('Nome técnico e label são obrigatórios.'); return; }
    const pos = (stages[stages.length - 1]?.position ?? 0) + 1;
    const { data, error: dbErr } = await supabase.from('lead_stages').insert({
      name: newName.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newLabel.trim(),
      color: newColor,
      position: pos,
      is_active: true,
    }).select().single();
    if (dbErr) { setError(dbErr.message); return; }
    logAudit({ action: 'create', module: 'kanban', recordId: (data as LeadStage).id, description: `Etapa "${newLabel.trim()}" criada`, newData: data as Record<string, unknown> });
    setStages((prev) => [...prev, data as LeadStage]);
    setNewLabel(''); setNewName(''); setNewColor(STAGE_COLORS[0]);
    setError('');
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <h3 className="font-display font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-primary dark:text-brand-secondary" />
              Gerenciar Etapas
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>
            ) : stages.map((stage, i) => (
              <div
                key={stage.id}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${stage.is_active ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700/50 opacity-60'}`}
              >
                {/* Color dot */}
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: editId === stage.id ? editColor : stage.color }} />

                {editId === stage.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="flex-1 text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      autoFocus
                    />
                    <div className="flex gap-1 flex-wrap">
                      {STAGE_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={`w-4 h-4 rounded-full transition-transform ${editColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button onClick={() => saveEdit(stage)} disabled={saving} className="text-brand-primary dark:text-brand-secondary hover:opacity-70">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{stage.label}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{stage.name}</span>
                  </>
                )}

                {editId !== stage.id && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => moveStage(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditId(stage.id); setEditLabel(stage.label); setEditColor(stage.color); }} className="p-1 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(stage)} className={`p-1 ${stage.is_active ? 'text-emerald-500' : 'text-gray-400'} hover:opacity-70`} title={stage.is_active ? 'Desativar' : 'Ativar'}>
                      {stage.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteStage(stage)} className="p-1 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Add new */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Nova etapa</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-gray-400 mb-0.5 block">Label (exibido)</label>
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Ex: Em negociação"
                    className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-0.5 block">Nome técnico</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ex: negotiating"
                    className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-gray-400">Cor:</span>
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
              <button
                onClick={addStage}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar etapa
              </button>
            </div>
          </div>

          <div className="px-5 pb-5 flex-shrink-0">
            <button
              onClick={() => { onSaved(); onClose(); }}
              className="w-full py-2.5 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primary-dark transition-colors"
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    </>
  );
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
    logAudit({ action: 'create', module: 'kanban', description: `Lead "${form.name}" criado`, newData: form as Record<string, unknown> });
    onCreated();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-display font-bold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />Novo Lead</h3>
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20"
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
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary"
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
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary"
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
              className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-primary text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-60"
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

// ── Lead Detail Modal ────────────────────────────────────────────────────────

interface LeadActivity {
  id: string;
  type: string;
  description: string;
  from_stage: string | null;
  to_stage: string | null;
  performed_by: string | null;
  created_at: string;
  profile?: { full_name: string } | null;
}

function LeadDetailModal({ lead, stages, onClose, onUpdated }: {
  lead: Lead;
  stages: LeadStage[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { profile } = useAdminAuth();
  const [tab, setTab] = useState<'info' | 'activity'>('info');
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingAct, setLoadingAct] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [nextDate, setNextDate] = useState(lead.next_contact_date || '');
  const [savingDate, setSavingDate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ priority: lead.priority, segment_interest: lead.segment_interest || '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadActivities = useCallback(async () => {
    setLoadingAct(true);
    const { data } = await supabase
      .from('lead_activities')
      .select('*, profile:performed_by(full_name)')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setActivities((data as LeadActivity[]) || []);
    setLoadingAct(false);
  }, [lead.id]);

  useEffect(() => { if (tab === 'activity') loadActivities(); }, [tab, loadActivities]);

  const addNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, type: 'note', description: note.trim(), performed_by: profile?.id,
    });
    setNote('');
    setSavingNote(false);
    loadActivities();
  };

  const saveNextDate = async () => {
    setSavingDate(true);
    await supabase.from('leads').update({ next_contact_date: nextDate || null }).eq('id', lead.id);
    setSavingDate(false);
    onUpdated();
  };

  const saveEdits = async () => {
    setSavingEdit(true);
    await supabase.from('leads').update({
      priority: editData.priority,
      segment_interest: editData.segment_interest || null,
    }).eq('id', lead.id);
    setSavingEdit(false);
    setEditing(false);
    onUpdated();
  };

  const convertToEnrollment = async () => {
    const { data, error } = await supabase.from('enrollments').insert({
      guardian_name: lead.name, guardian_phone: lead.phone, guardian_email: lead.email,
      student_name: '', student_birth_date: '2020-01-01',
      guardian_cpf: '', guardian_zip_code: '', guardian_street: '', guardian_number: '', guardian_neighborhood: '', guardian_city: '', guardian_state: '',
      father_name: '', father_cpf: '', father_phone: '', mother_name: '', mother_cpf: '', mother_phone: '',
      segment: lead.segment_interest, origin: 'referral', status: 'new', first_school: false,
    }).select('id').single();
    if (!error && data) {
      logAudit({ action: 'create', module: 'kanban', recordId: lead.id, description: `Lead "${lead.name}" convertido para pré-matrícula`, newData: { enrollment_id: data.id } });
      await supabase.from('leads').update({ stage: 'enrollment_confirmed' }).eq('id', lead.id);
      await supabase.from('lead_activities').insert({
        lead_id: lead.id, type: 'conversion', description: 'Convertido para pré-matrícula', performed_by: profile?.id,
      });
      onUpdated();
      onClose();
    }
  };

  const p = PRIORITY_CONFIG[lead.priority];
  const stageObj = stages.find((s) => s.name === lead.stage);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <h3 className="font-display font-bold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />{lead.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className={`flex items-center gap-1 text-[10px] font-medium ${p.color}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${p.dot}`} /> {p.label}
                </div>
                {stageObj && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: stageObj.color }}>
                    {stageObj.label}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-700 px-5">
            {([['info', 'Informações'], ['activity', 'Atividade']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === k ? 'border-brand-primary text-brand-primary dark:text-brand-secondary dark:border-brand-secondary' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{l}</button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {tab === 'info' && (
              <>
                {/* Contact info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">{lead.phone}</span></div>
                  {lead.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">{lead.email}</span></div>}
                  <div className="flex items-center gap-2 text-sm"><Star className="w-4 h-4 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">Score: {lead.score}</span></div>
                  <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-gray-400" /><span className="text-gray-700 dark:text-gray-300">Origem: {SOURCE_LABELS[lead.source_module] || lead.source_module}</span></div>
                </div>

                {/* Edit fields */}
                {editing ? (
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Prioridade</label>
                      <select value={editData.priority} onChange={(e) => setEditData((p) => ({ ...p, priority: e.target.value as Priority }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
                        {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG[Priority]][]).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Segmento</label>
                      <input value={editData.segment_interest} onChange={(e) => setEditData((p) => ({ ...p, segment_interest: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600">Cancelar</button>
                      <button onClick={saveEdits} disabled={savingEdit} className="text-xs px-3 py-1.5 rounded-lg bg-brand-primary text-white">
                        {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-brand-primary dark:text-brand-secondary hover:underline">
                    <Edit3 className="w-3 h-3" /> Editar dados
                  </button>
                )}

                {/* Next contact date */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Próximo contato
                  </label>
                  <div className="flex gap-2">
                    <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                    <button onClick={saveNextDate} disabled={savingDate}
                      className="px-3 py-2 rounded-xl bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary-dark disabled:opacity-60">
                      {savingDate ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                    </button>
                  </div>
                </div>

                {/* Convert action */}
                <button onClick={convertToEnrollment}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                  <GraduationCap className="w-4 h-4" /> Converter para Pré-Matrícula
                </button>
              </>
            )}

            {tab === 'activity' && (
              <>
                {/* Add note */}
                <div className="flex gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicionar nota..."
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-brand-primary"
                    onKeyDown={(e) => e.key === 'Enter' && addNote()} />
                  <button onClick={addNote} disabled={savingNote || !note.trim()}
                    className="px-3 py-2 rounded-xl bg-brand-primary text-white text-xs font-medium disabled:opacity-60">
                    {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>

                {/* Activity list */}
                {loadingAct ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-brand-primary animate-spin" /></div>
                ) : activities.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">Nenhuma atividade registrada</p>
                ) : (
                  <div className="space-y-3">
                    {activities.map((a) => (
                      <div key={a.id} className="flex gap-3 text-sm">
                        <div className="mt-1">
                          <History className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 dark:text-gray-300">{a.description}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(a.created_at).toLocaleString('pt-BR')}
                            {a.profile?.full_name && ` · ${a.profile.full_name}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead, onWhatsApp, onDragStart, onClick,
}: {
  lead: Lead;
  onWhatsApp: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onClick: (lead: Lead) => void;
}) {
  const p = PRIORITY_CONFIG[lead.priority];
  const days = daysSince(lead.updated_at);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => onClick(lead)}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-brand-primary/20 dark:hover:border-brand-secondary/20 transition-all group select-none"
    >
      {/* Priority + source */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex items-center gap-1 text-[10px] font-medium ${p.color}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {p.label}
        </div>
        {lead.segment_interest && (
          <span className="text-[10px] bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-secondary px-2 py-0.5 rounded-full font-medium ml-auto">
            {lead.segment_interest}
          </span>
        )}
      </div>

      {/* Name */}
      <p className="font-semibold text-sm text-gray-800 dark:text-white leading-tight mb-1 group-hover:text-brand-primary dark:group-hover:text-brand-secondary transition-colors">
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
  stage, leads, onDrop, onWhatsApp, onClickLead,
}: {
  stage: LeadStage;
  leads: Lead[];
  onDrop: (leadId: string, stageName: string) => void;
  onWhatsApp: (lead: Lead) => void;
  onClickLead: (lead: Lead) => void;
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
            onClick={onClickLead}
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
  const { identity } = useBranding();
  const [stages, setStages]   = useState<LeadStage[]>([]);
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModal, setNewModal]       = useState(false);
  const [manageStages, setManageStages] = useState(false);
  const [waLead, setWaLead]           = useState<Lead | null>(null);
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [detailLead, setDetailLead]   = useState<Lead | null>(null);

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

    const fromStage  = lead.stage;
    const toStageObj = stages.find((s) => s.name === stageName);

    // Optimistic update
    setLeads((prev) => prev.map((l) =>
      l.id === leadId ? { ...l, stage: stageName, updated_at: new Date().toISOString() } : l,
    ));

    // Persist
    await supabase.from('leads').update({ stage: stageName }).eq('id', leadId);

    logAudit({ action: 'move', module: 'kanban', recordId: leadId, description: `Lead "${lead.name}" movido de "${fromStage}" para "${stageName}"`, oldData: { stage: fromStage }, newData: { stage: stageName } });

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id:      leadId,
      type:         'stage_change',
      description:  `Movido de "${fromStage}" para "${stageName}"`,
      from_stage:   fromStage,
      to_stage:     stageName,
      performed_by: profile?.id,
    });

    // ── Execute auto_actions of the destination stage ──────────────────────
    const actions = toStageObj?.auto_actions;
    if (!actions) return;

    try {
      // 1. Send WhatsApp template
      if (actions.send_template && lead.phone) {
        const { data: tmpl } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('id', actions.send_template)
          .single();

        if (tmpl) {
          const vars: Record<string, string> = {
            visitor_name:   lead.name,
            contact_name:   lead.name,
            guardian_name:  lead.name,
            visitor_phone:  lead.phone,
            contact_phone:  lead.phone,
            school_name:    identity.school_name || '',
            current_date:   new Date().toLocaleDateString('pt-BR'),
          };
          await sendWhatsAppTemplate({
            phone:           lead.phone,
            template:        tmpl as { id: string; message_type: string; content: Record<string, unknown> },
            variables:       vars,
            recipientName:   lead.name,
            relatedModule:   'contato',
            relatedRecordId: leadId,
          });
        }
      }

      // 2. Create internal notification for admins
      if (actions.create_notification) {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['super_admin', 'admin', 'coordinator'])
          .eq('is_active', true);

        if (admins && admins.length > 0) {
          const toLabel = toStageObj?.label || stageName;
          await supabase.from('notifications').insert(
            (admins as { id: string }[]).map((a) => ({
              recipient_id:     a.id,
              type:             'stage_change',
              title:            `Lead movido: ${lead.name}`,
              body:             `Movido para a etapa "${toLabel}".`,
              link:             '/admin/leads',
              related_module:   'leads',
              related_record_id: leadId,
            })),
          );
        }
      }
    } catch (err) {
      // Auto-actions are non-critical — log but don't revert the stage move
      console.error('[kanban] auto_actions error:', err);
    }
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
          <h1 className="font-display text-3xl font-bold text-brand-primary dark:text-white flex items-center gap-3">
            <Kanban className="w-8 h-8" />
            Kanban de Leads
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {total} lead{total !== 1 ? 's' : ''} no funil
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setManageStages(true)}
            className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
          >
            <Settings className="w-4 h-4" />
            Etapas
          </button>
          <button
            onClick={() => setNewModal(true)}
            className="inline-flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-brand-primary-dark hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total', value: total, icon: User, color: 'text-brand-primary dark:text-white', bg: 'bg-brand-primary/5 dark:bg-white/5' },
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
                ? 'bg-brand-primary text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-primary hover:text-brand-primary'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
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
                onClickLead={setDetailLead}
              />
            ))}
          </div>
        </div>
      )}

      {/* Manage Stages Modal */}
      {manageStages && (
        <ManageStagesModal
          onClose={() => setManageStages(false)}
          onSaved={() => { load(); }}
        />
      )}

      {/* New Lead Modal */}
      {newModal && (
        <NewLeadModal
          stages={stages}
          onClose={() => setNewModal(false)}
          onCreated={() => { setNewModal(false); load(); }}
        />
      )}

      {/* Lead Detail Modal */}
      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          stages={stages}
          onClose={() => setDetailLead(null)}
          onUpdated={() => { load(); setDetailLead(null); }}
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
            school_name:    identity.school_name || '',
            current_date:   new Date().toLocaleDateString('pt-BR'),
          }}
          onClose={() => setWaLead(null)}
        />
      )}
    </div>
  );
}
