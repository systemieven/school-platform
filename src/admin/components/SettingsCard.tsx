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
 *
 * Quando `collapseId` for fornecido o card vira recolhível, com estado
 * persistido em `localStorage` por id. O padrão é começar **recolhido** —
 * a primeira visita do usuário a uma aba mostra apenas as seções, e ele
 * abre apenas o que precisa. As escolhas dele ficam memorizadas.
 *
 * Quando `collapseId` não for informado o card mantém o comportamento
 * antigo (sempre expandido) — assim drawers e telas fora de
 * `/admin/configuracoes` que reusam o componente seguem inalterados.
 */
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

const COLLAPSE_KEY_PREFIX = 'settings.cardCollapsed.';

/**
 * Hook que retorna `[collapsed, toggle]` persistindo a escolha em
 * `localStorage`. Sem entrada salva o valor inicial é `true` (recolhido),
 * que é o estado padrão pedido para todas as abas de configuração.
 */
export function useCardCollapse(id: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = window.localStorage.getItem(COLLAPSE_KEY_PREFIX + id);
      if (saved === 'false') return false;
      if (saved === 'true')  return true;
    } catch { /* ignore storage errors */ }
    return true;
  });

  // Mantém sincronizado entre abas/janelas do mesmo usuário.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== COLLAPSE_KEY_PREFIX + id) return;
      if (e.newValue === 'false') setCollapsed(false);
      else if (e.newValue === 'true') setCollapsed(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [id]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(COLLAPSE_KEY_PREFIX + id, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, [id]);

  return [collapsed, toggle];
}

export interface SettingsCardProps {
  /** Section title — rendered uppercase with tracking */
  title: string;
  /** Optional subtitle rendered below the title in the header */
  description?: React.ReactNode;
  /** Optional Lucide icon displayed before the title */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional content rendered on the right side of the header (badges, buttons…) */
  headerExtra?: React.ReactNode;
  /** Card body content */
  children: React.ReactNode;
  /** Extra classes for the body div (e.g. `'space-y-5'` to override default `space-y-4`) */
  bodyClassName?: string;
  /**
   * Quando informado, o card vira recolhível e persiste o estado em
   * localStorage usando esse id. O default (sem id) é sempre expandido.
   */
  collapseId?: string;
}

export function SettingsCard({
  title,
  description,
  icon: Icon,
  headerExtra,
  children,
  bodyClassName,
  collapseId,
}: SettingsCardProps) {
  const collapsible = typeof collapseId === 'string' && collapseId.length > 0;
  // Hook é sempre chamado (regras dos hooks); quando não-recolhível usamos
  // um id sentinela e ignoramos o estado abaixo.
  const [collapsed, toggle] = useCardCollapse(collapsible ? collapseId : '__noop__');
  const isCollapsed = collapsible ? collapsed : false;

  const headInner = (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
        {title}
      </p>
      {description && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/60">
      {/* ── Header ── */}
      <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-4 flex items-center justify-between gap-3">
        {collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!isCollapsed}
            className="flex-1 min-w-0 flex items-start gap-2 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/40"
          >
            <ChevronDown
              className={`w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            />
            {headInner}
          </button>
        ) : (
          headInner
        )}
        {headerExtra && <div className="flex-shrink-0">{headerExtra}</div>}
      </div>

      {/* ── Body ── */}
      {!isCollapsed && (
        <div className={`bg-white dark:bg-gray-800/20 px-5 py-5 space-y-4${bodyClassName ? ` ${bodyClassName}` : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * CollapsibleSection
 *
 * Variante do `SettingsCard` desenhada para os painéis legados que ainda
 * usam diretamente os constants `CARD_CLS`/`HEAD_CLS`/`BODY_CLS` com
 * cabeçalhos de markup arbitrário (ícone inline, descrições com `<code>`,
 * etc.). Aceita `head` como ReactNode pré-construído para minimizar o
 * impacto da migração e mantém o mesmo comportamento de collapse com
 * persistência por id.
 */
export interface CollapsibleSectionProps {
  /** Id usado em localStorage para persistir o estado de collapse. */
  collapseId: string;
  /** Conteúdo já estilizado do cabeçalho (geralmente `<p className={TITLE_CLS}>…</p>` + descrição opcional). */
  head: React.ReactNode;
  /** Conteúdo opcional renderizado à direita do cabeçalho (botões, badges, etc.). Não dispara o toggle. */
  headerExtra?: React.ReactNode;
  /** Corpo do card. */
  children: React.ReactNode;
  /** Classes extras para o div do corpo (acrescentadas a `BODY_CLS`). */
  bodyClassName?: string;
}

export function CollapsibleSection({
  collapseId,
  head,
  headerExtra,
  children,
  bodyClassName,
}: CollapsibleSectionProps) {
  const [collapsed, toggle] = useCardCollapse(collapseId);
  return (
    <div className={CARD_CLS}>
      <div className={`${HEAD_CLS} flex items-center justify-between gap-3`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="flex-1 min-w-0 flex items-start gap-2 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#003876]/40"
        >
          <ChevronDown
            className={`w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
          <div className="min-w-0 flex-1">{head}</div>
        </button>
        {headerExtra && <div className="flex-shrink-0">{headerExtra}</div>}
      </div>
      {!collapsed && (
        <div className={`${BODY_CLS}${bodyClassName ? ` ${bodyClassName}` : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Module-level style constants — use these in places where JSX
 *  conversion to <SettingsCard> would be disruptive (large legacy panels). */
export const CARD_CLS   = 'rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/60';
export const HEAD_CLS   = 'bg-gray-50 dark:bg-gray-900/40 px-5 py-4';
export const BODY_CLS   = 'bg-white dark:bg-gray-800/20 px-5 py-5 space-y-4';
export const TITLE_CLS  = 'text-xs font-semibold tracking-[0.12em] uppercase text-gray-400';
