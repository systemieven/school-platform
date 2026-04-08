/**
 * SettingsCard
 *
 * Canonical two-tone card component for every section inside
 * the /admin/configuracoes (settings) routes.
 *
 * Structure:
 *   ┌─ rounded-2xl border ─────────────────────────┐
 *   │ header  bg-gray-50   title [+ description]   │
 *   ├──────────────────────────────────────────────│
 *   │ body    bg-white     children                │
 *   └──────────────────────────────────────────────┘
 */

export interface SettingsCardProps {
  /** Section title — rendered uppercase with tracking */
  title: string;
  /** Optional subtitle rendered below the title in the header */
  description?: string;
  /** Optional Lucide icon displayed before the title */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional content rendered on the right side of the header (badges, buttons…) */
  headerExtra?: React.ReactNode;
  /** Card body content */
  children: React.ReactNode;
  /** Extra classes for the body div (e.g. `'space-y-5'` to override default `space-y-4`) */
  bodyClassName?: string;
}

export function SettingsCard({
  title,
  description,
  icon: Icon,
  headerExtra,
  children,
  bodyClassName,
}: SettingsCardProps) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/60">
      {/* ── Header ── */}
      <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
            {title}
          </p>
          {description && (
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          )}
        </div>
        {headerExtra && <div className="flex-shrink-0">{headerExtra}</div>}
      </div>

      {/* ── Body ── */}
      <div className={`bg-white dark:bg-gray-800/20 px-5 py-5 space-y-4${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        {children}
      </div>
    </div>
  );
}

/** Module-level style constants — use these in places where JSX
 *  conversion to <SettingsCard> would be disruptive (large legacy panels). */
export const CARD_CLS   = 'rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/60';
export const HEAD_CLS   = 'bg-gray-50 dark:bg-gray-900/40 px-5 py-4';
export const BODY_CLS   = 'bg-white dark:bg-gray-800/20 px-5 py-5 space-y-4';
export const TITLE_CLS  = 'text-xs font-semibold tracking-[0.12em] uppercase text-gray-400';
