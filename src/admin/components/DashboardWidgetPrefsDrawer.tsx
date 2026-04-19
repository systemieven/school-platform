/**
 * DashboardWidgetPrefsDrawer
 *
 * Drawer para personalizar os widgets do dashboard.
 *
 * Duas abas:
 *   - "Minha visão" (todos): UPSERT em `dashboard_widget_user_prefs`
 *     com `user_id = auth.uid()` (RLS estrito por dono).
 *   - "Padrão da escola" (apenas admin/super_admin): UPSERT em
 *     `dashboard_widget_prefs` — vira fallback de quem nunca personalizou.
 *
 * Reordenação por drag-and-drop via @dnd-kit/sortable (KeyboardSensor
 * cobre acessibilidade — focar handle + setas reordena).
 *
 * Botão "Resetar" apaga as prefs do escopo ativo (volta a herdar do
 * fallback imediatamente abaixo na cadeia user > global > registry).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, Eye, EyeOff, GripVertical, LayoutDashboard, Loader2,
  RotateCcw, Sliders, User, Building2,
} from 'lucide-react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { Drawer, DrawerCard } from './Drawer';
import { Toggle } from './Toggle';
import type {
  DashboardModule, DashboardWidgetPref, DashboardWidgetUserPref,
} from '../types/admin.types';

export interface RegistryWidgetMeta {
  id: string;
  label: string;
  slot: string;
}

/** Prefixo usado em `registry_widget_id` para distinguir charts do registry. */
export const CHART_PREFIX = 'chart:';

/** ID sintético para o "bloco inteiro" de gráficos personalizados (DashboardChartGrid).
 *  Permite ao usuário reposicionar o bloco entre os widgets do registry. */
export const CUSTOM_CHARTS_ANCHOR_ID = '__custom_charts__';

interface PrefRow {
  registry_widget_id: string;
  is_visible: boolean;
  position: number;
}

type Scope = 'user' | 'global';

interface Props {
  open: boolean;
  onClose: () => void;
  module: DashboardModule;
  registry: RegistryWidgetMeta[];
  /** Gráficos personalizados (apenas na aba "Minha visão"; admin reordena a global direto no grid). */
  customCharts?: { id: string; title: string }[];
  /** Exibe um item sintético "Bloco de gráficos personalizados" na lista, permitindo
   *  reposicionar a área inteira de gráficos entre os widgets. Usado no dashboard principal
   *  onde o bloco é renderizado junto aos widgets do registry. */
  showCustomChartsAnchor?: boolean;
  /** Prefs globais (padrão da escola). */
  globalPrefsByWidget: Record<string, DashboardWidgetPref>;
  /** Prefs do usuário logado. */
  userPrefsByWidget: Record<string, DashboardWidgetUserPref>;
  /** Devolve as novas prefs globais (após salvar a aba "Padrão da escola"). */
  onGlobalSaved: (next: DashboardWidgetPref[]) => void;
  /** Devolve as novas prefs do usuário (após salvar/resetar a aba "Minha visão"). */
  onUserSaved: (next: DashboardWidgetUserPref[]) => void;
}

