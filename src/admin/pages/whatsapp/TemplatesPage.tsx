import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { MODULE_VARIABLES, ALL_VARIABLES } from '../../lib/whatsapp-api';
import type { WhatsAppTemplate, TemplateCategory, MessageType, TemplateContent } from '../../types/admin.types';
import {
  MessageCircle, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  X, Save, Loader2, ChevronDown, Eye, EyeOff,
  Zap, Clock, Tag, AlertCircle,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TemplateCategory; label: string; color: string }[] = [
  { value: 'agendamento',  label: 'Agendamento',   color: 'blue'   },
  { value: 'matricula',    label: 'Pré-Matrícula', color: 'purple' },
  { value: 'contato',      label: 'Contato',       color: 'green'  },
  { value: 'geral',        label: 'Geral',         color: 'gray'   },
  { value: 'boas_vindas',  label: 'Boas-vindas',   color: 'yellow' },
];

const MESSAGE_TYPES: { value: MessageType; label: string; desc: string }[] = [
  { value: 'text',    label: 'Texto',    desc: 'Mensagem de texto simples com suporte a formatação' },
  { value: 'media',   label: 'Mídia',    desc: 'Imagem, vídeo, áudio ou documento' },
  { value: 'buttons', label: 'Botões',   desc: 'Mensagem com até 3 botões de resposta rápida' },
  { value: 'list',    label: 'Lista',    desc: 'Menu interativo com seções e opções' },
];

const TRIGGER_EVENTS = [
  { value: '',                   label: 'Nenhum (manual)' },
  { value: 'on_create',          label: 'Ao criar registro' },
  { value: 'on_status_change',   label: 'Ao mudar status' },
  { value: 'on_reminder',        label: 'Lembrete agendado' },
];

const TRIGGER_MODULES = [
  { value: '',              label: 'Todos os módulos' },
  { value: 'enrollment',   label: 'Pré-Matrícula' },
  { value: 'appointment',  label: 'Agendamento' },
  { value: 'contact',      label: 'Contato' },
];

const TRIGGER_STATUS_BY_MODULE: Record<string, { value: string; label: string }[]> = {
  enrollment: [
    { value: '', label: 'Qualquer status' },
    { value: 'new',                  label: 'Novo' },
    { value: 'under_review',         label: 'Em análise' },
    { value: 'docs_pending',         label: 'Docs. pendentes' },
    { value: 'docs_received',        label: 'Docs. recebidos' },
    { value: 'interview_scheduled',  label: 'Entrevista agendada' },
    { value: 'approved',             label: 'Aprovado' },
    { value: 'confirmed',            label: 'Confirmado' },
    { value: 'rejected',             label: 'Rejeitado' },
    { value: 'archived',             label: 'Arquivado' },
  ],
  appointment: [
    { value: '', label: 'Qualquer status' },
    { value: 'pending',    label: 'Pendente' },
    { value: 'confirmed',  label: 'Confirmado' },
    { value: 'completed',  label: 'Realizado' },
    { value: 'cancelled',  label: 'Cancelado' },
    { value: 'no_show',    label: 'Não veio' },
  ],
  contact: [
    { value: '', label: 'Qualquer status' },
    { value: 'new',           label: 'Novo' },
    { value: 'first_contact', label: '1º contato' },
    { value: 'follow_up',     label: 'Follow-up' },
    { value: 'contacted',     label: 'Contatado' },
    { value: 'converted',     label: 'Convertido' },
    { value: 'resolved',      label: 'Resolvido' },
    { value: 'archived',      label: 'Arquivado' },
  ],
  '': [{ value: '', label: 'Qualquer status' }],
};

