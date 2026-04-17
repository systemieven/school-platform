/**
 * FinancialOverviewBlock
 *
 * Visão financeira de alto nível: total a receber em aberto e
 * inadimplência (parcelas vencidas há mais de 1 dia, status
 * 'pendente'). Visível para usuários com `canView('financial')`.
 */
import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { BlockCard, StatRow } from './BlockCard';

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function FinancialOverviewBlock() {
  const { canView } = usePermissions();
  const [openAmount, setOpenAmount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('financial')) return;
    let active = true;
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const [openRes, overdueRes] = await Promise.all([
        supabase
          .from('financial_installments')
          .select('amount')
          .eq('status', 'pendente'),
        supabase
          .from('financial_installments')
          .select('amount')
          .eq('status', 'pendente')
          .lt('due_date', today),
      ]);
      if (!active) return;
      const openSum = ((openRes.data as Array<{ amount: number }> | null) ?? [])
        .reduce((a, r) => a + Number(r.amount ?? 0), 0);
      const overdueRows = (overdueRes.data as Array<{ amount: number }> | null) ?? [];
      const overdueSum = overdueRows.reduce((a, r) => a + Number(r.amount ?? 0), 0);
      setOpenAmount(openSum);
      setOverdueAmount(overdueSum);
      setOverdueCount(overdueRows.length);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView]);

  if (!canView('financial')) return null;

  return (
    <BlockCard title="Financeiro" icon={Wallet} linkTo="/admin/financeiro" loading={loading}>
      <StatRow label="A receber (em aberto)" value={fmtBRL(openAmount)} highlight />
      <StatRow label="Inadimplência" value={fmtBRL(overdueAmount)} />
      <StatRow label="Parcelas vencidas" value={overdueCount} />
    </BlockCard>
  );
}
