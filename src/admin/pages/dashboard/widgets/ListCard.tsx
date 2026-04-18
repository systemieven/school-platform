/**
 * ListCard
 *
 * Container genérico para widgets do tipo "top-N lista" (inadimplência,
 * alertas de frequência, ocorrências recentes, etc.). Cabeçalho com
 * ícone + título + CTA opcional, empty-state embutido e slot para a
 * lista. Mantém visual consistente com BarChart/WaStatsWidget.
 */
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight, type LucideIcon } from 'lucide-react';

export interface ListCardProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string; // tailwind text-*
  iconBg?: string;    // tailwind bg-*
  linkTo?: string;
  linkLabel?: string;
  emptyLabel?: string;
  isEmpty?: boolean;
  children?: React.ReactNode;
}

export function ListCard({
  title,
  icon: Icon,
  iconColor = 'text-brand-primary dark:text-brand-secondary',
  iconBg = 'bg-brand-primary/10 dark:bg-white/10',
  linkTo,
  linkLabel = 'Ver tudo',
  emptyLabel = 'Sem dados para exibir',
  isEmpty,
  children,
}: ListCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">
            {title}
          </h3>
        </div>
        {linkTo && (
          <Link
            to={linkTo}
            className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1"
          >
            {linkLabel} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {isEmpty ? (
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">{emptyLabel}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
