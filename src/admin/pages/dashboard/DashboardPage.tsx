/**
 * DashboardPage
 *
 * Página única do painel `/admin`, dirigida pelo registry de widgets
 * (`./registry.tsx`). Funciona para qualquer role — o gating acontece
 * por módulo via `has_module_permission` (super_admin passa por bypass).
 *
 * Fluxo:
 *   1. Filtra widgets por (requireRole? AND anyModuleKeys matches canView)
 *   2. Dispara `Promise.all` nos `load()` dos visíveis (queries gated
 *      nunca rodam para quem não verá)
 *   3. Renderiza por slot: KPIs → Charts → Listas → Wide
 *
 * Adicionar widgets novos = 1 entrada em DASHBOARD_WIDGETS. Sem dispatch,
 * sem split por role, sem duplicação.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';

import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import { DashboardHeader, AiInsightsWidget } from './widgets';
import type { Period } from './widgets';
import type { Profile } from '../../types/admin.types';
import { DASHBOARD_WIDGETS, type DashboardWidget, type LoadCtx } from './registry';
import { ROLE_LABELS } from './widgets/constants';

export default function DashboardPage() {
  const { profile, hasRole } = useAdminAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const [period, setPeriod] = useState<Period>('7d');
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  // ── Quais widgets o usuário enxerga? ─────────────────────────────────────
  const visibleWidgets: DashboardWidget[] = useMemo(() => {
    if (!profile) return [];
    return DASHBOARD_WIDGETS.filter((w) => {
      if (w.requireRole && !hasRole(...w.requireRole)) return false;
      return w.anyModuleKeys.some((k) => canView(k));
    });
  }, [profile, canView, hasRole]);

  // ── Fetch em paralelo, apenas dos visíveis ──────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const ctx: LoadCtx = {
      profile: { id: profile.id, role: profile.role },
      period,
      hasRole,
    };
    const pairs = await Promise.all(
      visibleWidgets.map(async (w) => {
        try {
          return [w.id, await w.load(ctx)] as const;
        } catch (err) {
          console.error(`[dashboard] widget ${w.id} failed`, err);
          return [w.id, null] as const;
        }
      }),
    );
    setResults(Object.fromEntries(pairs));
    setLoading(false);
  }, [profile, period, visibleWidgets, hasRole]);

  useEffect(() => {
    if (permsLoading) return;
    fetchAll();
  }, [permsLoading, fetchAll]);

  if (permsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
      </div>
    );
  }

  const ctx: LoadCtx = {
    profile: { id: profile?.id ?? '', role: (profile?.role ?? 'user') as Profile['role'] },
    period,
    hasRole,
  };

  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] ?? null : null;
  const description = roleLabel
    ? `Resumo do que você acompanha como ${roleLabel}.`
    : 'Resumo dos seus módulos.';

  const bySlot = (slot: DashboardWidget['slot']) =>
    visibleWidgets
      .filter((w) => w.slot === slot)
      .sort((a, b) => a.order - b.order);

  const kpis = bySlot('kpi');
  const charts = bySlot('chart');
  const lists = bySlot('list');
  const wide = bySlot('wide');

  const statColsClass =
    kpis.length >= 4 ? 'lg:grid-cols-4'
    : kpis.length === 3 ? 'lg:grid-cols-3'
    : kpis.length === 2 ? 'lg:grid-cols-2'
    : 'lg:grid-cols-1';

  // AI insights é um painel especial restrito a super_admin (usa todas as
  // métricas carregadas); mantido fora do registry porque depende dos
  // resultados agregados dos demais widgets.
  const showAi = hasRole('super_admin');

  return (
    <div>
      <DashboardHeader
        fullName={profile?.full_name ?? null}
        fallbackName={profile?.email?.split('@')[0] ?? null}
        description={description}
        period={period}
        onPeriodChange={setPeriod}
      />

      {visibleWidgets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700/40 flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">
            Nenhum bloco para exibir
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md mx-auto">
            Você ainda não tem acesso a nenhum dos módulos exibidos neste dashboard.
            Solicite ao administrador do sistema o acesso aos módulos que você utiliza.
          </p>
          <Link
            to="/admin/configuracoes"
            className="inline-flex items-center gap-1 mt-4 text-xs font-medium text-brand-primary dark:text-brand-secondary hover:underline"
          >
            Ir para Configurações
          </Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : (
        <>
          {kpis.length > 0 && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${statColsClass} gap-4 mb-6`}>
              {kpis.map((w) => (
                <div key={w.id}>{w.Render({ data: results[w.id], ctx })}</div>
              ))}
            </div>
          )}

          {charts.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-4 mb-4">
              {charts.map((w) => (
                <div key={w.id}>{w.Render({ data: results[w.id], ctx })}</div>
              ))}
            </div>
          )}

          {lists.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-4 mb-4">
              {lists.map((w) => (
                <div key={w.id}>{w.Render({ data: results[w.id], ctx })}</div>
              ))}
            </div>
          )}

          {wide.length > 0 && (
            <div className="space-y-4">
              {wide.map((w) => (
                <div key={w.id}>{w.Render({ data: results[w.id], ctx })}</div>
              ))}
            </div>
          )}

          {showAi && (
            <div className="mt-4">
              <AiInsightsWidget
                metrics={{
                  period,
                  visible_widgets: visibleWidgets.map((w) => w.id),
                  ...results,
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
