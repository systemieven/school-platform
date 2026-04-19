/**
 * DashboardHeader
 *
 * Header compartilhado entre o DashboardPage (super_admin) e o
 * SharedDashboard (demais roles): saudação por horário ("Bom dia,
 * Iftá-El") + descrição + seletor de período (Hoje / 7 dias / 30 dias).
 *
 * Manter aqui garante visual consistente entre os dois dashboards.
 */
import { useMemo, type ReactNode } from 'react';

export type Period = 'today' | '7d' | '30d';

const PERIOD_OPTS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
];

function buildGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export interface DashboardHeaderProps {
  /** Nome completo do usuário (vamos extrair o primeiro nome). */
  fullName: string | null | undefined;
  /** Fallback amigável se `fullName` for nulo/vazio (ex.: prefixo do e-mail). */
  fallbackName?: string | null;
  /** Texto da linha 2 (ex.: "Aqui está o resumo do seu painel."). */
  description?: string;
  /** Período atualmente selecionado. */
  period: Period;
  /** Callback ao trocar o período. Quando ausente, o seletor não é renderizado. */
  onPeriodChange?: (p: Period) => void;
  /** Slot opcional renderizado à direita do seletor de período (ex.: botão Personalizar). */
  actionSlot?: ReactNode;
}

export function DashboardHeader({
  fullName,
  fallbackName,
  description = 'Aqui está o resumo do seu painel.',
  period,
  onPeriodChange,
  actionSlot,
}: DashboardHeaderProps) {
  const greeting = useMemo(buildGreeting, []);

  const firstName = (() => {
    const fn = fullName?.trim();
    if (fn) return fn.split(/\s+/)[0];
    return fallbackName?.trim() || null;
  })();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-primary dark:text-white">
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>

      {(onPeriodChange || actionSlot) && (
        <div className="flex items-center gap-2">
          {onPeriodChange && (
            <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 gap-1">
              {PERIOD_OPTS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onPeriodChange(opt.key)}
                  className={`px-4 py-1.5 text-sm font-medium transition-all ${
                    period === opt.key
                      ? 'rounded-full bg-brand-primary text-brand-secondary border border-brand-primary shadow-sm'
                      : 'rounded-lg border border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {actionSlot}
        </div>
      )}
    </div>
  );
}

/** Util público para outros widgets que precisam saber o tamanho do periodo. */
export function periodDays(p: Period): number {
  return p === 'today' ? 1 : p === '7d' ? 7 : 30;
}

/** ISO timestamp do início do período (com offset opcional para "período anterior"). */
export function periodStart(days: number, offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days - offset);
  if (days === 1) d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Comparação % entre periodos. Retorna 0 quando prev === 0 e current === 0. */
export function pctChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}
