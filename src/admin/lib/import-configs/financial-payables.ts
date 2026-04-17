/**
 * Config de importacao de Contas a Pagar (financial_payables).
 *
 * Despesas fixas e variaveis. category_type ('fixed'|'variable') e obrigatorio
 * no schema. account_category_id e opcional e resolvido por nome (type='despesa').
 * Sem dedup automatico: multiplos payables por fornecedor sao validos.
 */
import { TrendingDown } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';

const FIELDS = [
  { key: 'creditor_name', label: 'Credor / Fornecedor', required: true },
  { key: 'amount',        label: 'Valor (R$)',         required: true },
  { key: 'description',   label: 'Descrição',          required: true },
  { key: 'due_date',      label: 'Vencimento (DD/MM/AAAA)', required: true },
  { key: 'category_type', label: 'Tipo (fixa/variavel)', required: true },
  { key: 'creditor_type', label: 'Tipo credor (supplier/employee/other)' },
  { key: 'category_name', label: 'Categoria (nome despesa)' },
  { key: 'payment_method', label: 'Forma de pagamento' },
  { key: 'status',        label: 'Status (pending/paid/overdue)' },
  { key: 'amount_paid',   label: 'Valor pago (R$)' },
  { key: 'alert_days_before', label: 'Avisar N dias antes' },
  { key: 'notes',         label: 'Observações' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  creditor_name:   ['credor', 'fornecedor', 'creditor', 'nome', 'name'],
  amount:          ['valor', 'amount', 'total', 'price'],
  description:     ['descricao', 'description', 'desc', 'historico'],
  due_date:        ['vencimento', 'duedate', 'datavencimento', 'data'],
  category_type:   ['tipo', 'categoriatipo', 'categorytype', 'tipocategoria'],
  creditor_type:   ['tipocredor', 'creditortype'],
  category_name:   ['categoria', 'category', 'categoriadespesa'],
  payment_method:  ['formapagamento', 'metodo', 'paymentmethod', 'forma'],
  status:          ['status', 'situacao', 'situation'],
  amount_paid:     ['valorpago', 'amountpaid', 'pago'],
  alert_days_before: ['aviso', 'diasaviso', 'alertdaysbefore'],
  notes:           ['observacoes', 'obs', 'notes', 'notas'],
};

function parseMoney(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[^\d,.\-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseBRDate(v: string): string | null {
  if (!v) return null;
  const s = v.trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y}-${mo}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function normalizeCategoryType(v: string | undefined): 'fixed' | 'variable' {
  const s = (v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (s.startsWith('fix') || s === 'fixed') return 'fixed';
  return 'variable';
}

function normalizeCreditorType(v: string | undefined): 'supplier' | 'employee' | 'other' {
  const s = (v ?? '').toLowerCase().trim();
  if (s.startsWith('fun') || s.startsWith('emp') || s === 'employee') return 'employee';
  if (s.startsWith('out') || s === 'other') return 'other';
  return 'supplier';
}

function normalizeStatus(v: string | undefined): 'pending' | 'paid' | 'overdue' | 'cancelled' {
  const s = (v ?? '').toLowerCase().trim();
  if (s.startsWith('pag') || s === 'paid') return 'paid';
  if (s.startsWith('venc') || s.startsWith('atras') || s === 'overdue') return 'overdue';
  if (s.startsWith('cancel') || s === 'cancelled') return 'cancelled';
  return 'pending';
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

interface PayablesContext extends Record<string, unknown> {
  categoryByName: Record<string, string>;
}

export const FINANCIAL_PAYABLES_IMPORT_CONFIG: ModuleImportConfig<PayablesContext> = {
  moduleKey: 'financial-payables',
  label: 'Conta a Pagar',
  labelPlural: 'contas a pagar',
  icon: TrendingDown,
  backPath: '/admin/migracao',
  targetTable: 'financial_payables',
  templateFileName: 'modelo_importacao_contas_pagar',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,

  validateRow(row, mapping) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    if (!mapped.creditor_name?.trim()) errors.push('Credor é obrigatório');
    if (!mapped.description?.trim()) errors.push('Descrição é obrigatória');
    if (!mapped.category_type?.trim()) errors.push('Tipo (fixa/variavel) é obrigatório');

    const amount = parseMoney(mapped.amount ?? '');
    if (amount === null || amount <= 0) errors.push('Valor inválido (deve ser > 0)');

    const due = parseBRDate(mapped.due_date ?? '');
    if (!due) errors.push('Vencimento inválido (use DD/MM/AAAA)');

    if (mapped.amount_paid && parseMoney(mapped.amount_paid) === null) {
      errors.push('Valor pago inválido');
    }

    if (mapped.alert_days_before && isNaN(Number(mapped.alert_days_before))) {
      errors.push('Dias de aviso deve ser um número');
    }

    return errors;
  },

  async preImport() {
    const { data } = await supabase
      .from('financial_account_categories')
      .select('id, name')
      .eq('type', 'despesa')
      .eq('is_active', true);
    const categoryByName: Record<string, string> = {};
    for (const c of (data ?? []) as { id: string; name: string }[]) {
      categoryByName[normalize(c.name)] = c.id;
    }
    return { categoryByName };
  },

  buildRecord(mappedRow, _extras, _i, ctx) {
    const record: Record<string, unknown> = {
      creditor_name: mappedRow.creditor_name.trim(),
      creditor_type: normalizeCreditorType(mappedRow.creditor_type),
      amount: parseMoney(mappedRow.amount) ?? 0,
      category_type: normalizeCategoryType(mappedRow.category_type),
      description: mappedRow.description.trim(),
      due_date: parseBRDate(mappedRow.due_date),
      payment_method: mappedRow.payment_method?.trim() || null,
      status: normalizeStatus(mappedRow.status),
      amount_paid: mappedRow.amount_paid ? (parseMoney(mappedRow.amount_paid) ?? 0) : 0,
      alert_days_before: mappedRow.alert_days_before ? Number(mappedRow.alert_days_before) : 3,
      notes: mappedRow.notes?.trim() || null,
    };

    const catKey = normalize(mappedRow.category_name ?? '');
    if (catKey && ctx.categoryByName[catKey]) {
      record.account_category_id = ctx.categoryByName[catKey];
    }

    if (record.status === 'paid' && !record.paid_at) {
      record.paid_at = record.due_date ? `${record.due_date}T12:00:00Z` : new Date().toISOString();
      if ((record.amount_paid as number) === 0) record.amount_paid = record.amount;
    }

    return record;
  },
};
