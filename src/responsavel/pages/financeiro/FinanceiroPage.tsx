import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import { Loader2, Wallet, Clock, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';

interface Installment {
  id: string;
  installment_number: number;
  reference_month: string;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
  paid_amount: number | null;
}

type StatusFilter = 'all' | 'pending' | 'overdue' | 'paid';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pendente',    color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30' },
  overdue:      { label: 'Vencida',     color: 'text-red-700 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/30' },
  paid:         { label: 'Paga',        color: 'text-green-700 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-900/30' },
  negotiated:   { label: 'Negociada',   color: 'text-blue-700 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/30' },
  cancelled:    { label: 'Cancelada',   color: 'text-gray-500 dark:text-gray-400',     bg: 'bg-gray-50 dark:bg-gray-800' },
  renegotiated: { label: 'Renegociada', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' },
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',     label: 'Todas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'overdue', label: 'Vencidas' },
  { key: 'paid',    label: 'Pagas' },
];

export default function GuardianFinanceiroPage() {
  const { currentStudentId } = useGuardian();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<StatusFilter>('all');

  useEffect(() => {
    if (!currentStudentId) { setLoading(false); return; }

    supabase
      .from('financial_installments')
      .select('id, installment_number, reference_month, due_date, amount, status, paid_at, paid_amount')
      .eq('student_id', currentStudentId)
      .order('due_date')
      .then(({ data }) => {
        setInstallments((data ?? []) as Installment[]);
        setLoading(false);
      });
  }, [currentStudentId]);

  const pending = installments.filter((i) => i.status === 'pending');
  const overdue = installments.filter((i) => i.status === 'overdue');
  const paid    = installments.filter((i) => i.status === 'paid');

  const totalPending = [...pending, ...overdue].reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdue = overdue.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid    = paid.reduce((s, i) => s + Number(i.paid_amount ?? i.amount), 0);

  const filtered = filter === 'all' ? installments : installments.filter((i) => i.status === filter);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Financeiro
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Acompanhe as parcelas do contrato escolar.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">A Pagar</span>
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmt(totalPending)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{pending.length + overdue.length} parcela(s)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Em Atraso</span>
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmt(totalOverdue)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{overdue.length} parcela(s)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pagas</span>
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmt(totalPaid)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{paid.length} parcela(s)</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <Filter className="w-4 h-4 text-gray-400 ml-2 mr-1" />
        {FILTERS.map((f) => (
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wallet className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma parcela encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inst) => {
            const st = STATUS_MAP[inst.status] ?? STATUS_MAP.pending;
            return (
              <div key={inst.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Parcela {String(inst.installment_number).padStart(2, '0')}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color} ${st.bg}`}>
                    {st.label}
                  </span>
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
                      <span className="block text-[10px] uppercase tracking-wide mb-0.5">Pago em</span>
                      <span className="text-green-700 dark:text-green-400">{inst.paid_at ? fmtDate(inst.paid_at) : '—'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