export default function DashboardWidgetPrefsDrawer({
  open, onClose, module, registry,
  customCharts = [],
  showCustomChartsAnchor = false,
  globalPrefsByWidget, userPrefsByWidget,
  onGlobalSaved, onUserSaved,
}: Props) {
  const { hasRole } = useAdminAuth();
  const canEditGlobal = hasRole('super_admin', 'admin');

  const [scope, setScope] = useState<Scope>('user');

  // Garante aba válida quando o drawer abre para um não-admin.
  useEffect(() => {
    if (!canEditGlobal) setScope('user');
  }, [canEditGlobal, open]);

  /** Unifica registry + charts. Charts só entram em "Minha visão"
   *  (no "Padrão da escola" eles são reordenados direto no grid). */
  const items = useMemo<RegistryWidgetMeta[]>(() => {
    const chartItems: RegistryWidgetMeta[] = (scope === 'user')
      ? customCharts.map((c) => ({
          id: `${CHART_PREFIX}${c.id}`,
          label: c.title,
          slot: 'Gráfico personalizado',
        }))
      : [];
    const anchorItem: RegistryWidgetMeta[] = showCustomChartsAnchor
      ? [{
          id: CUSTOM_CHARTS_ANCHOR_ID,
          label: 'Bloco de gráficos personalizados',
          slot: 'Seção',
        }]
      : [];
    return [...registry, ...chartItems, ...anchorItem];
  }, [registry, customCharts, scope, showCustomChartsAnchor]);

  const initial = useMemo<PrefRow[]>(() => {
    const source = scope === 'user' ? userPrefsByWidget : globalPrefsByWidget;
    const rows = items.map((w, idx) => {
      const p = source[w.id];
      return {
        registry_widget_id: w.id,
        is_visible: p?.is_visible ?? true,
        position: p?.position ?? idx,
      };
    });
    return rows.sort((a, b) => a.position - b.position);
  }, [items, globalPrefsByWidget, userPrefsByWidget, scope]);

  const [rows, setRows] = useState<PrefRow[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setRows(initial); }, [initial]);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const labelById = useMemo(() => {
    const m: Record<string, RegistryWidgetMeta> = {};
    items.forEach((w) => { m[w.id] = w; });
    return m;
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function toggle(id: string) {
    setRows((prev) => prev.map((r) =>
      r.registry_widget_id === id ? { ...r, is_visible: !r.is_visible } : r,
    ));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIdx = prev.findIndex((r) => r.registry_widget_id === active.id);
      const newIdx = prev.findIndex((r) => r.registry_widget_id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx).map((r, i) => ({ ...r, position: i }));
    });
  }

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (scope === 'user') {
      const payload = rows.map((r, i) => ({
        user_id: user.id,
        module,
        registry_widget_id: r.registry_widget_id,
        is_visible: r.is_visible,
        position: i,
      }));
      const { data } = await supabase
        .from('dashboard_widget_user_prefs')
        .upsert(payload, { onConflict: 'user_id,module,registry_widget_id' })
        .select();
      setSaving(false);
      if (data) {
        onUserSaved(data as DashboardWidgetUserPref[]);
        logAudit({
          action: 'update',
          module: 'settings',
          description: `Minha visão do dashboard ${module} atualizada (${rows.filter((r) => r.is_visible).length}/${rows.length} visíveis)`,
        });
        setSaved(true);
        savedTimer.current = setTimeout(() => { setSaved(false); onClose(); }, 900);
      }
    } else {
      const payload = rows.map((r, i) => ({
        module,
        registry_widget_id: r.registry_widget_id,
        is_visible: r.is_visible,
        position: i,
        updated_by: user.id,
      }));
      const { data } = await supabase
        .from('dashboard_widget_prefs')
        .upsert(payload, { onConflict: 'module,registry_widget_id' })
        .select();
      setSaving(false);
      if (data) {
        onGlobalSaved(data as DashboardWidgetPref[]);
        logAudit({
          action: 'update',
          module: 'settings',
          description: `Padrão da escola do dashboard ${module} atualizado (${rows.filter((r) => r.is_visible).length}/${rows.length} visíveis)`,
        });
        setSaved(true);
        savedTimer.current = setTimeout(() => { setSaved(false); onClose(); }, 900);
      }
    }
  }

  async function reset() {
    setResetting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setResetting(false); return; }

    if (scope === 'user') {
      await supabase
        .from('dashboard_widget_user_prefs')
        .delete()
        .eq('user_id', user.id)
        .eq('module', module);
      onUserSaved([]);
      logAudit({
        action: 'delete',
        module: 'settings',
        description: `Minha visão do dashboard ${module} resetada para o padrão da escola`,
      });
    } else {
      await supabase.from('dashboard_widget_prefs').delete().eq('module', module);
      onGlobalSaved([]);
      logAudit({
        action: 'delete',
        module: 'settings',
        description: `Padrão da escola do dashboard ${module} resetado para o default do sistema`,
      });
    }
    setResetting(false);
    onClose();
  }

  const helperText = scope === 'user'
    ? 'Estas preferências são suas — só você vê o dashboard assim. Arraste pelo handle para reordenar. Gráficos personalizados também aparecem aqui.'
    : 'Define o dashboard padrão para usuários que ainda não personalizaram. Para reordenar gráficos personalizados, arraste direto no painel de Gráficos.';

  return (
    <Drawer open={open} onClose={onClose} title="Personalizar dashboard">
      {canEditGlobal && (
        <div className="px-6 pt-4">
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setScope('user')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                scope === 'user'
                  ? 'bg-white dark:bg-gray-700 text-brand-primary shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Minha visão
            </button>
            <button
              type="button"
              onClick={() => setScope('global')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                scope === 'global'
                  ? 'bg-white dark:bg-gray-700 text-brand-primary shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> Padrão da escola
            </button>
          </div>
        </div>
      )}

      <DrawerCard title="Widgets disponíveis" icon={Sliders}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{helperText}</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={rows.map((r) => r.registry_widget_id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {rows.map((r) => {
                const meta = labelById[r.registry_widget_id];
                if (!meta) return null;
                return (
                  <SortableRow
                    key={r.registry_widget_id}
                    row={r}
                    meta={meta}
                    onToggle={toggle}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </DrawerCard>

      <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={reset}
          disabled={resetting || saving}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title={scope === 'user' ? 'Voltar ao padrão da escola' : 'Voltar ao default do sistema'}
        >
          {resetting
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Resetando…</>
            : <><RotateCcw className="w-3.5 h-3.5" /> Resetar</>}
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving || resetting}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 ${
            saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark'
          }`}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
          ) : saved ? (
            <><Check className="w-4 h-4" /> Salvo!</>
          ) : (
            <><LayoutDashboard className="w-4 h-4" /> Salvar</>
          )}
        </button>
      </div>
    </Drawer>
  );
}

interface SortableRowProps {
  row: PrefRow;
  meta: RegistryWidgetMeta;
  onToggle: (id: string) => void;
}

function SortableRow({ row, meta, onToggle }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.registry_widget_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-white dark:bg-gray-900 ${
        isDragging
          ? 'border-brand-primary shadow-lg'
          : 'border-gray-100 dark:border-gray-700'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-gray-400 hover:text-brand-primary touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 rounded"
        title="Arrastar para reordenar"
        aria-label={`Reordenar ${meta.label}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
          {meta.label}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
          <span className="uppercase tracking-wide">{meta.slot}</span>
          <span>·</span>
          {row.is_visible
            ? <span className="inline-flex items-center gap-1 text-emerald-600"><Eye className="w-3 h-3" /> Visível</span>
            : <span className="inline-flex items-center gap-1 text-gray-400"><EyeOff className="w-3 h-3" /> Oculto</span>}
        </p>
      </div>
      <Toggle checked={row.is_visible} onChange={() => onToggle(row.registry_widget_id)} />
    </li>
  );
}
