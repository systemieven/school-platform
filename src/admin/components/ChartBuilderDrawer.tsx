/**
 * ChartBuilderDrawer
 *
 * Drawer compartilhado para criacao e edicao de widgets de dashboard.
 * 4 DrawerCards: Identificacao, Tipo de Grafico, Dados, Periodo.
 * Salva/atualiza em dashboard_widgets (Supabase).
 */
import { useEffect, useRef, useState } from 'react';
import {
  Tag, BarChart2, Database, Calendar,
  Loader2, Check, LayoutDashboard,
  BarChart, BarChartHorizontal, TrendingUp, Activity,
  PieChart, Disc, Hash,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { Drawer, DrawerCard } from './Drawer';
import type {
  DashboardWidget, DashboardModule,
  ChartType, ChartPeriod,
  WidgetConfig,
} from '../types/admin.types';
import {
  CHART_PERIOD_LABELS,
  FINANCIAL_DATA_SOURCES,
  ACADEMIC_DATA_SOURCES,
  PRINCIPAL_DATA_SOURCES,
} from '../types/admin.types';

// ── Chart type gallery ────────────────────────────────────────────────────────

const CHART_TYPES: { type: ChartType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'bar',            label: 'Barras Vert.',  Icon: BarChart },
  { type: 'bar_horizontal', label: 'Barras Horiz.', Icon: BarChartHorizontal },
  { type: 'line',           label: 'Linha',         Icon: TrendingUp },
  { type: 'area',           label: 'Área',          Icon: Activity },
  { type: 'pie',            label: 'Pizza',         Icon: PieChart },
  { type: 'donut',          label: 'Rosca',         Icon: Disc },
  { type: 'metric',         label: 'Métrica',       Icon: Hash },
];

interface ChartBuilderDrawerProps {
  open: boolean;
  onClose: () => void;
  module: DashboardModule;
  widget?: DashboardWidget | null;   // null = create new
  onSaved: (widget: DashboardWidget) => void;
}

export default function ChartBuilderDrawer({
  open, onClose, module, widget, onSaved,
}: ChartBuilderDrawerProps) {
  const isNew = !widget;

  const [title,      setTitle]      = useState('');
  const [chartType,  setChartType]  = useState<ChartType>('bar');
  const [dataSource, setDataSource] = useState('');
  const [period,     setPeriod]     = useState<ChartPeriod>('12months');

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sources =
    module === 'financeiro' ? FINANCIAL_DATA_SOURCES
    : module === 'academico' ? ACADEMIC_DATA_SOURCES
    : PRINCIPAL_DATA_SOURCES;

  // Populate form when editing
  useEffect(() => {
    if (widget) {
      setTitle(widget.title);
      setChartType(widget.chart_type);
      setDataSource(widget.data_source);
      setPeriod((widget.config.period as ChartPeriod) ?? '12months');
    } else {
      setTitle('');
      setChartType('bar');
      setDataSource(sources[0]?.value ?? '');
      setPeriod('12months');
    }
  }, [widget, sources]);

  // When data source changes, auto-suggest chart type
  function handleSourceChange(src: string) {
    setDataSource(src);
    const meta = sources.find((s) => s.value === src);
    if (meta?.suggested?.[0]) setChartType(meta.suggested[0]);
  }

  async function save() {
    if (!title.trim() || !dataSource) return;
    setSaving(true);

    const config: WidgetConfig = { period, show_legend: true, show_grid: true };
    const payload = {
      module,
      title: title.trim(),
      chart_type: chartType,
      data_source: dataSource,
      config,
      is_visible: true,
    };

    let result: DashboardWidget | null = null;

    if (isNew) {
      // Count existing to set position
      const { count } = await supabase.from('dashboard_widgets').select('id', { count: 'exact', head: true }).eq('module', module);
      const { data } = await supabase
        .from('dashboard_widgets')
        .insert({ ...payload, position: count ?? 0 })
        .select()
        .single();
      result = data as DashboardWidget;
      logAudit({ action: 'create', module: 'settings', description: `Widget "${title}" criado no dashboard ${module}` });
    } else {
      const { data } = await supabase
        .from('dashboard_widgets')
        .update(payload)
        .eq('id', widget!.id)
        .select()
        .single();
      result = data as DashboardWidget;
      logAudit({ action: 'update', module: 'settings', description: `Widget "${title}" atualizado` });
    }

    setSaving(false);
    if (result) {
      setSaved(true);
      onSaved(result);
      savedTimer.current = setTimeout(() => {
        setSaved(false);
        onClose();
      }, 900);
    }
  }

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const canSave = title.trim().length > 0 && dataSource.length > 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isNew ? 'Novo Gráfico' : 'Editar Gráfico'}
    >
      {/* ── Identificação ── */}
      <DrawerCard title="Identificação" icon={Tag}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Receita por Mês, Ocupação das Turmas..."
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
                     bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                     placeholder:text-gray-400 focus:border-brand-primary outline-none"
        />
      </DrawerCard>

      {/* ── Tipo de Gráfico ── */}
      <DrawerCard title="Tipo de Gráfico" icon={BarChart2}>
        <div className="grid grid-cols-3 gap-2">
          {CHART_TYPES.map(({ type, label, Icon }) => {
            const isSelected = chartType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setChartType(type)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium leading-tight text-center">{label}</span>
              </button>
            );
          })}
        </div>
      </DrawerCard>

      {/* ── Dados ── */}
      <DrawerCard title="Fonte de Dados" icon={Database}>
        <div className="space-y-2">
          {sources.map((src) => {
            const isSelected = dataSource === src.value;
            return (
              <button
                key={src.value}
                type="button"
                onClick={() => handleSourceChange(src.value)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <p className={`text-sm font-medium ${isSelected ? 'text-brand-primary' : 'text-gray-700 dark:text-gray-200'}`}>
                  {src.label}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{src.description}</p>
                {src.suggested.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {src.suggested.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </DrawerCard>

      {/* ── Período ── */}
      <DrawerCard title="Período" icon={Calendar}>
        <div className="grid grid-cols-1 gap-2">
          {(Object.entries(CHART_PERIOD_LABELS) as [ChartPeriod, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                period === key
                  ? 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </DrawerCard>

      {/* ── Footer ── */}
      <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-600
                     text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving || !canSave}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold
                      rounded-xl transition-all disabled:opacity-50 ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark'
          }`}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
          ) : saved ? (
            <><Check className="w-4 h-4" /> Salvo!</>
          ) : (
            <><LayoutDashboard className="w-4 h-4" /> {isNew ? 'Criar gráfico' : 'Salvar alterações'}</>
          )}
        </button>
      </div>
    </Drawer>
  );
}
