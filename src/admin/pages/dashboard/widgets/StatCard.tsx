/**
 * StatCard
 *
 * Card numérico grande com ícone colorido, número de destaque,
 * label e (opcionalmente) indicador de tendência vs período anterior.
 * Reutilizado pelo DashboardPage do super_admin e pelo SharedDashboard.
 */
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { pctChange } from './DashboardHeader';

export interface StatCardProps {
  label: string;
  value: number;
  /** Valor do período anterior, para cálculo de tendência %. Omita para esconder o indicador. */
  prev?: number;
  icon: React.ComponentType<{ className?: string }>;
  /** Classe Tailwind para a cor do ícone (ex.: `text-blue-600`). */
  colorClass: string;
  /** Classe Tailwind para o background do quadrado do ícone (ex.: `bg-blue-100 dark:bg-blue-900/30`). */
  iconBg: string;
  linkTo: string;
  /** Mostra um pequeno texto à direita do ícone, no lugar da tendência (ex.: "Visitas"). */
  rightLabel?: string;
}

export function StatCard({
  label,
  value,
  prev,
  icon: Icon,
  colorClass,
  iconBg,
  linkTo,
  rightLabel,
}: StatCardProps) {
  const showTrend = typeof prev === 'number' && !rightLabel;
  const change = showTrend ? pctChange(value, prev as number) : 0;

  return (
    <Link
      to={linkTo}
      className="block bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>

        {rightLabel ? (
          <span className="text-xs text-gray-400">{rightLabel}</span>
        ) : showTrend ? (
          <div
            className={`flex items-center gap-1 text-xs font-semibold ${
              change > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : change < 0
                ? 'text-red-500 dark:text-red-400'
                : 'text-gray-400'
            }`}
          >
            {change > 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : change < 0 ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            {(prev as number) > 0 ? `${Math.abs(change)}%` : '—'}
          </div>
        ) : null}
      </div>
      <p className="text-3xl font-bold text-gray-800 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 group-hover:text-brand-primary dark:group-hover:text-brand-secondary transition-colors">
        {label}
      </p>
    </Link>
  );
}
