import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type { FinancialInstallment, FinancialInstallmentStatus, PaymentMethod } from '../../types/admin.types';
import { INSTALLMENT_STATUS_LABELS, INSTALLMENT_STATUS_COLORS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Loader2, Search, ChevronDown, Receipt, Calendar, DollarSign,
  Check, Save, AlertTriangle, CreditCard, User, FileText, FileCheck2,
} from 'lucide-react';
import { SelectDropdown } from '../../components/FormField';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  boleto: 'Boleto',
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  transfer: 'Transferência',
  other: 'Outro',
};

// NFS-e status per installment_id
type NfseStatus = 'pendente' | 'autorizada' | 'cancelada' | 'substituida' | 'rejeitada';
const NFSE_STATUS_COLORS: Record<NfseStatus, string> = {
  pendente:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  autorizada:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelada:   'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  substituida: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  rejeitada:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const NFSE_STATUS_LABELS: Record<NfseStatus, string> = {
  pendente: 'NFS-e Pendente', autorizada: 'NFS-e Autorizada',
  cancelada: 'NFS-e Cancelada', substituida: 'NFS-e Substituída', rejeitada: 'NFS-e Rejeitada',
};

export default function FinancialInstallmentsPage() {
  const { profile } = useAdminAuth();
  const [installments, setInstallments] = useState<FinancialInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FinancialInstallmentStatus | 'all'>('all');

  // NFS-e per installment
  const [nfseByInstallment, setNfseByInstallment] = useState<Record<string, { id: string; status: NfseStatus; numero?: number }>>({});
  const [emittingNfse, setEmittingNfse] = useState<string | null>(null);

  // Payment drawer
  const [payingInst, setPayingInst] = useState<FinancialInstallment | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pix');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('financial_installments')
      .select('*, student:students(full_name, enrollment_number), contract:financial_contracts(school_year, plan:financial_plans(name))')
      .order('due_date', { ascending: true });
    const list = (data ?? []) as unknown as FinancialInstallment[];
    setInstallments(list);

    // Load NFS-e status for all installments
    if (list.length > 0) {
      const ids = list.map((i) => i.id);
      const { data: nfseRows } = await supabase
        .from('nfse_emitidas')
        .select('id, installment_id, status, numero')
        .in('installment_id', ids)
        .neq('status', 'cancelada');
      if (nfseRows) {
        const map: Record<string, { id: string; status: NfseStatus; numero?: number }> = {};
        for (const n of nfseRows) {
          if (n.installment_id) map[n.installment_id] = { id: n.id, status: n.status as NfseStatus, numero: n.numero };
        }
        setNfseByInstallment(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = installments.filter((inst) => {
    if (statusFilter !== 'all' && inst.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = inst.student?.full_name?.toLowerCase() || '';
      const enroll = inst.student?.enrollment_number?.toLowerCase() || '';
      if (!name.includes(q) && !enroll.includes(q)) return false;
    }
    return true;
  });

  const overdueCount = installments.filter((i) => i.status === 'overdue').length;
  const pendingCount = installments.filter((i) => i.status === 'pending').length;
  const paidCount = installments.filter((i) => i.status === 'paid').length;
  const totalPending = installments.filter((i) => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const totalOverdue = installments.filter((i) => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);

  function fmt(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  }

  function openPayDrawer(inst: FinancialInstallment) {
    setPayingInst(inst);
    setPayAmount(Number(inst.total_due ?? inst.amount));
    setPayMethod('pix');
    setPayNotes('');
  }

  function closePayDrawer() {
    setPayingInst(null);
  }

  async function handlePay() {
    if (!payingInst || !profile) return;
    setSaving(true);

    const { error } = await supabase
      .from('financial_installments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_amount: payAmount,
        payment_method: payMethod,
        payment_notes: payNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payingInst.id);

    if (!error) {
      logAudit({
        action: 'update',
        module: 'financial-installments',
        description: 'Pagamento registrado',
        newData: { id: payingInst.id, paid_amount: payAmount, payment_method: payMethod },
      });

      // Registrar movimento no caixa aberto do dia (melhor-esforço)
      const { data: reg } = await supabase
        .from('financial_cash_registers')
        .select('id, current_balance')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reg) {
        const newBalance = reg.current_balance + payAmount;
        await Promise.all([
          supabase.from('financial_cash_movements').insert({
            cash_register_id: reg.id,
            type: 'inflow',
            sub_type: 'recebimento',
            amount: payAmount,
            balance_after: newBalance,
            description: `Mensalidade ${payingInst.installment_number}: ${payingInst.student?.full_name ?? ''}`,
            payment_method: payMethod,
            reference_type: 'installment',
            reference_id: payingInst.id,
            recorded_by: profile.id,
          }),
          supabase
            .from('financial_cash_registers')
            .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', reg.id),
        ]);
      }

      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => {
        setSaved(false);
        closePayDrawer();
        load();
      }, 1200);
    }
    setSaving(false);
  }

  async function handleEmitNfse(inst: FinancialInstallment) {
    if (!profile) return;
    setEmittingNfse(inst.id);
    try {
      const { error } = await supabase.functions.invoke('nfse-emitter', {
        body: {
          source: 'installment',
          source_id: inst.id,
          guardian_id: (inst as any).contract?.guardian_id ?? null,
          valor_servico: Number(inst.amount),
          discriminacao: `Mensalidade ${inst.reference_month} - Parcela ${inst.installment_number}`,
          initiated_by: profile.id,
        },
      });
      if (!error) await load();
    } finally {
      setEmittingNfse(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Pendentes</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{pendingCount} <span className="text-xs font-normal text-gray-400">({fmt(totalPending)})</span></p>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Vencidas</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{overdueCount} <span className="text-xs font-normal text-gray-400">({fmt(totalOverdue)})</span></p>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
            <Check className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Pagas</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{paidCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por aluno..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FinancialInstallmentStatus | 'all')}
            className="appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none">
            <option value="all">Todos os status</option>
            {(['pending', 'overdue', 'paid', 'negotiated', 'cancelled', 'renegotiated'] as FinancialInstallmentStatus[]).map((s) => (
              <option key={s} value={s}>{INSTALLMENT_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Installments list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma parcela encontrada</p>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Aluno</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Parcela</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Vencimento</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Valor</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pago</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">NFS-e</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inst) => (
                  <tr key={inst.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-white/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 dark:text-white">{inst.student?.full_name || '—'}</p>
                      <p className="text-[10px] text-gray-400">{inst.student?.enrollment_number} · {inst.contract?.plan?.name}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {inst.installment_number}/{inst.reference_month}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{fmtDate(inst.due_date)}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-white">{fmt(Number(inst.amount))}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${INSTALLMENT_STATUS_COLORS[inst.status]}`}>
                        {INSTALLMENT_STATUS_LABELS[inst.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                      {inst.paid_amount ? fmt(Number(inst.paid_amount)) : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {nfseByInstallment[inst.id] ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${NFSE_STATUS_COLORS[nfseByInstallment[inst.id].status]}`}>
                          {nfseByInstallment[inst.id].numero ? `NFS-e ${nfseByInstallment[inst.id].numero}` : NFSE_STATUS_LABELS[nfseByInstallment[inst.id].status]}
                        </span>
                      ) : inst.status === 'paid' ? (
                        <PermissionGate moduleKey="nfse-emitidas" action="create">
                          <button
                            onClick={() => handleEmitNfse(inst)}
                            disabled={emittingNfse === inst.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-secondary rounded-lg hover:bg-brand-primary/20 transition-colors font-semibold disabled:opacity-50"
                            title="Emitir NFS-e"
                          >
                            {emittingNfse === inst.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileCheck2 className="w-3 h-3" />}
                            {emittingNfse === inst.id ? '…' : 'Emitir'}
                          </button>
                        </PermissionGate>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(inst.status === 'pending' || inst.status === 'overdue') && (
                        <PermissionGate moduleKey="financial-installments" action="edit">
                          <button onClick={() => openPayDrawer(inst)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors font-medium">
                            <CreditCard className="w-3 h-3" /> Baixa
                          </button>
                        </PermissionGate>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((inst) => (
              <div key={inst.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{inst.student?.full_name || '—'}</p>
                      <p className="text-[10px] text-gray-400">{inst.student?.enrollment_number}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${INSTALLMENT_STATUS_COLORS[inst.status]}`}>
                    {INSTALLMENT_STATUS_LABELS[inst.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Parcela {inst.installment_number} · Venc. {fmtDate(inst.due_date)}</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{fmt(Number(inst.amount))}</span>
                </div>
                {inst.paid_amount && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Pago: {fmt(Number(inst.paid_amount))}</p>
                )}
                {(inst.status === 'pending' || inst.status === 'overdue') && (
                  <PermissionGate moduleKey="financial-installments" action="edit">
                    <button onClick={() => openPayDrawer(inst)}
                      className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors font-medium">
                      <CreditCard className="w-3 h-3" /> Registrar Pagamento
                    </button>
                  </PermissionGate>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawer: Payment */}
      <Drawer
        open={!!payingInst}
        onClose={closePayDrawer}
        title="Registrar Pagamento"
        icon={CreditCard}
        badge={payingInst && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${INSTALLMENT_STATUS_COLORS[payingInst.status]}`}>
            {INSTALLMENT_STATUS_LABELS[payingInst.status]}
          </span>
        )}
        width="w-[400px]"
        footer={
          <div className="flex gap-3">
            <button onClick={closePayDrawer} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Cancelar</button>
            <button onClick={handlePay} disabled={!payAmount || saving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : saved ? 'Registrado!' : 'Confirmar Pagamento'}
            </button>
          </div>
        }
      >
        {payingInst && (
          <>
            <DrawerCard title="Parcela" icon={FileText}>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Aluno</span>
                  <span className="font-medium text-gray-800 dark:text-white">{payingInst.student?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parcela</span>
                  <span className="text-gray-700 dark:text-gray-300">{payingInst.installment_number}/{payingInst.reference_month}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vencimento</span>
                  <span className="text-gray-700 dark:text-gray-300">{fmtDate(payingInst.due_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor original</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{fmt(Number(payingInst.amount))}</span>
                </div>
              </div>
            </DrawerCard>

            <DrawerCard title="Pagamento" icon={DollarSign}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor pago *</label>
                <input type="number" step="0.01" min="0" value={payAmount || ''} onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none" />
              </div>
              <SelectDropdown label="Forma de pagamento *" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </SelectDropdown>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Observações</label>
                <textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} placeholder="Comprovante, referência..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none resize-none" />
              </div>
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}
