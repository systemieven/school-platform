/**
 * WaStatsWidget
 *
 * Painel 2x2 com métricas do WhatsApp: enviadas, entregues, lidas
 * e falhas. Cada quadrante tem cor própria e ícone Lucide.
 */
import { Link } from 'react-router-dom';
import { ChevronRight, AlertCircle, CheckCircle2, Send, Eye } from 'lucide-react';

export interface WaStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface WaStatsWidgetProps {
  stats: WaStats;
  /** Link "Ver histórico". Default: /admin/configuracoes. */
  linkTo?: string;
  title?: string;
}

export function WaStatsWidget({
  stats,
  linkTo = '/admin/configuracoes',
  title = 'Mensagens WhatsApp',
}: WaStatsWidgetProps) {
  const items = [
    { label: 'Enviadas', value: stats.sent, icon: Send, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Entregues', value: stats.delivered, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Lidas', value: stats.read, icon: Eye, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Falhas', value: stats.failed, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">{title}</h3>
        <Link
          to={linkTo}
          className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1"
        >
          Ver histórico <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`flex items-center gap-2.5 rounded-xl p-3 ${item.bg}`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-white leading-none">{item.value}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
