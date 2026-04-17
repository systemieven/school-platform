/**
 * BarChart
 *
 * Gráfico de barras horizontais simples (sem dependência externa)
 * mostrando a distribuição de uma métrica por categoria. Largura
 * de cada barra é proporcional ao maior valor do conjunto.
 */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface GroupCount {
  label: string;
  value: number;
  /** Classe Tailwind para a cor da barra (ex.: `bg-blue-500`). */
  color: string;
}

export interface BarChartProps {
  title: string;
  items: GroupCount[];
  emptyLabel: string;
  /** Quando informado, renderiza link "Ver todos →" no header. */
  linkTo?: string;
  linkLabel?: string;
}

export function BarChart({
  title,
  items,
  emptyLabel,
  linkTo,
  linkLabel = 'Ver todos',
}: BarChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const visibleItems = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">{title}</h3>
        {linkTo && (
          <Link
            to={linkTo}
            className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1"
          >
            {linkLabel} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">
          {visibleItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-28 text-xs text-right text-gray-500 dark:text-gray-400 truncate flex-shrink-0">
                {item.label}
              </span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${item.color} transition-all duration-500`}
                  style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }}
                />
              </div>
              <span className="w-6 text-xs font-bold text-gray-700 dark:text-gray-300 text-right flex-shrink-0">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
