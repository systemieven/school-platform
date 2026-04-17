/**
 * BlockCard
 *
 * Wrapper visual reutilizado por todos os blocos do SharedDashboard.
 * Mantém aparência consistente com o DashboardPage do super_admin
 * (fundo branco, borda sutil, hover-shadow, header com título + link
 * "ver mais" opcional). Cada bloco específico só precisa cuidar do
 * conteúdo do `children`.
 */
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';

interface BlockCardProps {
  title: string;
  /** Ícone Lucide do módulo, exibido à esquerda do título (mesma cor do brand-primary). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Quando informado, renderiza um link "Ver mais →" no canto direito do header. */
  linkTo?: string;
  linkLabel?: string;
  loading?: boolean;
  /** Mensagem renderizada quando `loading=false` e `children` decide mostrar empty state. */
  children: React.ReactNode;
  /** Span do bloco no grid (default 1). Use 2 para blocos largos. */
  span?: 1 | 2;
}

export function BlockCard({
  title,
  icon: Icon,
  linkTo,
  linkLabel = 'Ver mais',
  loading = false,
  children,
  span = 1,
}: BlockCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200 ${
        span === 2 ? 'md:col-span-2' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-brand-primary dark:text-brand-secondary flex-shrink-0" />}
          <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white truncate">{title}</h3>
        </div>
        {linkTo && (
          <Link
            to={linkTo}
            className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1 flex-shrink-0"
          >
            {linkLabel} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Linha "label / valor" usada por blocos que mostram poucos KPIs verticalmente. */
export function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={`text-sm font-semibold ${
          highlight ? 'text-brand-primary dark:text-brand-secondary' : 'text-gray-800 dark:text-gray-200'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** Card grande com número grande no centro (usado em blocos com 1 KPI dominante). */
export function BigNumber({
  value,
  caption,
  tone = 'default',
}: {
  value: number | string;
  caption: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colorMap = {
    default: 'text-gray-800 dark:text-white',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
  } as const;
  return (
    <div className="text-center py-2">
      <p className={`text-3xl font-bold ${colorMap[tone]}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{caption}</p>
    </div>
  );
}

/** Mensagem de empty-state padronizada dentro de um BlockCard. */
export function BlockEmpty({ message }: { message: string }) {
  return <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">{message}</p>;
}
