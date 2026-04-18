import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type { ContractTemplate, ContractTemplateType } from '../../types/admin.types';
import { CONTRACT_TEMPLATE_TYPE_LABELS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  FileText, Loader2, Pencil, Trash2, X, Save, Check,
  Tag, Code2, Star, Eye,
} from 'lucide-react';
import { SelectDropdown } from '../../components/FormField';
import HtmlTemplateEditor from '../../components/HtmlTemplateEditor';

/**
 * Variáveis padrão disponíveis como chips no editor, por tipo de documento
 * financeiro. Seguem a mesma convenção `{{chave}}` que secretaria usa; são
 * pistas pro usuário e podem ser complementadas via `template.variables`
 * (variáveis adicionais declaradas no drawer).
 */
const FINANCIAL_BASE_VARS: { key: string; label: string }[] = [
  // Aluno
  { key: 'nome_aluno',          label: 'Aluno' },
  { key: 'matricula',           label: 'Matrícula' },
  { key: 'turma',               label: 'Turma' },
  { key: 'serie',               label: 'Série' },
  { key: 'ano_letivo',          label: 'Ano letivo' },
  { key: 'turno',               label: 'Turno' },
  // Responsável
  { key: 'nome_responsavel',    label: 'Responsável' },
  { key: 'cpf_responsavel',     label: 'CPF Resp.' },
  { key: 'rg_responsavel',      label: 'RG Resp.' },
  { key: 'endereco_responsavel', label: 'Endereço Resp.' },
  { key: 'telefone_responsavel', label: 'Telefone Resp.' },
  { key: 'email_responsavel',   label: 'E-mail Resp.' },
  // Escola
  { key: 'escola',              label: 'Escola' },
  { key: 'cnpj_escola',         label: 'CNPJ Escola' },
  { key: 'endereco_escola',     label: 'Endereço Escola' },
  { key: 'cidade',              label: 'Cidade' },
  // Data
  { key: 'data_emissao',        label: 'Data emissão' },
  { key: 'data_assinatura',     label: 'Data assinatura' },
];

const FINANCIAL_TYPE_VARS: Record<ContractTemplateType, { key: string; label: string }[]> = {
  contract: [
    { key: 'plano',               label: 'Plano' },
    { key: 'valor_mensalidade',   label: 'Mensalidade' },
    { key: 'valor_total',         label: 'Valor total' },
    { key: 'quantidade_parcelas', label: 'Qtd. parcelas' },
    { key: 'vencimento_dia',      label: 'Dia de venc.' },
    { key: 'desconto',            label: 'Desconto' },
  ],
  receipt: [
    { key: 'numero_recibo',       label: 'Nº recibo' },
    { key: 'valor_pago',          label: 'Valor pago' },
    { key: 'valor_por_extenso',   label: 'Valor por extenso' },
    { key: 'data_pagamento',      label: 'Data pagto.' },
    { key: 'forma_pagamento',     label: 'Forma pagto.' },
    { key: 'referencia',          label: 'Referência' },
  ],
  boleto: [
    { key: 'numero_boleto',       label: 'Nº boleto' },
    { key: 'valor',               label: 'Valor' },
    { key: 'vencimento',          label: 'Vencimento' },
    { key: 'linha_digitavel',     label: 'Linha digitável' },
    { key: 'codigo_barras',       label: 'Cód. barras' },
    { key: 'beneficiario',        label: 'Beneficiário' },
  ],
  enrollment_form: [
    { key: 'data_matricula',      label: 'Data matrícula' },
    { key: 'plano',               label: 'Plano' },
    { key: 'valor_matricula',     label: 'Valor matrícula' },
  ],
  termination: [
    { key: 'motivo_rescisao',     label: 'Motivo' },
    { key: 'data_rescisao',       label: 'Data rescisão' },
    { key: 'saldo_pendente',      label: 'Saldo pendente' },
  ],
};

function buildTemplateVariables(
  type: ContractTemplateType,
  userVars: { key: string; label?: string }[],
): { key: string; label?: string }[] {
  const merged = [
    ...FINANCIAL_BASE_VARS,
    ...FINANCIAL_TYPE_VARS[type],
    ...userVars.filter((v) => v && v.key),
  ];
  // dedup por chave (primeira ocorrência vence)
  return merged.filter((v, i, a) => a.findIndex((x) => x.key === v.key) === i);
}

