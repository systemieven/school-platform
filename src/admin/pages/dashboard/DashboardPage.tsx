/**
 * DashboardPage
 *
 * Página única do painel `/admin`, dirigida pelo registry de widgets
 * (`./registry.tsx`) e personalizável via `dashboard_widget_prefs`
 * (visibilidade/ordem dos widgets do registry) + `dashboard_widgets`
 * com `module='principal'` (gráficos custom — mesma infra dos
 * dashboards Financeiro e Acadêmico).
 *
 * Fluxo:
 *   1. Carrega prefs (admin pode esconder/reordenar via drawer).
 *   2. Filtra registry por (requireRole? AND anyModuleKeys matches canView)
 *      e aplica prefs (is_visible/position).
 *   3. Dispara `Promise.all` nos `load()` dos visíveis.
 *   4. Renderiza por slot: KPIs → Charts → Listas → Wide.
 *   5. Mostra `DashboardChartGrid module="principal"` para gráficos custom.
 *
 * Adicionar widgets novos = 1 entrada em DASHBOARD_WIDGETS + (opcional)
 * label em WIDGET_LABELS.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Sliders } from 'lucide-react';

import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import { supabase } from '../../../lib/supabase';
import { DashboardHeader, AiInsightsWidget } from './widgets';
import type { Period } from './widgets';
import type { Profile, DashboardWidgetPref } from '../../types/admin.types';
import { DASHBOARD_WIDGETS, WIDGET_LABELS, type DashboardWidget, type LoadCtx } from './registry';
import { ROLE_LABELS } from './widgets/constants';
import DashboardChartGrid from '../../components/DashboardChartGrid';
import DashboardWidgetPrefsDrawer, { type RegistryWidgetMeta } from '../../components/DashboardWidgetPrefsDrawer';

export default function DashboardPage() {
  const { profile, hasRole } = useAdminAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const [period, setPeriod] = useState<Period>('7d');
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<DashboardWidgetPref[]>([]);
  const [prefsDrawerOpen, setPrefsDrawerOpen] = useState(false);

  const isAdmin = hasRole('admin', 'super_admin');

  // ── Carrega prefs do registry (visibilidade/ordem) ──────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('dashboard_widget_prefs')
        .select('*')
        .eq('module', 'principal');
      if (alive && data) setPrefs(data as DashboardWidgetPref[]);
    })();
    return () => { alive = false; };
  }, []);

  const prefsByWidget = useMemo(() => {
    const m: Record<string, DashboardWidgetPref> = {};
    prefs.forEach((p) => { m[p.registry_widget_id] = p; });
    return m;
  }, [prefs]);

  // ── Quais widgets o usuário enxerga? ─────────────────────────────────────
  const visibleWidgets: DashboardWidget[] = useMemo(() => {
    if (!profile) return [];
    return DASHBOARD_WIDGETS.filter((w) => {
      if (w.requireRole && !hasRole(...w.requireRole)) return false;
      if (!w.anyModuleKeys.some((k) => canView(k))) return false;
      // Pref override: se existir pref e is_visible=false, esconde.
      const pref = prefsByWidget[w.id];
      if (pref && !pref.is_visible) return false;
      return true;
    });
  }, [profile, canView, hasRole, prefsByWidget]);

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

  // Ordena por pref.position se existir, senão por w.order.
  const orderOf = (w: DashboardWidget) => {
    const p = prefsByWidget[w.id];
    return p ? p.position : w.order;
  };

  const bySlot = (slot: DashboardWidget['slot']) =>
    visibleWidgets
      .filter((w) => w.slot === slot)
      // Pula widgets cujo load() retornou null (erro/sem permissão fina) —
      // evita crash em Render({ data: null }) sem precisar de guard em cada widget.
      .filter((w) => results[w.id] != null)
      .sort((a, b) => orderOf(a) - orderOf(b));

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

  // Lista de widgets do registry que o usuário atual poderia ver (passou no
  // gate de role + módulo) — base do drawer "Personalizar".
  const registryForPrefs: RegistryWidgetMeta[] = DASHBOARD_WIDGETS
    .filter((w) => {
      if (w.requireRole && !hasRole(...w.requireRole)) return false;
      return w.anyModuleKeys.some((k) => canView(k));
    })
    .map((w) => ({
      id: w.id,
      label: w.label ?? WIDGET_LABELS[w.id] ?? w.id,
      slot: w.slot,
    }));

  return (
    <div>
      <DashboardHeader
        fullName={profile?.full_name ?? null}
        fallbackName={profile?.email?.split('@')[0] ?? null}
        description={description}
        period={period}
        onPeriodChange={setPeriod}
        actionSlot={isAdmin ? (
          <button
            onClick={() => setPrefsDrawerOpen(true)}
            className="btn-matricula-nav hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold
                       bg-brand-primary text-brand-secondary rounded-xl shadow-sm
                       hover:bg-brand-primary-dark transition-colors"
            title="Mostrar/ocultar e reordenar widgets"
          >
            <Sliders className="w-4 h-4" /> Personalizar
          </button>
        ) : null}
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

          {/* Gráficos personalizados (mesmo padrão dos dashboards Financeiro/Acadêmico). */}
          {isAdmin && (
            <div className="mt-8">
              <DashboardChartGrid module="principal" />
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

      {isAdmin && (
        <DashboardWidgetPrefsDrawer
          open={prefsDrawerOpen}
          onClose={() => setPrefsDrawerOpen(false)}
          module="principal"
          registry={registryForPrefs}
          prefsByWidget={prefsByWidget}
          onSaved={(next) => setPrefs(next)}
        />
      )}
    </div>
  );
}
