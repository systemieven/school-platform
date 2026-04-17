/**
 * StoreOrdersBlock
 *
 * Resumo da loja virtual: pedidos aguardando pagamento e pedidos
 * em separação. Visível para usuários com `canView('store-orders')`.
 */
import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { BlockCard, StatRow } from './BlockCard';

export function StoreOrdersBlock() {
  const { canView } = usePermissions();
  const [pendingPayment, setPendingPayment] = useState(0);
  const [preparing, setPreparing] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('store-orders')) return;
    let active = true;
    (async () => {
      const [pendRes, prepRes] = await Promise.all([
        supabase
          .from('store_orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_payment'),
        supabase
          .from('store_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['paid', 'preparing', 'ready']),
      ]);
      if (!active) return;
      setPendingPayment(pendRes.count ?? 0);
      setPreparing(prepRes.count ?? 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView]);

  if (!canView('store-orders')) return null;

  return (
    <BlockCard title="Loja virtual" icon={ShoppingBag} linkTo="/admin/loja" loading={loading}>
      <StatRow label="Aguardando pagamento" value={pendingPayment} highlight={pendingPayment > 0} />
      <StatRow label="Em separação / prontos" value={preparing} />
    </BlockCard>
  );
}
