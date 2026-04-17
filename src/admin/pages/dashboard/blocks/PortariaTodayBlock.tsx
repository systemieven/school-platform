/**
 * PortariaTodayBlock
 *
 * Resumo do dia da portaria: saídas autorizadas para hoje +
 * comunicações de falta do dia. Visível para usuários com
 * `canView('portaria')`.
 */
import { useEffect, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { BlockCard, StatRow } from './BlockCard';

export function PortariaTodayBlock() {
  const { canView } = usePermissions();
  const [exitsAuth, setExitsAuth] = useState(0);
  const [absences, setAbsences] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('portaria')) return;
    let active = true;
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const [exitsRes, absRes] = await Promise.all([
        supabase
          .from('exit_authorizations')
          .select('id', { count: 'exact', head: true })
          .eq('exit_date', today)
          .in('status', ['authorized', 'pending']),
        supabase
          .from('absence_communications')
          .select('id', { count: 'exact', head: true })
          .eq('absence_date', today),
      ]);
      if (!active) return;
      setExitsAuth(exitsRes.count ?? 0);
      setAbsences(absRes.count ?? 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView]);

  if (!canView('portaria')) return null;

  return (
    <BlockCard title="Portaria — hoje" icon={DoorOpen} linkTo="/admin/portaria" loading={loading}>
      <StatRow label="Saídas previstas" value={exitsAuth} highlight />
      <StatRow label="Faltas comunicadas" value={absences} />
    </BlockCard>
  );
}
