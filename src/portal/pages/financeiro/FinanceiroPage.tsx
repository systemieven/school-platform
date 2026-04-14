import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import {
  Loader2, Wallet, Clock, AlertTriangle, CheckCircle2, Copy, Check, ExternalLink, Filter, Gavel,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Installment {
  id: string;
  installment_number: number;
  reference_month: string;
  due_date: string;
  amount: number;
  amount_with_discount: number | null;
  status: string;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  boleto_url: string | null;
  pix_code: string | null;
  payment_link: string | null;
  contract: { plan: { max_overdue_days: number } | null } | null;
}

function isExtrajudicial(inst: Installment): boolean {
  if (inst.status === 'paid') return false;
  const max = inst.contract?.plan?.max_overdue_days ?? 0;
  if (max <= 0) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(inst.due_date + 'T00:00:00');
  const limit = new Date(due);
  limit.setDate(limit.getDate() + max);
  return today > limit;
}

type StatusFilter = 'all' | 'pending' | 'overdue' | 'paid';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pendente',     color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30' },
  overdue:      { label: 'Vencida',      color: 'text-red-700 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/30' },
  paid:         { label: 'Paga',         color: 'text-green-700 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-900/30' },
  negotiated:   { label: 'Negociada',    color: 'text-blue-700 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/30' },
  cancelled:    { label: 'Cancelada',    color: 'text-gray-500 dark:text-gray-400',     bg: 'bg-gray-50 dark:bg-gray-800' },
  renegotiated: { label: 'Renegociada',  color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' },
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',     label: 'Todas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'overdue', label: 'Vencidas' },
  { key: 'paid',    label: 'Pagas' },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const { student } = useStudentAuth();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [pixKey, setPixKey] = useState<{ type: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load installments + PIX key
  useEffect(() => {
    if (!student?.id) { setLoading(false); return; }

    Promise.all([
      supabase
        .from('financial_installments')
        .select('id, installment_number, reference_month, due_date, amount, amount_with_discount, status, paid_at, paid_amount, payment_method, boleto_url, pix_code, payment_link, contract:financial_contracts(plan:financial_plans(max_overdue_days))')
        .eq('student_id', student.id)
        .order('due_date'),
      supabase.rpc('get_pix_key'),
    ]).then(([inst, pix]) => {
      setInstallments((inst.data ?? []) as unknown as Installment[]);
      if (pix.data && typeof pix.data === 'object' && (pix.data as Record<string, string>).value) {
        setPixKey(pix.data as { type: string; value: string });
      }
      setLoading(false);
    });
  }, [student]);

  // ── Computed ─────────────────────────────────────────────────────────────
  const pending  = installments.filter(i => i.status === 'pending');
  const overdue  = installments.filter(i => i.status === 'overdue');
  const paid     = installments.filter(i => i.status === 'paid');
  const extrajudicial = installments.filter(isExtrajudicial);

  const totalPending = [...pending, ...overdue].reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdue = overdue.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid    = paid.reduce((s, i) => s + Number(i.paid_amount ?? i.amount), 0);

  const filtered = filter === 'all'
    ? installments
    : installments.filter(i => i.status === filter);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const date = new Date(Number(y), Number(mo) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  };

  async function handleCopyPix() {
    if (!pixKey) return;
    await navigator.clipboard.writeText(pixKey.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Financeiro
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Acompanhe suas parcelas e pagamentos.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pendente</span>
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmt(totalPending)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{pending.length + overdue.length} parcela(s)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Em Atraso</span>
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmt(totalOverdue)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{overdue.length} parcela(s)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pagas</span>
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmt(totalPaid)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{paid.length} parcela(s)</p>
        </div>
      </div>

      {/* Extrajudicial banner */}
      {extrajudicial.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <Gavel className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {extrajudicial.length} parcela{extrajudicial.length > 1 && 's'} em cobrança extrajudicial
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              O prazo para pagamento pelo portal expirou. Entre em contato com a secretaria da escola para regularização.
            </p>
          </div>
        </div>
      )}

      {/* PIX Copy */}
      {pixKey && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Chave PIX para pagamento</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{pixKey.type}: {pixKey.value}</p>
          </div>
          <button
            onClick={handleCopyPix}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar PIX'}
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <Filter className="w-4 h-4 text-gray-400 ml-2 mr-1" />
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Installments List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Wallet className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma parcela encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Parcela</th>
                  <th className="px-4 py-3">Referência</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(inst => {
                  const st = STATUS_MAP[inst.status] ?? STATUS_MAP.pending;
                  const blocked = isExtrajudicial(inst);
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
                        {String(inst.installment_number).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 capitalize">
                        {fmtMonth(inst.reference_month)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {fmtDate(inst.due_date)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-200">
                        {fmt(Number(inst.amount))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {blocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30">
                            <Gavel className="w-3 h-3" />
                            Extrajudicial
                          </span>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color} ${st.bg}`}>
                            {st.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {blocked ? (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            Contate a secretaria
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {inst.boleto_url && (
                              <a
                                href={inst.boleto_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Boleto
                              </a>
                            )}
                            {inst.payment_link && !inst.boleto_url && (
                              <a
                                href={inst.payment_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Pagar
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(inst => {
              const st = STATUS_MAP[inst.status] ?? STATUS_MAP.pending;
              const blocked = isExtrajudicial(inst);
              return (
                <div key={inst.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Parcela {String(inst.installment_number).padStart(2, '0')}
                    </span>
                    {blocked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30">
                        <Gavel className="w-3 h-3" />
                        Extrajudicial
                      </span>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color} ${st.bg}`}>
                        {st.label}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide mb-0.5">Referência</span>
                      <span className="text-gray-700 dark:text-gray-200 capitalize">{fmtMonth(inst.reference_month)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide mb-0.5">Vencimento</span>
                      <span className="text-gray-700 dark:text-gray-200">{fmtDate(inst.due_date)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide mb-0.5">Valor</span>
                      <span className="text-gray-700 dark:text-gray-200 font-medium">{fmt(Number(inst.amount))}</span>
                    </div>
                    {inst.paid_amount && (
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide mb-0.5">Pago</span>
                        <span className="text-green-700 dark:text-green-400 font-medium">{fmt(Number(inst.paid_amount))}</span>
                      </div>
                    )}
                  </div>
                  {blocked ? (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                        <Gavel className="w-3 h-3" />
                        Prazo expirado — contate a secretaria da escola
                      </p>
                    </div>
                  ) : (inst.boleto_url || inst.payment_link) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <a
                        href={inst.boleto_url || inst.payment_link || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {inst.boleto_url ? 'Ver Boleto' : 'Link de Pagamento'}
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
