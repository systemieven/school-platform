/**
 * BnccPage — /admin/academico/bncc
 *
 * Página dedicada ao módulo BNCC com sub-abas horizontais:
 * Dashboard · Objetivos · Cobertura · Relatórios Pedagógicos
 */
import { useEffect, useState } from 'react';
import {
  Target, LayoutDashboard, List, BarChart3, CheckSquare,
  Loader2, TrendingUp, BookOpen, Layers, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import ObjetivosPage from './ObjetivosPage';
import CoberturaBnccPage from './CoberturaBnccPage';
import RelatoriosPedPage from './RelatoriosPedPage';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'dashboard' | 'objetivos' | 'cobertura' | 'relatorios';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { key: 'dashboard',  label: 'Dashboard',            icon: LayoutDashboard },
  { key: 'objetivos',  label: 'Objetivos',             icon: List           },
  { key: 'cobertura',  label: 'Cobertura BNCC',        icon: CheckSquare    },
  { key: 'relatorios', label: 'Relatórios Pedagógicos', icon: BarChart3      },
];

// ── Dashboard tab ─────────────────────────────────────────────────────────────

interface Stats {
  total: number;
  active: number;
  inactive: number;
  associations: number;
  executedPlans: number;
  plansWithObjectives: number;
  bySegment: { name: string; count: number }[];
  topObjectives: { code: string; title: string; count: number }[];
}

function BnccDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [objRes, assocRes, plansRes, plansWithObjRes, segRes, topRes] = await Promise.all([
        // Total de objetivos
        supabase.from('learning_objectives').select('id, is_active, segment:school_segments(name)', { count: 'exact' }),

        // Total de associações plano↔objetivo
        supabase.from('lesson_plan_objectives').select('*', { count: 'exact', head: true }),

        // Planos executados
        supabase.from('lesson_plans').select('id', { count: 'exact', head: true }).eq('status', 'executed'),

        // Planos executados QUE TÊM objetivos
        supabase
          .from('lesson_plans')
          .select('id, lesson_plan_objectives!inner(learning_objective_id)', { count: 'exact', head: true })
          .eq('status', 'executed'),

        // Contagem por segmento
        supabase
          .from('learning_objectives')
          .select('segment:school_segments(name)')
          .eq('is_active', true),

        // Top 5 objetivos mais usados
        supabase
          .from('lesson_plan_objectives')
          .select('learning_objective_id, objective:learning_objectives(code, title)'),
      ]);

      const objectives = objRes.data ?? [];
      const active   = objectives.filter((o: { is_active: boolean }) => o.is_active).length;
      const inactive = objectives.filter((o: { is_active: boolean }) => !o.is_active).length;

      // Agrupa por segmento
      const segMap: Record<string, number> = {};
      (segRes.data as unknown as { segment: { name: string } | null }[] ?? []).forEach((o) => {
        const name = o.segment?.name ?? 'Sem segmento';
        segMap[name] = (segMap[name] ?? 0) + 1;
      });
      const bySegment = Object.entries(segMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Top objetivos
      const countMap: Record<string, { code: string; title: string; count: number }> = {};
      (topRes.data as unknown as { learning_objective_id: string; objective: { code: string; title: string } | null }[] ?? []).forEach((row) => {
        const id = row.learning_objective_id;
        if (!countMap[id]) {
          countMap[id] = { code: row.objective?.code ?? id, title: row.objective?.title ?? '—', count: 0 };
        }
        countMap[id].count++;
      });
      const topObjectives = Object.values(countMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        total: objectives.length,
        active,
        inactive,
        associations: assocRes.count ?? 0,
        executedPlans: plansRes.count ?? 0,
        plansWithObjectives: plansWithObjRes.count ?? 0,
        bySegment,
        topObjectives,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stats) return null;

  const coveragePct = stats.executedPlans > 0
    ? Math.round((stats.plansWithObjectives / stats.executedPlans) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Objetivos ativos',
            value: stats.active,
            sub: `${stats.inactive} inativos`,
            icon: Target,
            color: 'text-brand-primary',
            bg: 'bg-brand-primary/10 dark:bg-brand-primary/20',
          },
          {
            label: 'Associações a planos',
            value: stats.associations,
            sub: 'objetivo ↔ plano',
            icon: BookOpen,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
          },
          {
            label: 'Planos com objetivos',
            value: stats.plansWithObjectives,
            sub: `de ${stats.executedPlans} executados`,
            icon: CheckSquare,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
          },
          {
            label: 'Cobertura geral',
            value: `${coveragePct}%`,
            sub: 'planos executados',
            icon: TrendingUp,
            color: coveragePct >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
            bg: coveragePct >= 70 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
          },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wide truncate">{label}</p>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100 leading-tight">{value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por segmento */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Objetivos por segmento</h3>
          </div>
          {stats.bySegment.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum objetivo cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {stats.bySegment.map(({ name, count }) => {
                const max = stats.bySegment[0]?.count ?? 1;
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{name}</span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 ml-2">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-primary rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top objetivos mais usados */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Objetivos mais associados</h3>
          </div>
          {stats.topObjectives.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <AlertTriangle className="w-8 h-8 text-amber-300 dark:text-amber-600" />
              <p className="text-sm text-gray-400 text-center">
                Nenhum objetivo foi associado a planos ainda.
              </p>
              <p className="text-xs text-gray-400 text-center">
                Acesse a aba "Objetivos" para cadastrar e depois associe nos Planos de Aula.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topObjectives.map(({ code, title, count }, i) => (
                <div key={code} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-secondary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded flex-shrink-0">
                        {code}
                      </span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{title}</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-brand-primary dark:text-brand-secondary flex-shrink-0">
                    {count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
// Renderiza diretamente dentro do painel do AcademicoPage (sem wrapper extra).
// Usa margens negativas para que a barra de sub-abas fique encostada na borda
// superior do conteúdo, igual ao padrão Site nas Configurações.

export default function BnccPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  return (
    <div className="-mx-6 -mt-6">
      {/* Sub-tab bar — fica encostada no border-b do título do AcademicoPage */}
      <div className="flex items-center gap-0.5 px-6 border-b border-gray-100 dark:border-gray-700 overflow-x-auto bg-gray-50/60 dark:bg-gray-800/60">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 transition-all
                ${active
                  ? 'border-brand-primary text-brand-primary dark:text-brand-secondary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'dashboard'  && <BnccDashboard />}
        {activeTab === 'objetivos'  && <ObjetivosPage />}
        {activeTab === 'cobertura'  && <CoberturaBnccPage />}
        {activeTab === 'relatorios' && <RelatoriosPedPage />}
      </div>
    </div>
  );
}
