/**
 * FinancialCashPage — Controle de Caixas (Fase 8.5)
 *
 * Lista de caixas com abertura/fechamento, sangria, suprimento e
 * lançamentos avulsos (inflow/outflow). Histórico de movimentações por caixa.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type {
  FinancialCashRegister,
  FinancialCashMovement,
  CashMovementType,
  CashMovementSubType,
} from '../../types/admin.types';
import { CASH_MOVEMENT_TYPE_LABELS, CASH_MOVEMENT_SUB_TYPE_LABELS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import PermissionGate from '../../components/PermissionGate';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Loader2, Plus, Vault, Check, DollarSign,
  TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight,
  ChevronUp, History, Pencil,
} from 'lucide-react';

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const INFLOW_SUB_TYPES: CashMovementSubType[] = [
  'recebimento', 'devolucao', 'taxa_evento', 'taxa_passeio', 'taxa_diversa',
];
const OUTFLOW_SUB_TYPES: CashMovementSubType[] = ['despesa_operacional'];

const PAYMENT_METHODS = [
  { value: 'cash',      label: 'Dinheiro' },
  { value: 'pix',       label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card',  label: 'Cartão de Débito' },
  { value: 'transfer',  label: 'Transferência' },
  { value: 'boleto',    label: 'Boleto' },
  { value: 'other',     label: 'Outro' },
];

export default function FinancialCashPage() {
  const { profile } = useAdminAuth();
  const [registers, setRegisters] = useState<FinancialCashRegister[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded register (shows movements)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Record<string, FinancialCashMovement[]>>({});
  const [movLoading, setMovLoading] = useState(false);

  // Register drawer (create)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regDesc, setRegDesc] = useState('');
  const [regSaving, setRegSaving] = useState(false);
  const [regSaved, setRegSaved] = useState(false);

  // Movement drawer
  const [movDrawerOpen, setMovDrawerOpen] = useState(false);
  const [movRegister, setMovRegister] = useState<FinancialCashRegister | null>(null);
  const [movType, setMovType] = useState<CashMovementType>('inflow');
  const [movSubType, setMovSubType] = useState<CashMovementSubType | ''>('recebimento');
  const [movAmount, setMovAmount] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [movPayer, setMovPayer] = useState('');
  const [movMethod, setMovMethod] = useState('cash');
  const [movSaving, setMovSaving] = useState(false);
  const [movSaved, setMovSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('financial_cash_registers')
      .select('*')
      .order('created_at');
    setRegisters((data ?? []) as FinancialCashRegister[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadMovements(registerId: string) {
    setMovLoading(true);
    const { data } = await supabase
      .from('financial_cash_movements')
      .select('*, account_category:financial_account_categories(name)')
      .eq('cash_register_id', registerId)
      .order('movement_date', { ascending: false })
      .limit(50);
    setMovements((prev) => ({ ...prev, [registerId]: (data ?? []) as FinancialCashMovement[] }));
    setMovLoading(false);
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!movements[id]) loadMovements(id);
    }
  }

  // ── Register create ──
  async function saveRegister() {
    if (!regName.trim()) return;
    setRegSaving(true);
    await supabase.from('financial_cash_registers').insert({
      name: regName.trim(),
      description: regDesc.trim() || null,
    });
    logAudit({ action: 'create', module: 'financial-cash', description: `Caixa criado: ${regName}` });
    setRegSaving(false);
    setRegSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      setRegSaved(false);
      setDrawerOpen(false);
      setRegName('');
      setRegDesc('');
      load();
    }, 900);
  }

  // ── Open / Close register ──
  async function toggleRegisterStatus(reg: FinancialCashRegister) {
    const isOpening = reg.status === 'closed';
    const newStatus = isOpening ? 'open' : 'closed';
    await supabase.from('financial_cash_registers').update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', reg.id);

    // Register opening/closing movement
    const currentBalance = Number(reg.current_balance);
    await supabase.from('financial_cash_movements').insert({
      cash_register_id: reg.id,
      type: isOpening ? 'opening' : 'closing',
      amount: Math.max(currentBalance, 0.01),
      balance_after: currentBalance,
      description: isOpening ? 'Abertura de caixa' : 'Fechamento de caixa',
      recorded_by: profile?.id ?? null,
    });
    logAudit({
      action: 'update',
      module: 'financial-cash',
      description: `Caixa ${isOpening ? 'aberto' : 'fechado'}: ${reg.name}`,
    });
    load();
    if (expandedId === reg.id) loadMovements(reg.id);
  }

  // ── Movement create ──
  function openMovDrawer(reg: FinancialCashRegister, type: CashMovementType) {
    setMovRegister(reg);
    setMovType(type);
    setMovSubType(type === 'inflow' ? 'recebimento' : type === 'outflow' ? 'despesa_operacional' : '');
    setMovAmount('');
    setMovDesc('');
    setMovPayer('');
    setMovMethod('cash');
    setMovDrawerOpen(true);
  }

  async function saveMovement() {
    if (!movRegister || !movAmount || Number(movAmount) <= 0) return;
    setMovSaving(true);

    const amount = Number(movAmount);
    const reg = registers.find((r) => r.id === movRegister.id)!;
    const isInflow = ['inflow', 'suprimento', 'opening'].includes(movType);
    const newBalance = Number(reg.current_balance) + (isInflow ? amount : -amount);

    await supabase.from('financial_cash_movements').insert({
      cash_register_id: movRegister.id,
      type: movType,
      sub_type: movSubType || null,
      amount,
      balance_after: newBalance,
      description: movDesc.trim() || CASH_MOVEMENT_TYPE_LABELS[movType],
      payer_name: movPayer.trim() || null,
      payment_method: movMethod || null,
      recorded_by: profile?.id ?? null,
    });

    await supabase.from('financial_cash_registers').update({
      current_balance: newBalance,
      updated_at: new Date().toISOString(),
    }).eq('id', movRegister.id);

    logAudit({
      action: 'create',
      module: 'financial-cash',
      description: `Movimentação ${movType} R$ ${amount.toFixed(2)} em ${movRegister.name}`,
    });

    setMovSaving(false);
    setMovSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      setMovSaved(false);
      setMovDrawerOpen(false);
      load();
      if (expandedId === movRegister.id) loadMovements(movRegister.id);
    }, 900);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <PermissionGate moduleKey="financial-cash">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {registers.length} caixa{registers.length !== 1 ? 's' : ''} cadastrado{registers.length !== 1 ? 's' : ''}
              {' · '}
              {registers.filter((r) => r.status === 'open').length} aberto{registers.filter((r) => r.status === 'open').length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors font-medium"
          >
            <Plus className="w-3 h-3" /> Novo Caixa
          </button>
        </div>

        {/* Lista de caixas */}
        {registers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Vault className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum caixa cadastrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registers.map((reg) => {
              const isOpen = reg.status === 'open';
              const isExpanded = expandedId === reg.id;
              const regMovements = movements[reg.id] ?? [];

              return (
                <div
                  key={reg.id}
                  className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                  {/* Cabeçalho do caixa */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isOpen ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <Vault className={`w-5 h-5 ${isOpen ? 'text-emerald-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{reg.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOpen
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          {isOpen ? 'ABERTO' : 'FECHADO'}
                        </span>
                      </div>
                      {reg.description && (
                        <p className="text-xs text-gray-400 truncate">{reg.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800 dark:text-white">{fmt(reg.current_balance)}</p>
                      <p className="text-[10px] text-gray-400">Saldo atual</p>
                    </div>
                    {/* Ações */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isOpen && (
                        <>
                          <button
                            onClick={() => openMovDrawer(reg, 'inflow')}
                            title="Nova entrada"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openMovDrawer(reg, 'outflow')}
                            title="Nova saída"
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <TrendingDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openMovDrawer(reg, 'sangria')}
                            title="Sangria"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                          >
                            <ArrowDownLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openMovDrawer(reg, 'suprimento')}
                            title="Suprimento"
                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleRegisterStatus(reg)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          isOpen
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100'
                            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                        }`}
                      >
                        {isOpen ? 'Fechar' : 'Abrir'}
                      </button>
                      <button
                        onClick={() => toggleExpand(reg.id)}
                        className="p-1.5 text-gray-400 hover:text-brand-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Histórico"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Histórico de movimentações */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50">
                      {movLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                      ) : regMovements.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-8">Nenhuma movimentação registrada.</p>
                      ) : (
                        <div className="divide-y divide-gray-50 dark:divide-gray-700">
                          {regMovements.map((mov) => {
                            const isPositive = ['inflow', 'suprimento', 'opening'].includes(mov.type);
                            return (
                              <div key={mov.id} className="flex items-center gap-3 px-5 py-3">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isPositive
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                    : 'bg-red-100 dark:bg-red-900/30'
                                }`}>
                                  {isPositive
                                    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                    : <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                    {CASH_MOVEMENT_TYPE_LABELS[mov.type]}
                                    {mov.sub_type && ` — ${CASH_MOVEMENT_SUB_TYPE_LABELS[mov.sub_type]}`}
                                  </p>
                                  <p className="text-[10px] text-gray-400 truncate">{mov.description}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className={`text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {isPositive ? '+' : '-'}{fmt(mov.amount)}
                                  </p>
                                  <p className="text-[10px] text-gray-400">{fmtDateTime(mov.movement_date)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Drawer: Novo Caixa ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Novo Caixa"
        icon={Vault}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setDrawerOpen(false)}
              disabled={regSaving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveRegister}
              disabled={!regName.trim() || regSaving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                regSaved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
              }`}
            >
              {regSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : regSaved ? <Check className="w-4 h-4" /> : <Vault className="w-4 h-4" />}
              {regSaving ? 'Salvando…' : regSaved ? 'Salvo!' : 'Criar Caixa'}
            </button>
          </div>
        }
      >
        <DrawerCard title="Identificação" icon={Pencil}>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome *</label>
            <input
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Ex: Caixa Principal"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição</label>
            <input
              value={regDesc}
              onChange={(e) => setRegDesc(e.target.value)}
              placeholder="Descrição opcional"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none"
            />
          </div>
        </DrawerCard>
      </Drawer>

      {/* ── Drawer: Movimentação ── */}
      <Drawer
        open={movDrawerOpen}
        onClose={() => setMovDrawerOpen(false)}
        title={movRegister ? `${CASH_MOVEMENT_TYPE_LABELS[movType]} — ${movRegister.name}` : 'Movimentação'}
        icon={DollarSign}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setMovDrawerOpen(false)}
              disabled={movSaving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveMovement}
              disabled={!movAmount || Number(movAmount) <= 0 || movSaving}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                movSaved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
              }`}
            >
              {movSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : movSaved ? <Check className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
              {movSaving ? 'Registrando…' : movSaved ? 'Registrado!' : 'Registrar'}
            </button>
          </div>
        }
      >
        {movRegister && (
          <>
            <DrawerCard title="Detalhes" icon={DollarSign}>
              {/* Sub-tipo */}
              {(movType === 'inflow' || movType === 'outflow') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tipo de Lançamento</label>
                  <select
                    value={movSubType}
                    onChange={(e) => setMovSubType(e.target.value as CashMovementSubType)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none"
                  >
                    {(movType === 'inflow' ? INFLOW_SUB_TYPES : OUTFLOW_SUB_TYPES).map((st) => (
                      <option key={st} value={st}>{CASH_MOVEMENT_SUB_TYPE_LABELS[st]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Valor */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor *</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Descrição</label>
                <input
                  value={movDesc}
                  onChange={(e) => setMovDesc(e.target.value)}
                  placeholder="Descrição do lançamento"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none"
                />
              </div>

              {/* Pagante (para recebimentos) */}
              {movType === 'inflow' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Identificação do Pagante</label>
                  <input
                    value={movPayer}
                    onChange={(e) => setMovPayer(e.target.value)}
                    placeholder="Nome do pagante (opcional)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none"
                  />
                </div>
              )}

              {/* Forma de pagamento */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Forma de Pagamento</label>
                <select
                  value={movMethod}
                  onChange={(e) => setMovMethod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </DrawerCard>

            {/* Resumo */}
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl px-4 py-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Saldo atual</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{fmt(movRegister.current_balance)}</span>
              </div>
              {movAmount && Number(movAmount) > 0 && (
                <div className="flex justify-between">
                  <span>Saldo após</span>
                  <span className={`font-semibold ${
                    ['inflow', 'suprimento'].includes(movType) ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {fmt(
                      ['inflow', 'suprimento'].includes(movType)
                        ? movRegister.current_balance + Number(movAmount)
                        : movRegister.current_balance - Number(movAmount),
                    )}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </Drawer>
    </PermissionGate>
  );
}
