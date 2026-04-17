/**
 * AppointmentsBlock
 *
 * Bloco do SharedDashboard que mostra próximos agendamentos
 * (data ≥ hoje, status pending|confirmed) e o total pendente.
 * Visível para usuários com `canView('appointments')`.
 */
import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { BlockCard, StatRow, BlockEmpty } from './BlockCard';

interface UpcomingAppt {
  id: string;
  visitor_name: string;
  appointment_date: string;
  appointment_time: string;
}

export function AppointmentsBlock() {
  const { canView } = usePermissions();
  const [pending, setPending] = useState<number>(0);
  const [next, setNext] = useState<UpcomingAppt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('appointments')) return;
    let active = true;
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const [pendingRes, nextRes] = await Promise.all([
        supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('visit_appointments')
          .select('id,visitor_name,appointment_date,appointment_time')
          .gte('appointment_date', today)
          .in('status', ['pending', 'confirmed'])
          .order('appointment_date')
          .order('appointment_time')
          .limit(4),
      ]);
      if (!active) return;
      setPending(pendingRes.count ?? 0);
      setNext((nextRes.data as UpcomingAppt[] | null) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView]);

  if (!canView('appointments')) return null;

  return (
    <BlockCard title="Agendamentos" icon={CalendarCheck} linkTo="/admin/gestao" loading={loading}>
      <StatRow label="Pendentes de confirmação" value={pending} highlight={pending > 0} />
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Próximas visitas</p>
        {next.length === 0 ? (
          <BlockEmpty message="Nenhum agendamento futuro" />
        ) : (
          <ul className="space-y-1.5">
            {next.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">{a.visitor_name}</span>
                <span className="text-gray-400 ml-2 flex-shrink-0">
                  {a.appointment_date.slice(5).replace('-', '/')} {a.appointment_time.slice(0, 5)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BlockCard>
  );
}
