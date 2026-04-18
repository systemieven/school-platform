import type { LucideIcon } from 'lucide-react';

/**
 * KpiCard — card de métrica padrão dos dashboards admin.
 *
 * Encapsula o shape hoje duplicado em FinancialDashboardPage e
 * AcademicoDashboardPage. Classes de cor (`bg-${color}-50` /
 * `text-${color}-500`) são dinâmicas — já existem geradas porque
 * AcademicoDashboardPage usa a mesma técnica com strings literais
 * para cada cor. Se introduzir tom novo, garantir safelist no
 * tailwind.config ou incluir a string literal em algum componente.
 */
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  /** Tailwind color name: emerald | blue | red | amber | purple | gray | orange */
  color: string;
}

export default function KpiCard({ label, value, sub, icon: Icon, color }: KpiCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">
          {label}
        </span>
        <div className={`p-2 rounded-xl bg-${color}-50 dark:bg-${color}-900/20`}>
          <Icon className={`w-4 h-4 text-${color}-500`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