const TYPE_ICON_COLOR: Record<ContractTemplateType, string> = {
  contract: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  receipt: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  boleto: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  enrollment_form: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  termination: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

const EMPTY: Omit<ContractTemplate, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: null,
  template_type: 'contract',
  content: '',
  variables: [],
  style_config: {},
  segment_ids: [],
  plan_ids: [],
  is_default: false,
  is_active: true,
  school_year: null,
  created_by: null,
};

export default function FinancialTemplatesPage() {
  const { profile } = useAdminAuth();
  usePermissions();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ContractTemplateType | 'all'>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('contract_templates').select('*').order('template_type').order('is_default', { ascending: false }).order('name');
    setTemplates((data ?? []) as ContractTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing({ ...EMPTY, id: '', created_at: '', updated_at: '' } as ContractTemplate);
    setIsNew(true);
  }

  function openEdit(item: ContractTemplate) {
    setEditing({ ...item });
    setIsNew(false);
  }

  function close() {
    setEditing(null);
    setIsNew(false);
  }

  function updateField<K extends keyof ContractTemplate>(field: K, value: ContractTemplate[K]) {
    setEditing((prev) => prev ? { ...prev, [field]: value } : null);
  }

  async function handleSave() {
    if (!editing || !profile) return;
    setSaving(true);

    const payload = {
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      template_type: editing.template_type,
      content: editing.content,
      variables: editing.variables,
      style_config: editing.style_config,
      segment_ids: editing.segment_ids,
      plan_ids: editing.plan_ids,
      is_default: editing.is_default,
      is_active: editing.is_active,
      school_year: editing.school_year ? Number(editing.school_year) : null,
    };

    if (isNew) {
      const { error } = await supabase.from('contract_templates').insert({ ...payload, created_by: profile.id });
      if (!error) logAudit({ action: 'create', module: 'financial-templates', description: `Template criado: ${payload.name}`, newData: payload });
    } else {
      const { error } = await supabase.from('contract_templates').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (!error) logAudit({ action: 'update', module: 'financial-templates', description: `Template atualizado: ${payload.name}`, newData: payload });
    }

    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => { setSaved(false); close(); load(); }, 1200);
  }

  async function handleDelete(id: string) {
    const item = templates.find((t) => t.id === id);
    await supabase.from('contract_templates').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'financial-templates', description: `Template excluído: ${item?.name}` });
    setDeleteId(null);
    load();
  }

  const filtered = filterType === 'all' ? templates : templates.filter((t) => t.template_type === filterType);
  const previewTemplate = previewId ? templates.find((t) => t.id === previewId) : null;

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} template{filtered.length !== 1 && 's'}
          </p>
          <div className="flex items-center gap-1 ml-3 flex-wrap">
            {(['all', 'contract', 'receipt', 'boleto', 'enrollment_form', 'termination'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filterType === t
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t === 'all' ? 'Todos' : CONTRACT_TEMPLATE_TYPE_LABELS[t as ContractTemplateType]}
              </button>
            ))}
          </div>
        </div>
        <PermissionGate moduleKey="financial-templates" action="create">
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors shadow-lg shadow-brand-primary/20">
            <FileText className="w-4 h-4" /> Novo Template
          </button>
        </PermissionGate>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhum template cadastrado</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Crie templates de contrato, recibo e boleto com placeholders</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_ICON_COLOR[t.template_type]}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate">{t.name}</h3>
                    {t.is_default && <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{CONTRACT_TEMPLATE_TYPE_LABELS[t.template_type]}</p>
                </div>
              </div>

              {t.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{t.description}</p>
              )}

              <div className="flex items-center gap-2 mb-3 text-[11px] text-gray-400">
                <Code2 className="w-3 h-3" />
                {t.variables.length} variáve{t.variables.length !== 1 ? 'is' : 'l'}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${t.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                  {t.is_active ? 'Ativo' : 'Inativo'}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPreviewId(t.id)} className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-white dark:hover:bg-gray-800 rounded transition-colors" title="Pré-visualizar">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <PermissionGate moduleKey="financial-templates" action="edit">
                    <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-white dark:hover:bg-gray-800 rounded transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </PermissionGate>
                  <PermissionGate moduleKey="financial-templates" action="delete">
                    {deleteId === t.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(t.id)} className="px-2 py-1 text-[10px] bg-red-500 text-white rounded">OK</button>
                        <button onClick={() => setDeleteId(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(t.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </PermissionGate>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Drawer */}
      <Drawer
        open={!!previewTemplate}
        onClose={() => setPreviewId(null)}
        title={previewTemplate?.name || 'Pré-visualizar'}
        icon={Eye}
        width="w-[min(1400px,calc(100vw-17rem))]"
      >
        {previewTemplate && (
          <DrawerCard title="Conteúdo renderizado" icon={FileText}>
            <div
              className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              dangerouslySetInnerHTML={{ __html: previewTemplate.content }}
            />
          </DrawerCard>
        )}
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        open={!!editing}
        onClose={close}
        title={isNew ? 'Novo Template' : 'Editar Template'}
        icon={FileText}
        width="w-[min(1400px,calc(100vw-17rem))]"
        footer={
          <div className="flex gap-3 lg:w-[360px] lg:ml-auto">
            <button onClick={close} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancelar</button>
            <button onClick={handleSave} disabled={!editing?.name.trim() || !editing?.content.trim() || saving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        }
      >
        {editing && (
          /*
           * Layout 2-col: editor HTML domina a esquerda (flex-1),
           * metadados + variáveis ficam numa trilha estreita à direita.
           * No mobile (< lg) colapsa em coluna única para não espremer nada.
           */
          <div className="flex flex-col lg:flex-row gap-3 lg:items-stretch">
            {/* Coluna principal — Conteúdo */}
            <div className="flex-1 min-w-0 flex flex-col">
              <DrawerCard title="Conteúdo" icon={Code2}>
                <HtmlTemplateEditor
                  value={editing.content}
                  onChange={(html) => updateField('content', html)}
                  variables={buildTemplateVariables(editing.template_type, editing.variables)}
                  placeholder="Escreva o conteúdo do template. Use os chips acima para inserir variáveis."
                  minHeight="calc(100vh - 17rem)"
                />
              </DrawerCard>
            </div>

            {/* Coluna lateral — Identificação + Variáveis */}
            <div className="w-full lg:w-[360px] lg:flex-shrink-0 space-y-3">
              <DrawerCard title="Identificação" icon={Tag}>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome *</label>
                  <input value={editing.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Ex: Contrato Ensino Fundamental 2026"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm" />
                </div>
                <SelectDropdown label="Tipo *" value={editing.template_type} onChange={(e) => updateField('template_type', e.target.value as ContractTemplateType)}>
                  {Object.entries(CONTRACT_TEMPLATE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </SelectDropdown>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição</label>
                  <textarea value={editing.description || ''} onChange={(e) => updateField('description', e.target.value || null)} rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none text-sm resize-none" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${editing.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={() => updateField('is_active', !editing.is_active)}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editing.is_active ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{editing.is_active ? 'Template ativo' : 'Template inativo'}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${editing.is_default ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={() => updateField('is_default', !editing.is_default)}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editing.is_default ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Usar como padrão para este tipo</span>
                </label>
              </DrawerCard>

              <DrawerCard title="Variáveis adicionais" icon={Code2}>
                <p className="text-[11px] text-gray-400 -mt-1 mb-2">
                  As variáveis padrão (aluno, responsável, escola e específicas do tipo) já aparecem como chips no editor. Declare aqui qualquer chave extra.
                </p>
                <div className="space-y-2">
                  {editing.variables.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={v.key}
                        onChange={(e) => {
                          const next = [...editing.variables];
                          next[idx] = { ...next[idx], key: e.target.value };
                          updateField('variables', next);
                        }}
                        placeholder="chave"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs font-mono" />
                      <input value={v.label}
                        onChange={(e) => {
                          const next = [...editing.variables];
                          next[idx] = { ...next[idx], label: e.target.value };
                          updateField('variables', next);
                        }}
                        placeholder="Rótulo"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs" />
                      <button onClick={() => updateField('variables', editing.variables.filter((_, i) => i !== idx))}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => updateField('variables', [...editing.variables, { key: '', label: '' }])}
                    className="w-full py-2 text-xs text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors border border-dashed border-gray-300 dark:border-gray-600">
                    + Adicionar variável
                  </button>
                </div>
              </DrawerCard>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
