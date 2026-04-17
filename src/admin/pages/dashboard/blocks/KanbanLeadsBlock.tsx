/**
 * KanbanLeadsBlock
 *
 * Mostra contagem de leads por estágio do funil. Visível para
 * usuários com `canView('kanban')`.
 */
import { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { BlockCard, BlockEmpty } from './BlockCard';

const STAGES: Array<{ key: string; label: string; color: string }> = [
  { key: 'new', label: 'Novos', color: 'bg-blue-500' },
  { key: 'first_contact', label: '1º contato', color: 'bg-indigo-500' },
  { key: 'follow_up', label: 'Follow-up', color: 'bg-purple-500' },
  { key: 'contacted', label: 'Contatado', color: 'bg-cyan-500' },
  { key: 'converted', label: 'Convertido', color: 'bg-emerald-500' },
];

export function KanbanLeadsBlock() {
  const { canView } = usePermissions();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView('kanban')) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from('contact_requests').select('status');
      if (!active) return;
      const map: Record<string, number> = {};
      ((data as Array<{ status: string }> | null) ?? []).forEach((r) => {
        map[r.status] = (map[r.status] ?? 0) + 1;
      });
      setCounts(map);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [canView]);

  if (!canView('kanban')) return null;

  const items = STAGES.map((s) => ({ ...s, value: counts[s.key] ?? 0 }));
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((acc, i) => acc + i.value, 0);

  return (
    <BlockCard title="Leads do Atendimento" icon={Filter} linkTo="/admin/leads/kanban" loading={loading}>
      {total === 0 ? (
        <BlockEmpty message="Nenhum lead no funil" />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <span className="w-24 text-xs text-right text-gray-500 dark:text-gray-400 truncate flex-shrink-0">{item.label}</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${item.color} transition-all duration-500`}
                  style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }}
                />
              </div>
              <span className="w-6 text-xs font-bold text-gray-700 dark:text-gray-300 text-right flex-shrink-0">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </BlockCard>
  );
}
