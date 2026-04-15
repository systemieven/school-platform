/**
 * DashboardChartGrid
 *
 * Painel de graficos personalizaveis reutilizavel.
 * Usado em FinancialDashboardPage e AcademicoDashboardPage.
 * Carrega widgets do banco, renderiza ChartWidget e abre ChartBuilderDrawer.
 */
import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ChartWidget from './ChartWidget';
import ChartBuilderDrawer from './ChartBuilderDrawer';
import type { DashboardWidget, DashboardModule } from '../types/admin.types';

interface DashboardChartGridProps {
  module: DashboardModule;
}

export default function DashboardChartGrid({ module }: DashboardChartGridProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('module', module)
      .eq('is_visible', true)
      .order('position');
    setWidgets((data ?? []) as DashboardWidget[]);
    setLoading(false);
  }, [module]);

  useEffect(() => { void load(); }, [load]);

  function openNew() {
    setEditingWidget(null);
    setDrawerOpen(true);
  }

  function openEdit(w: DashboardWidget) {
    setEditingWidget(w);
    setDrawerOpen(true);
  }

  async function handleDelete(id: string) {
    await supabase.from('dashboard_widgets').delete().eq('id', id);
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  function handleSaved(saved: DashboardWidget) {
    setWidgets((prev) => {
      const idx = prev.findIndex((w) => w.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">Gráficos</h3>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                     bg-brand-primary text-white rounded-xl hover:bg-brand-primary-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar gráfico
        </button>
      </div>

      {/* Skeleton loading */}
      {loading && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[280px] bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
          <LayoutDashboard className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhum gráfico adicionado</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
            Clique em "+ Adicionar gráfico" para começar
          </p>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold
                       bg-brand-primary text-white rounded-xl hover:bg-brand-primary-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar gráfico
          </button>
        </div>
      )}

      {/* Widget grid */}
      {!loading && widgets.length > 0 && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((w) => (
            <ChartWidget
              key={w.id}
              widget={w}
              onEdit={() => openEdit(w)}
              onDelete={() => handleDelete(w.id)}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      <ChartBuilderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        module={module}
        widget={editingWidget}
        onSaved={handleSaved}
      />
    </div>
  );
}
