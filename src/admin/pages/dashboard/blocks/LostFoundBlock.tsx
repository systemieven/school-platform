/**
 * LostFoundBlock
 *
 * Itens cadastrados em "Achados e Perdidos" não reclamados.
 * Visível para usuários com `canView('lost-found')`.
 */
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { BlockCard, StatRow } from './BlockCard';

export function LostFoundBlock() {
  const { canView } = usePermissions();
  const [available, setAvailable] = useState(0);
  const [thisWeek, setThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('lost-found')) return;
    let active = true;
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [availRes, weekRes] = await Promise.all([
        supabase
          .from('lost_found_items')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'available'),
        supabase
          .from('lost_found_items')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', sevenDaysAgo),
      ]);
      if (!active) return;
      setAvailable(availRes.count ?? 0);
      setThisWeek(weekRes.count ?? 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView]);

  if (!canView('lost-found')) return null;

  return (
    <BlockCard title="Achados e Perdidos" icon={Search} linkTo="/admin/achados-perdidos" loading={loading}>
      <StatRow label="Aguardando dono" value={available} highlight={available > 0} />
      <StatRow label="Cadastrados (7 dias)" value={thisWeek} />
    </BlockCard>
  );
}