const CATEGORY_COLORS: Record<string, string> = {
  agendamento: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  matricula:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  contato:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  geral:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  boas_vindas: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractVars(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

function renderPreview(body: string, vars: string[]): string {
  const demo: Record<string, string> = {
    visitor_name: 'João Silva', guardian_name: 'Maria Santos',
    student_name: 'Ana Santos', appointment_date: '15/04/2026',
    appointment_time: '14:00', visit_reason: 'Conhecer a escola',
    companions_count: '2', enrollment_status: 'Em análise',
    enrollment_number: 'PRE-2026-001', pending_docs: 'RG e CPF',
    contact_name: 'Pedro Lima', contact_phone: '(81) 99999-9999',
    contact_reason: 'Informações', contact_status: 'Novo',
    school_name: 'Colégio Batista', school_phone: '(81) 3000-0000',
    school_address: 'Rua das Flores, 123 - Caruaru/PE',
    current_date: new Date().toLocaleDateString('pt-BR'),
    visitor_phone: '(81) 98888-8888',
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars.includes(key) ? `*${demo[key] ?? key}*` : `{{${key}}}`,
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-3xl flex items-center justify-center mb-5">
        <MessageCircle className="w-10 h-10 text-green-500" />
      </div>
      <h3 className="font-display text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
        Nenhum template cadastrado
      </h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mb-6">
        Crie templates reutilizáveis para agilizar o envio de mensagens via WhatsApp.
      </p>
      <button onClick={onNew} className="inline-flex items-center gap-2 bg-[#003876] text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-[#002855] transition-colors">
        <Plus className="w-4 h-4" />
        Criar primeiro template
      </button>
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template, onEdit, onDelete, onToggle,
}: {
  template: WhatsAppTemplate;
  onEdit:   (t: WhatsAppTemplate) => void;
  onDelete: (t: WhatsAppTemplate) => void;
  onToggle: (t: WhatsAppTemplate) => void;
}) {
  const catColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.geral;
  const catLabel = CATEGORIES.find((c) => c.value === template.category)?.label || template.category;
  const typeLabel = MESSAGE_TYPES.find((t) => t.value === template.message_type)?.label || template.message_type;
  const body = template.content.body || '(sem corpo)';
  const hasAutoTrigger = Boolean(template.trigger_event);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-200 ${
      template.is_active
        ? 'border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800 hover:shadow-md'
        : 'border-gray-100 dark:border-gray-700 opacity-60'
    }`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${catColor}`}>
                {catLabel}
              </span>
              <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {typeLabel}
              </span>
              {hasAutoTrigger && (
                <span className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" />
                  Auto
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-800 dark:text-white text-sm leading-tight">
              {template.name}
            </h3>
          </div>

          {/* Toggle active */}
          <button
            onClick={() => onToggle(template)}
            className="flex-shrink-0 text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] transition-colors"
            title={template.is_active ? 'Desativar' : 'Ativar'}
          >
            {template.is_active
              ? <ToggleRight className="w-7 h-7 text-green-500" />
              : <ToggleLeft className="w-7 h-7" />
            }
          </button>
        </div>

        {/* Preview body */}
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 font-mono">
          {body.slice(0, 200)}{body.length > 200 ? '…' : ''}
        </p>

        {/* Variables */}
        {template.variables.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {template.variables.map((v) => (
              <span key={v} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-mono">
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}

        {/* Trigger info */}
        {hasAutoTrigger && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            <span>
              {TRIGGER_EVENTS.find((e) => e.value === template.trigger_event)?.label}
              {template.trigger_delay_minutes > 0 && ` · ${template.trigger_delay_minutes} min depois`}
            </span>
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div className="flex items-center gap-1 px-5 py-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => onEdit(template)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#003876] dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </button>
        <button
          onClick={() => onDelete(template)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </button>
      </div>
    </div>
  );
}

// ── Template Drawer ───────────────────────────────────────────────────────────

const EMPTY_TEMPLATE: Omit<WhatsAppTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'> = {
  name: '',
  category: 'geral',
  message_type: 'text',
  content: { body: '' },
  variables: [],
  trigger_event: null,
  trigger_conditions: null,
  trigger_delay_minutes: 0,
  is_active: true,
};

function TemplateDrawer({
  template,
  onClose,
  onSave,
}: {
  template: WhatsAppTemplate | null;
  onClose: () => void;
  onSave:  () => void;
}) {
  const { profile } = useAdminAuth();
  const isEdit = Boolean(template?.id);
  const [form, setForm] = useState({ ...EMPTY_TEMPLATE });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (template) {
      setForm({
        name:                  template.name,
        category:              template.category,
        message_type:          template.message_type,
        content:               { ...template.content },
        variables:             [...template.variables],
        trigger_event:         template.trigger_event,
        trigger_conditions:    template.trigger_conditions,
        trigger_delay_minutes: template.trigger_delay_minutes,
        is_active:             template.is_active,
      });
    } else {
      setForm({ ...EMPTY_TEMPLATE, content: { body: '' } });
    }
    setError('');
    setShowPreview(false);
  }, [template]);

  const body = form.content.body || '';
  const detectedVars = extractVars(body);

  // Auto-update variables from body
  const handleBodyChange = (val: string) => {
    const vars = extractVars(val);
    setForm((p) => ({ ...p, content: { ...p.content, body: val }, variables: vars }));
  };

  const insertVar = (v: string) => {
    const snippet = `{{${v}}}`;
    setForm((p) => ({
      ...p,
      content: { ...p.content, body: (p.content.body || '') + snippet },
      variables: [...new Set([...(p.variables || []), v])],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Informe o nome do template.'); return; }
    if (!body.trim())      { setError('O corpo da mensagem não pode estar vazio.'); return; }

    setSaving(true);
    setError('');

    const payload = {
      ...form,
      trigger_event: form.trigger_event || null,
      variables:     extractVars(body),
      ...(isEdit ? {} : { created_by: profile?.id }),
    };

    const { error: dbErr } = isEdit
      ? await supabase.from('whatsapp_templates').update(payload).eq('id', template!.id)
      : await supabase.from('whatsapp_templates').insert(payload);

    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSave();
  };

  const suggestedVars = MODULE_VARIABLES[form.category === 'boas_vindas' ? 'geral' : form.category]
    || ALL_VARIABLES;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-gray-900 dark:text-white">
              {isEdit ? 'Editar Template' : 'Novo Template'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Use {'{{variável}}'} para campos dinâmicos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((p) => !p)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                showPreview
                  ? 'bg-[#003876] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              Preview
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {showPreview ? (
            /* Preview mode */
            <div className="p-6">
              <div className="bg-[#dcf8c6] dark:bg-green-900/20 rounded-2xl p-4 max-w-sm ml-auto shadow-sm">
                <p className="text-sm text-gray-800 dark:text-green-100 whitespace-pre-wrap leading-relaxed">
                  {renderPreview(body, detectedVars)}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-green-400/60 text-right mt-2">
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                </p>
              </div>
              <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-4">
                Preview com dados de exemplo
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nome do Template *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Confirmação de Visita"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 transition-all"
                />
              </div>

              {/* Categoria + Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Categoria
                  </label>
                  <div className="relative">
                    <select
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as TemplateCategory }))}
                      className="w-full appearance-none px-4 py-2.5 pr-9 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 transition-all"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Tipo de Mensagem
                  </label>
                  <div className="relative">
                    <select
                      value={form.message_type}
                      onChange={(e) => setForm((p) => ({ ...p, message_type: e.target.value as MessageType, content: { ...p.content } }))}
                      className="w-full appearance-none px-4 py-2.5 pr-9 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 transition-all"
                    >
                      {MESSAGE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {MESSAGE_TYPES.find((t) => t.value === form.message_type)?.desc}
                  </p>
                </div>
              </div>

              {/* Corpo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Corpo da Mensagem *
                </label>
                <textarea
                  value={body}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  placeholder="Olá {{visitor_name}}! Sua visita ao Colégio Batista está confirmada para {{appointment_date}} às {{appointment_time}}."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 transition-all resize-y font-mono leading-relaxed"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  *negrito*, _itálico_, ~tachado~, ```código```
                </p>
              </div>

              {/* URL de mídia (se tipo = media) */}
              {form.message_type === 'media' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    URL da Mídia
                  </label>
                  <input
                    value={form.content.media_url || ''}
                    onChange={(e) => setForm((p) => ({ ...p, content: { ...p.content, media_url: e.target.value } }))}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 transition-all"
                  />
                  <div className="flex gap-2 mt-2">
                    {(['image','video','document','audio'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, content: { ...p.content, media_type: t } }))}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                          form.content.media_type === t
                            ? 'bg-[#003876] text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Variable picker */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Tag className="w-3.5 h-3.5" />
                  Variáveis disponíveis
                  <span className="text-[11px] text-gray-400 font-normal">(clique para inserir no corpo)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedVars.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVar(v)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-mono transition-colors ${
                        detectedVars.includes(v)
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600'
                      }`}
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trigger */}
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Disparo Automático
                  </span>
                  <span className="text-[11px] text-gray-400">(opcional)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Evento</label>
                    <div className="relative">
                      <select
                        value={form.trigger_event || ''}
                        onChange={(e) => setForm((p) => ({ ...p, trigger_event: (e.target.value as WhatsAppTemplate['trigger_event']) || null }))}
                        className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs outline-none focus:border-amber-400 transition-all"
                      >
                        {TRIGGER_EVENTS.map((e) => (
                          <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Delay (minutos)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.trigger_delay_minutes}
                      onChange={(e) => setForm((p) => ({ ...p, trigger_delay_minutes: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs outline-none focus:border-amber-400 transition-all"
                    />
                  </div>
                </div>

                {/* Conditions — only for on_status_change */}
                {form.trigger_event === 'on_status_change' && (() => {
                  const cond = (form.trigger_conditions || {}) as Record<string, string>;
                  const mod = (cond.module as string) || '';
                  const statusOpts = TRIGGER_STATUS_BY_MODULE[mod] ?? TRIGGER_STATUS_BY_MODULE[''];
                  const setCondField = (key: string, val: string) => {
                    const next = { ...cond, [key]: val || undefined };
                    if (!next[key]) delete next[key];
                    setForm((p) => ({ ...p, trigger_conditions: Object.keys(next).length ? next : null }));
                  };
                  return (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Condições de status</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Módulo</label>
                          <div className="relative">
                            <select
                              value={mod}
                              onChange={(e) => {
                                const next = { ...cond, module: e.target.value || undefined };
                                if (!next.module) delete next.module;
                                delete next.status; delete next.old_status;
                                setForm((p) => ({ ...p, trigger_conditions: Object.keys(next).length ? next : null }));
                              }}
                              className="w-full appearance-none px-2 py-1.5 pr-6 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs outline-none focus:border-amber-400"
                            >
                              {TRIGGER_MODULES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Status novo</label>
                          <div className="relative">
                            <select
                              value={(cond.status as string) || ''}
                              onChange={(e) => setCondField('status', e.target.value)}
                              className="w-full appearance-none px-2 py-1.5 pr-6 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs outline-none focus:border-amber-400"
                            >
                              {statusOpts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Status anterior</label>
                          <div className="relative">
                            <select
                              value={(cond.old_status as string) || ''}
                              onChange={(e) => setCondField('old_status', e.target.value)}
                              className="w-full appearance-none px-2 py-1.5 pr-6 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs outline-none focus:border-amber-400"
                            >
                              {statusOpts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#003876] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#002855] transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Salvar alterações' : 'Criar template'}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ template, onClose, onConfirm }: {
  template: WhatsAppTemplate;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="font-display font-bold text-gray-900 dark:text-white mb-1">Excluir template?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            <strong>"{template.name}"</strong> será removido permanentemente. Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">
              Excluir
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TemplatesPage({ embedded }: { embedded?: boolean } = {}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editing, setEditing]           = useState<WhatsAppTemplate | null>(null);
  const [deleting, setDeleting]         = useState<WhatsAppTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('category')
      .order('name');
    setTemplates((data as WhatsAppTemplate[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit   = (t: WhatsAppTemplate) => { setEditing(t); setDrawerOpen(true); };
  const handleNew    = () => { setEditing(null); setDrawerOpen(true); };
  const handleClose  = () => { setDrawerOpen(false); setEditing(null); };
  const handleSaved  = () => { handleClose(); load(); };

  const handleToggle = async (t: WhatsAppTemplate) => {
    await supabase.from('whatsapp_templates').update({ is_active: !t.is_active }).eq('id', t.id);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await supabase.from('whatsapp_templates').delete().eq('id', deleting.id);
    setDeleting(null);
    load();
  };

  const filtered = templates.filter((t) => {
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (filterStatus === 'active'   && !t.is_active) return false;
    if (filterStatus === 'inactive' &&  t.is_active) return false;
    return true;
  });

  const totalActive = templates.filter((t) => t.is_active).length;

  return (
    <div>
      {/* Header */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
              <MessageCircle className="w-8 h-8" />
              Templates WhatsApp
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {templates.length} template{templates.length !== 1 ? 's' : ''} cadastrado{templates.length !== 1 ? 's' : ''} · {totalActive} ativo{totalActive !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 bg-[#003876] text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-[#002855] hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Template
          </button>
        </div>
      )}
      {embedded && (
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs text-gray-400">
            {templates.length} template{templates.length !== 1 ? 's' : ''} · {totalActive} ativo{totalActive !== 1 ? 's' : ''}
          </p>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 bg-[#003876] text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-[#002855] transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Template
          </button>
        </div>
      )}

      {/* Filters */}
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Category filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {[{ value: 'all', label: 'Todos' }, ...CATEGORIES].map((c) => (
              <button
                key={c.value}
                onClick={() => setFilterCat(c.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  filterCat === c.value
                    ? 'bg-[#003876] text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Status divider */}
          <div className="h-7 w-px bg-gray-200 dark:bg-gray-700 self-center mx-1" />

          {/* Active/Inactive filter */}
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                filterStatus === s
                  ? 'bg-[#003876] text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:text-white'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">Nenhum template com esses filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={handleEdit}
              onDelete={setDeleting}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <TemplateDrawer
          template={editing}
          onClose={handleClose}
          onSave={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <DeleteConfirm
          template={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
