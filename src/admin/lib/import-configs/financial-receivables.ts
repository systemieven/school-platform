/**
 * Config de importacao de Contas a Receber (financial_receivables).
 *
 * Cobre A/R geral (taxas, eventos, manual) — separado de `financial_installments`
 * que cobre mensalidades via contratos. student_id e account_category_id sao
 * opcionais e resolvidos por nome via preImport. Sem dedup automatico: cada
 * linha gera um novo receivable (multiplos receivables por pagador sao validos).
 */
import { TrendingUp } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';

const FIELDS = [
  { key: 'payer_name',    label: 'Nome do pagador', required: true },
  { key: 'amount',        label: 'Valor (R$)',      required: true },
  { key: 'description',   label: 'Descrição',       required: true },
  { key: 'due_date',      label: 'Vencimento (DD/MM/AAAA)', required: true },
  { key: 'payer_type',    label: 'Tipo (student/responsible/external)' },
  { key: 'student_name',  label: 'Aluno (nome — opcional)' },
  { key: 'category_name', label: 'Categoria (nome receita)' },
  { key: 'payment_method', label: 'Forma de pagamento' },
  { key: 'status',        label: 'Status (pending/paid/overdue)' },
  { key: 'amount_paid',   label: 'Valor pago (R$)' },
  { key: 'notes',         label: 'Observações' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  payer_name:     ['pagador', 'payer', 'nome', 'name', 'cliente'],
  amount:         ['valor', 'amount', 'total', 'price'],
  description:    ['descricao', 'description', 'desc', 'historico'],
  due_date:       ['vencimento', 'duedate', 'datavencimento', 'data'],
  payer_type:     ['tipo', 'tipopagador', 'payertype'],
  student_name:   ['aluno', 'student', 'nomealuno'],
  category_name:  ['categoria', 'category', 'categoriareceita'],
  payment_method: ['formapagamento', 'metodo', 'paymentmethod', 'forma'],
  status:         ['status', 'situacao', 'situation'],
  amount_paid:    ['valorpago', 'amountpaid', 'pago'],
  notes:          ['observacoes', 'obs', 'notes', 'notas'],
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
  // DD/MM/YYYY ou DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y}-${mo}-${d}`;
  }
  // Tenta ISO direto
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function normalizePayerType(v: string | undefined): 'student' | 'responsible' | 'external' {
  const s = (v ?? '').toLowerCase().trim();
  if (s.startsWith('alu') || s === 'student') return 'student';
  if (s.startsWith('resp') || s === 'responsible') return 'responsible';
  return 'external';
}

function normalizeStatus(v: string | undefined): 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled' {
  const s = (v ?? '').toLowerCase().trim();
  if (s.startsWith('pag') || s === 'paid') return 'paid';
  if (s.startsWith('parc') || s === 'partial') return 'partial';
  if (s.startsWith('venc') || s.startsWith('atras') || s === 'overdue') return 'overdue';
  if (s.startsWith('cancel') || s === 'cancelled') return 'cancelled';
  return 'pending';
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

interface ReceivablesContext extends Record<string, unknown> {
  categoryByName: Record<string, string>;
  studentByName: Record<string, string>;
}

export const FINANCIAL_RECEIVABLES_IMPORT_CONFIG: ModuleImportConfig<ReceivablesContext> = {
  moduleKey: 'financial-receivables',
  label: 'Conta a Receber',
  labelPlural: 'contas a receber',
  icon: TrendingUp,
  backPath: '/admin/migracao',
  targetTable: 'financial_receivables',
  templateFileName: 'modelo_importacao_contas_receber',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,

  validateRow(row, mapping) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    if (!mapped.payer_name?.trim()) errors.push('Nome do pagador é obrigatório');
    if (!mapped.description?.trim()) errors.push('Descrição é obrigatória');

    const amount = parseMoney(mapped.amount ?? '');
    if (amount === null || amount <= 0) errors.push('Valor inválido (deve ser > 0)');

    const due = parseBRDate(mapped.due_date ?? '');
    if (!due) errors.push('Vencimento inválido (use DD/MM/AAAA)');

    if (mapped.amount_paid && parseMoney(mapped.amount_paid) === null) {
      errors.push('Valor pago inválido');
    }

    return errors;
  },

  async preImport() {
    const [catRes, stuRes] = await Promise.all([
      supabase.from('financial_account_categories').select('id, name').eq('type', 'receita').eq('is_active', true),
      supabase.from('students').select('id, full_name').limit(10000),
    ]);
    const categoryByName: Record<string, string> = {};
    for (const c of (catRes.data ?? []) as { id: string; name: string }[]) {
      categoryByName[normalize(c.name)] = c.id;
    }
    const studentByName: Record<string, string> = {};
    for (const s of (stuRes.data ?? []) as { id: string; full_name: string }[]) {
      studentByName[normalize(s.full_name)] = s.id;
    }
    return { categoryByName, studentByName };
  },

  buildRecord(mappedRow, _extras, _i, ctx) {
    const record: Record<string, unknown> = {
      payer_name: mappedRow.payer_name.trim(),
      payer_type: normalizePayerType(mappedRow.payer_type),
      amount: parseMoney(mappedRow.amount) ?? 0,
      description: mappedRow.description.trim(),
      due_date: parseBRDate(mappedRow.due_date),
      payment_method: mappedRow.payment_method?.trim() || null,
      status: normalizeStatus(mappedRow.status),
      amount_paid: mappedRow.amount_paid ? (parseMoney(mappedRow.amount_paid) ?? 0) : 0,
      notes: mappedRow.notes?.trim() || null,
      source_type: 'manual',
    };

    const catKey = normalize(mappedRow.category_name ?? '');
    if (catKey && ctx.categoryByName[catKey]) {
      record.account_category_id = ctx.categoryByName[catKey];
    }

    const stuKey = normalize(mappedRow.student_name ?? '');
    if (stuKey && ctx.studentByName[stuKey]) {
      record.student_id = ctx.studentByName[stuKey];
      if (record.payer_type === 'external') record.payer_type = 'student';
    }

    // Se status=paid, marca paid_at = due_date como fallback
    if (record.status === 'paid' && !record.paid_at) {
      record.paid_at = record.due_date ? `${record.due_date}T12:00:00Z` : new Date().toISOString();
      if ((record.amount_paid as number) === 0) record.amount_paid = record.amount;
    }

    return record;
  },
};
