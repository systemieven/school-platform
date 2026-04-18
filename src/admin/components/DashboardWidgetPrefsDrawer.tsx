/**
 * DashboardWidgetPrefsDrawer
 *
 * Drawer admin para mostrar/ocultar e reordenar widgets estáticos do registry
 * de um dashboard (módulo: 'principal' | 'financeiro' | 'academico').
 *
 * Persiste em `dashboard_widget_prefs` (UPSERT por (module, registry_widget_id)).
 * RLS: admin/super_admin escrevem, qualquer authenticated lê.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, Eye, EyeOff, LayoutDashboard, Loader2, Sliders,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { Drawer, DrawerCard } from './Drawer';
import { Toggle } from './Toggle';
import type { DashboardModule, DashboardWidgetPref } from '../types/admin.types';

export interface RegistryWidgetMeta {
  id: string;
  label: string;
  slot: string;
}

interface PrefRow {
  registry_widget_id: string;
  is_visible: boolean;
  position: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  module: DashboardModule;
  registry: RegistryWidgetMeta[];
  prefsByWidget: Record<string, DashboardWidgetPref>;
  onSaved: (next: DashboardWidgetPref[]) => void;
}

export default function DashboardWidgetPrefsDrawer({
  open, onClose, module, registry, prefsByWidget, onSaved,
}: Props) {
  // Estado local: lista ordenada com is_visible/position derivados das prefs
  const initial = useMemo<PrefRow[]>(() => {
    const rows = registry.map((w, idx) => {
      const p = prefsByWidget[w.id];
      return {
        registry_widget_id: w.id,
        is_visible: p?.is_visible ?? true,
        position: p?.position ?? idx,
      };
    });
    return rows.sort((a, b) => a.position - b.position);
  }, [registry, prefsByWidget]);

  const [rows, setRows] = useState<PrefRow[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setRows(initial); }, [initial]);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const labelById = useMemo(() => {
    const m: Record<string, RegistryWidgetMeta> = {};
    registry.forEach((w) => { m[w.id] = w; });
    return m;
  }, [registry]);

  function toggle(id: string) {
    setRows((prev) => prev.map((r) =>
      r.registry_widget_id === id ? { ...r, is_visible: !r.is_visible } : r,
    ));
  }

  function move(idx: number, dir: -1 | 1) {
    setRows((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((r, i) => ({ ...r, position: i }));
    });
  }

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = rows.map((r, i) => ({
      module,
      registry_widget_id: r.registry_widget_id,
      is_visible: r.is_visible,
      position: i,
      updated_by: user?.id ?? null,
    }));
    const { data } = await supabase
      .from('dashboard_widget_prefs')
      .upsert(payload, { onConflict: 'module,registry_widget_id' })
      .select();
    setSaving(false);
    if (data) {
      onSaved(data as DashboardWidgetPref[]);
      logAudit({ action: 'update', module: 'settings', description: `Preferências do dashboard ${module} atualizadas (${rows.filter((r) => r.is_visible).length}/${rows.length} visíveis)` });
      setSaved(true);
      savedTimer.current = setTimeout(() => { setSaved(false); onClose(); }, 900);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Personalizar dashboard">
      <DrawerCard title="Widgets disponíveis" icon={Sliders}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Use os toggles para mostrar/ocultar e as setas para reordenar. As mudanças
          valem para todos os usuários com acesso aos respectivos módulos.
        </p>
        <ul className="space-y-2">
          {rows.map((r, idx) => {
            const meta = labelById[r.registry_widget_id];
            if (!meta) return null;
            return (
              <li
                key={r.registry_widget_id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900"
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="p-0.5 text-gray-400 hover:text-brand-primary disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                    title="Mover para cima"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === rows.length - 1}
                    className="p-0.5 text-gray-400 hover:text-brand-primary disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                    title="Mover para baixo"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    {meta.label}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                    <span className="uppercase tracking-wide">{meta.slot}</span>
                    <span>·</span>
                    {r.is_visible
                      ? <span className="inline-flex items-center gap-1 text-emerald-600"><Eye className="w-3 h-3" /> Visível</span>
                      : <span className="inline-flex items-center gap-1 text-gray-400"><EyeOff className="w-3 h-3" /> Oculto</span>}
                  </p>
                </div>
                <Toggle checked={r.is_visible} onChange={() => toggle(r.registry_widget_id)} />
              </li>
            );
          })}
        </ul>
      </DrawerCard>

      <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 ${
            saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark'
          }`}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
          ) : saved ? (
            <><Check className="w-4 h-4" /> Salvo!</>
          ) : (
            <><LayoutDashboard className="w-4 h-4" /> Salvar preferências</>
          )}
        </button>
      </div>
    </Drawer>
  );
}
