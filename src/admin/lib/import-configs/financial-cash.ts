/**
 * Config de importacao de Lancamentos de Caixa (financial_cash_movements).
 *
 * Pre-requisito: os caixas (financial_cash_registers) devem existir antes,
 * criados manualmente pelo admin. O importador resolve o caixa por nome.
 *
 * `balance_after` e calculado em tempo de import como soma corrente por caixa,
 * partindo do saldo atual do caixa no DB. Isso assume que a planilha esta
 * ordenada por data crescente por caixa — documentado no template.
 *
 * Sem dedup automatico (multiplos lancamentos similares podem existir).
 */
import { Wallet } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';

const FIELDS = [
  { key: 'cash_register_name', label: 'Caixa (nome)',           required: true },
  { key: 'type',               label: 'Tipo (entrada/saida/sangria/suprimento/abertura/fechamento)', required: true },
  { key: 'amount',             label: 'Valor (R$)',             required: true },
  { key: 'description',        label: 'Descrição',              required: true },
  { key: 'movement_date',      label: 'Data (DD/MM/AAAA)',      required: true },
  { key: 'sub_type',           label: 'Subtipo' },
  { key: 'payer_name',         label: 'Pagador' },
  { key: 'payment_method',     label: 'Forma de pagamento' },
  { key: 'category_name',      label: 'Categoria contábil' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  cash_register_name: ['caixa', 'cashregister', 'nomecaixa', 'register'],
  type:               ['tipo', 'type', 'operacao'],
  amount:             ['valor', 'amount', 'total'],
  description:        ['descricao', 'description', 'historico', 'desc'],
  movement_date:      ['data', 'date', 'movementdate', 'datamovimento'],
  sub_type:           ['subtipo', 'subtype'],
  payer_name:         ['pagador', 'payer', 'cliente'],
  payment_method:     ['formapagamento', 'metodo', 'paymentmethod', 'forma'],
  category_name:      ['categoria', 'category'],
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
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    const hh = (m[4] ?? '12').padStart(2, '0');
    const mm = (m[5] ?? '00').padStart(2, '0');
    return `${y}-${mo}-${d}T${hh}:${mm}:00Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const VALID_TYPES = ['opening', 'closing', 'sangria', 'suprimento', 'inflow', 'outflow'] as const;
type MovementType = typeof VALID_TYPES[number];

function normalizeType(v: string | undefined): MovementType | null {
  const s = normalize(v ?? '');
  if (s.startsWith('abert') || s === 'opening') return 'opening';
  if (s.startsWith('fech') || s === 'closing') return 'closing';
  if (s.startsWith('sang') || s === 'sangria') return 'sangria';
  if (s.startsWith('supr') || s.startsWith('refor') || s === 'suprimento') return 'suprimento';
  if (s.startsWith('entr') || s.startsWith('receb') || s === 'inflow' || s === 'in') return 'inflow';
  if (s.startsWith('said') || s.startsWith('desp') || s === 'outflow' || s === 'out') return 'outflow';
  return null;
}

function signFor(t: MovementType): 1 | -1 {
  return t === 'opening' || t === 'inflow' || t === 'suprimento' ? 1 : -1;
}

interface CashContext extends Record<string, unknown> {
  registerByName: Record<string, string>;
  runningBalance: Record<string, number>;
  categoryByName: Record<string, string>;
}

export const FINANCIAL_CASH_IMPORT_CONFIG: ModuleImportConfig<CashContext> = {
  moduleKey: 'financial-cash',
  label: 'Lançamento de Caixa',
  labelPlural: 'lançamentos de caixa',
  icon: Wallet,
  backPath: '/admin/migracao',
  targetTable: 'financial_cash_movements',
  templateFileName: 'modelo_importacao_caixa',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,

  validateRow(row, mapping) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    if (!mapped.cash_register_name?.trim()) errors.push('Nome do caixa é obrigatório');
    if (!mapped.description?.trim()) errors.push('Descrição é obrigatória');

    const type = normalizeType(mapped.type);
    if (!type) errors.push('Tipo inválido (use entrada/saida/sangria/suprimento/abertura/fechamento)');

    const amount = parseMoney(mapped.amount ?? '');
    if (amount === null || amount <= 0) errors.push('Valor inválido (deve ser > 0)');

    if (!parseBRDate(mapped.movement_date ?? '')) {
      errors.push('Data inválida (use DD/MM/AAAA)');
    }

    return errors;
  },

  async preImport() {
    const [regRes, catRes] = await Promise.all([
      supabase.from('financial_cash_registers').select('id, name, current_balance'),
      supabase.from('financial_account_categories').select('id, name').eq('is_active', true),
    ]);
    const registerByName: Record<string, string> = {};
    const runningBalance: Record<string, number> = {};
    for (const r of (regRes.data ?? []) as { id: string; name: string; current_balance: number }[]) {
      registerByName[normalize(r.name)] = r.id;
      runningBalance[r.id] = Number(r.current_balance ?? 0);
    }
    const categoryByName: Record<string, string> = {};
    for (const c of (catRes.data ?? []) as { id: string; name: string }[]) {
      categoryByName[normalize(c.name)] = c.id;
    }
    return { registerByName, runningBalance, categoryByName };
  },

  buildRecord(mappedRow, _extras, _i, ctx) {
    const regKey = normalize(mappedRow.cash_register_name ?? '');
    const cash_register_id = ctx.registerByName[regKey];
    if (!cash_register_id) {
      throw new Error(`Caixa "${mappedRow.cash_register_name}" não encontrado. Cadastre em Financeiro → Caixas primeiro.`);
    }

    const type = normalizeType(mappedRow.type)!;
    const amount = parseMoney(mappedRow.amount) ?? 0;
    const sign = signFor(type);
    const prevBalance = ctx.runningBalance[cash_register_id] ?? 0;
    const newBalance = prevBalance + sign * amount;
    ctx.runningBalance[cash_register_id] = newBalance;

    const record: Record<string, unknown> = {
      cash_register_id,
      type,
      sub_type: mappedRow.sub_type?.trim() || null,
      amount,
      balance_after: newBalance,
      description: mappedRow.description.trim(),
      movement_date: parseBRDate(mappedRow.movement_date),
      payer_name: mappedRow.payer_name?.trim() || null,
      payment_method: mappedRow.payment_method?.trim() || null,
    };

    const catKey = normalize(mappedRow.category_name ?? '');
    if (catKey && ctx.categoryByName[catKey]) {
      record.account_category_id = ctx.categoryByName[catKey];
    }

    return record;
  },
};
