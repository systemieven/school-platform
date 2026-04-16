/**
 * EnrollmentContractWizard
 *
 * Shown immediately after an enrollment is confirmed (student created).
 * Offers the admin a quick path to create a financial contract and
 * optionally activate it (generating installments) in one step.
 *
 * Skipping is always allowed — the contract can be created later from
 * the Financeiro → Contratos page.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { logAudit } from '../../../lib/audit';
import {
  GraduationCap,
  CreditCard,
  CheckCircle2,
  Loader2,
  Check,
  X,
  ChevronDown,
  Zap,
  PartyPopper,
} from 'lucide-react';
import { Toggle } from '../../components/Toggle';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinancialPlanOption {
  id: string;
  name: string;
  amount: number;
  installments: number;
  due_day: number | null;
  school_year: number | null;
  segment_ids: string[];
}

interface Props {
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EnrollmentContractWizard({
  studentId,
  studentName,
  enrollmentNumber,
  onClose,
}: Props) {
  const { profile } = useAdminAuth();
  const [plans, setPlans] = useState<FinancialPlanOption[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [activateNow, setActivateNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active financial plans
  useEffect(() => {
    supabase
      .from('financial_plans')
      .select('id, name, amount, installments, due_day, school_year, segment_ids')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const list = (data ?? []) as FinancialPlanOption[];
        setPlans(list);
        if (list.length === 1) setSelectedPlanId(list[0].id);
        setLoadingPlans(false);
      });
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  async function handleCreate() {
    if (!selectedPlanId) return;
    setSaving(true);
    setError(null);

    const currentYear = new Date().getFullYear();

    // 1. Create contract (draft)
    const { data: contractData, error: contractErr } = await supabase
      .from('financial_contracts')
      .insert({
        student_id: studentId,
        plan_id: selectedPlanId,
        school_year: currentYear,
        status: 'draft',
        created_by: profile?.id ?? null,
      })
      .select('id')
      .single();

    if (contractErr || !contractData?.id) {
      setError(
        contractErr?.message?.includes('unique')
          ? 'Já existe um contrato para este aluno neste ano letivo.'
          : `Erro ao criar contrato: ${contractErr?.message ?? 'desconhecido'}`,
      );
      setSaving(false);
      return;
    }

    const contractId = contractData.id as string;

    // 2. Optionally activate + generate installments
    if (activateNow) {
      const { error: activateErr } = await supabase
        .from('financial_contracts')
        .update({ status: 'active', activated_at: new Date().toISOString() })
        .eq('id', contractId);

      if (!activateErr) {
        const { error: genErr } = await supabase.rpc('generate_installments_for_contract', {
          p_contract_id: contractId,
        });
        if (genErr) {
          console.warn('[EnrollmentContractWizard] Installments generation failed:', genErr);
        }
      }
    }

    await logAudit({
      action: 'create',
      module: 'financial_contracts',
      recordId: contractId,
      description: `Contrato criado para ${studentName} (${enrollmentNumber}) via wizard de confirmação${activateNow ? ' — ativado imediatamente' : ''}`,
      newData: { student_id: studentId, plan_id: selectedPlanId, activated: activateNow },
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => onClose(), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-5">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <PartyPopper className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-emerald-100">
                Matrícula Confirmada!
              </p>
              <h2 className="text-lg font-bold text-white leading-tight">{studentName}</h2>
              <p className="text-[11px] text-emerald-200 mt-0.5">
                Matrícula {enrollmentNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {saved ? (
            // ── Success state ──────────────────────────────────────────────
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 text-center">
                Contrato criado{activateNow ? ' e ativado' : ''}!
              </p>
              {activateNow && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Parcelas geradas automaticamente. Acesse Financeiro → Contratos para visualizar.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Plan selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Plano Financeiro *
                </label>
                {loadingPlans ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : plans.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">
                    Nenhum plano ativo encontrado. Crie um plano em Financeiro → Planos antes de continuar.
                  </p>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-emerald-500 appearance-none pr-9"
                    >
                      <option value="">Selecione um plano...</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.school_year ? ` (${p.school_year})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Plan details preview */}
              {selectedPlan && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">
                    <span className="font-semibold">
                      {selectedPlan.installments}x de{' '}
                      {(selectedPlan.amount / selectedPlan.installments).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                    {' · '}
                    Total {selectedPlan.amount.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                    {selectedPlan.due_day ? ` · Venc. dia ${selectedPlan.due_day}` : ''}
                  </div>
                </div>
              )}

              {/* Activate now toggle */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                      Ativar e gerar parcelas agora
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Cria as parcelas automaticamente. Pode ser feito depois.
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={activateNow}
                  onChange={setActivateNow}
                  onColor="bg-amber-500"
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!saved && (
          <div className="px-5 pb-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Fazer depois
            </button>
            <button
              type="button"
              disabled={!selectedPlanId || saving || plans.length === 0}
              onClick={handleCreate}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                saving
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Criando…</>
              ) : (
                <><GraduationCap className="w-4 h-4" />Criar Contrato</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
