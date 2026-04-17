/**
 * AbsencesBlock
 *
 * Comunicações de falta da última semana, segmentadas por
 * status (pending vs justified). Visível para usuários com
 * `canView('absence-communications')`.
 */
import { useEffect, useState } from 'react';
import { UserX } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { BlockCard, StatRow } from './BlockCard';

export function AbsencesBlock() {
  const { canView } = usePermissions();
  const [pending, setPending] = useState(0);
  const [total7d, setTotal7d] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('absence-communications')) return;
    let active = true;
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

      const [pendingRes, totalRes] = await Promise.all([
        supabase
          .from('absence_communications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .gte('absence_date', sevenDaysAgo),
        supabase
          .from('absence_communications')
          .select('id', { count: 'exact', head: true })
          .gte('absence_date', sevenDaysAgo),
      ]);
      if (!active) return;
      setPending(pendingRes.count ?? 0);
      setTotal7d(totalRes.count ?? 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView]);

  if (!canView('absence-communications')) return null;

  return (
    <BlockCard title="Faltas (7 dias)" icon={UserX} linkTo="/admin/faltas" loading={loading}>
      <StatRow label="Pendentes de revisão" value={pending} highlight={pending > 0} />
      <StatRow label="Total no período" value={total7d} />
    </BlockCard>
  );
}
