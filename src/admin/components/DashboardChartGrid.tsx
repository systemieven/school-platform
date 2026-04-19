/**
 * DashboardChartGrid
 *
 * Painel de graficos personalizaveis reutilizavel.
 * Usado em FinancialDashboardPage e AcademicoDashboardPage.
 * Carrega widgets do banco, renderiza ChartWidget e abre ChartBuilderDrawer.
 *
 * Drag-and-drop: admin/super_admin reordena por handle no header de cada
 * card; UPSERT batch em `dashboard_widgets.position` (campo existente).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GripVertical, LayoutDashboard, Plus } from 'lucide-react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import ChartWidget from './ChartWidget';
import ChartBuilderDrawer from './ChartBuilderDrawer';
import { CHART_PREFIX } from './DashboardWidgetPrefsDrawer';
import type {
  DashboardWidget, DashboardModule, DashboardWidgetUserPref,
} from '../types/admin.types';

interface DashboardChartGridProps {
  module: DashboardModule;
}

export default function DashboardChartGrid({ module }: DashboardChartGridProps) {
  const { profile, hasRole } = useAdminAuth();
  const canReorder = hasRole('super_admin', 'admin');

  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [userPrefs, setUserPrefs] = useState<Record<string, DashboardWidgetUserPref>>({});
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [chartsRes, userPrefsRes] = await Promise.all([
      supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('module', module)
        .eq('is_visible', true)
        .order('position'),
      supabase
        .from('dashboard_widget_user_prefs')
        .select('*')
        .eq('user_id', profile.id)
        .eq('module', module)
        .like('registry_widget_id', `${CHART_PREFIX}%`),
    ]);
    setWidgets((chartsRes.data ?? []) as DashboardWidget[]);
    const map: Record<string, DashboardWidgetUserPref> = {};
    ((userPrefsRes.data ?? []) as DashboardWidgetUserPref[]).forEach((p) => {
      // chave = uuid do chart (sem prefixo) pra lookup direto.
      map[p.registry_widget_id.slice(CHART_PREFIX.length)] = p;
    });
    setUserPrefs(map);
    setLoading(false);
  }, [module, profile?.id]);

  useEffect(() => { void load(); }, [load]);

  // Aplica prefs per-user (visibilidade + ordem) sobre os charts globais.
  // Pref do usuario tem prioridade; sem pref, usa is_visible/position do banco.
  const visibleWidgets = useMemo(() => {
    return widgets
      .filter((w) => userPrefs[w.id]?.is_visible !== false)
      .map((w) => ({ w, pos: userPrefs[w.id]?.position ?? w.position }))
      .sort((a, b) => a.pos - b.pos)
      .map(({ w }) => w);
  }, [widgets, userPrefs]);

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

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    // Reordena sobre a lista visível (que pode estar filtrada/ordenada pelas
    // prefs do usuário) e propaga para a ordem global em dashboard_widgets.
    const oldIdx = visibleWidgets.findIndex((w) => w.id === active.id);
    const newIdx = visibleWidgets.findIndex((w) => w.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reorderedVisible = arrayMove(visibleWidgets, oldIdx, newIdx);

    // Reconstrói a lista completa preservando charts ocultos no fim.
    const visibleIds = new Set(reorderedVisible.map((w) => w.id));
    const hidden = widgets.filter((w) => !visibleIds.has(w.id));
    const next = [...reorderedVisible, ...hidden].map((w, i) => ({ ...w, position: i }));
    setWidgets(next);

    await supabase
      .from('dashboard_widgets')
      .upsert(
        next.map((w, i) => ({ id: w.id, position: i })),
        { onConflict: 'id' },
      );
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
      {!loading && visibleWidgets.length === 0 && (
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

      {/* Widget grid (com dnd para admin) */}
      {!loading && visibleWidgets.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visibleWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {visibleWidgets.map((w) => (
                <SortableChartCard
                  key={w.id}
                  widget={w}
                  canReorder={canReorder}
                  onEdit={() => openEdit(w)}
                  onDelete={() => handleDelete(w.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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

interface SortableChartCardProps {
  widget: DashboardWidget;
  canReorder: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableChartCard({ widget, canReorder, onEdit, onDelete }: SortableChartCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id, disabled: !canReorder });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const handle = canReorder ? (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-gray-300 hover:text-brand-primary touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded"
      title="Arrastar para reordenar"
      aria-label={`Reordenar ${widget.title}`}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  ) : null;

  return (
    <div ref={setNodeRef} style={style}>
      <ChartWidget widget={widget} onEdit={onEdit} onDelete={onDelete} dragHandle={handle} />
    </div>
  );
}
