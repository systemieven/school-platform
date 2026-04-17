/**
 * OccurrencesBlock
 *
 * Ocorrências registradas nos últimos 7 dias, segmentadas por
 * severidade (críticas vs total). Visível para usuários com
 * `canView('occurrences')`.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { BlockCard, StatRow } from './BlockCard';

export function OccurrencesBlock() {
  const { canView } = usePermissions();
  const [critical, setCritical] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('occurrences')) return;
    let active = true;
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [critRes, totRes] = await Promise.all([
        supabase
          .from('student_occurrences')
          .select('id', { count: 'exact', head: true })
          .in('severity', ['high', 'critical'])
          .gte('created_at', sevenDaysAgo),
        supabase
          .from('student_occurrences')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', sevenDaysAgo),
      ]);
      if (!active) return;
      setCritical(critRes.count ?? 0);
      setTotal(totRes.count ?? 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView]);

  if (!canView('occurrences')) return null;

  return (
    <BlockCard title="Ocorrências (7 dias)" icon={AlertTriangle} linkTo="/admin/ocorrencias" loading={loading}>
      <StatRow label="Severidade alta/crítica" value={critical} highlight={critical > 0} />
      <StatRow label="Total no período" value={total} />
    </BlockCard>
  );
}
