/**
 * AnoLetivoPage — Sugestão de progressão de série para o próximo ano letivo.
 *
 * Lista alunos ativos do ano-base (target_year - 1) com a sugestão calculada
 * pela RPC `suggest_year_progression`, baseada em `student_results`:
 *
 *   - approved   → advance (próxima série)
 *   - recovery   → repeat (mesma série)
 *   - failed_*   → repeat
 *   - in_progress → pending
 *
 * Admin/super_admin podem confirmar a vinculação à turma do próximo ano.
 * Não há aplicação automática — toda transição é manual.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import type { SchoolClass } from '../../types/admin.types';
import {
  ArrowRight, RotateCcw, Loader2, CalendarRange, Filter, ChevronDown,
  CheckCircle2, AlertCircle, Lock, ArrowUpRight,
} from 'lucide-react';
import CapacityOverrideModal, { parseCapacityError } from '../../components/CapacityOverrideModal';

interface ProgressionRow {
  student_id: string;
  student_name: string;
  current_class_id: string;
  current_class_name: string;
  current_series_id: string;
  current_series_name: string;
  current_school_year: number;
  segment_id: string;
  segment_name: string;
  overall_result: string;
  suggested_action: string;
  suggested_series_id: string | null;
  suggested_series_name: string | null;
}

type FilterMode = 'all' | 'advance' | 'repeat' | 'pending';

const ACTION_LABELS: Record<string, { label: string; color: string; icon: typeof ArrowRight }> = {
  advance: { label: 'Avança',    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', icon: ArrowUpRight },
  repeat:  { label: 'Repete',    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',         icon: RotateCcw },
  pending: { label: 'Pendente',  color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300',                icon: AlertCircle },
};

export default function AnoLetivoPage() {
  const { hasRole } = useAdminAuth();
  const canPromote = hasRole('admin', 'super_admin');

  const currentYear = new Date().getFullYear();
  const [targetYear, setTargetYear] = useState<number>(currentYear + 1);
  const [rows, setRows] = useState<ProgressionRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selection, setSelection] = useState<Record<string, string>>({}); // student_id → class_id
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<string, true>>({});
  const [capacityModal, setCapacityModal] = useState<
    { studentId: string; current: number; max: number; className: string } | null
  >(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setMoved({});
    setSelection({});
    const [progRes, clsRes] = await Promise.all([
      supabase.rpc('suggest_year_progression', { target_year: targetYear }),
      supabase
        .from('school_classes')
        .select('*, segment:school_segments(*), series:school_series(*)')
        .eq('is_active', true)
        .eq('school_year', targetYear)
        .order('name'),
    ]);
    setRows((progRes.data ?? []) as ProgressionRow[]);
    setClasses((clsRes.data ?? []) as SchoolClass[]);
    setLoading(false);
  }, [targetYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // KPI counts
  const counts = useMemo(() => {
    const c = { total: rows.length, advance: 0, repeat: 0, pending: 0 };
    for (const r of rows) {
      if (r.suggested_action === 'advance') c.advance++;
      else if (r.suggested_action === 'repeat') c.repeat++;
      else c.pending++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.suggested_action === filter);
  }, [rows, filter]);

  // Para cada linha, sugerimos um conjunto de turmas candidatas:
  // segmento + série sugerida + ano alvo
  function candidateClasses(row: ProgressionRow): SchoolClass[] {
    const targetSeriesId = row.suggested_action === 'advance'
      ? row.suggested_series_id
      : row.current_series_id;
    return classes.filter(
      (c) => c.segment_id === row.segment_id
        && (!targetSeriesId || c.series_id === targetSeriesId),
    );
  }

  async function moveStudent(row: ProgressionRow, force: boolean) {
    const classId = selection[row.student_id];
    if (!classId) return;
    setMovingId(row.student_id);
    try {
      const { error } = await supabase.rpc('move_student_with_capacity', {
        p_student_id: row.student_id,
        p_class_id: classId,
        p_force: force,
      });
      if (error) {
        const cap = parseCapacityError(error);
        if (cap) {
          const cls = classes.find((c) => c.id === cap.classId);
          setCapacityModal({
            studentId: row.student_id,
            current: cap.current,
            max: cap.max,
            className: cls?.name ?? '',
          });
          return;
        }
        console.error('Erro ao mover aluno:', error);
        return;
      }
      setMoved((prev) => ({ ...prev, [row.student_id]: true }));
    } finally {
      setMovingId(null);
    }
  }

  // Group rows by segment for display
  const grouped = useMemo(() => {
    const map = new Map<string, ProgressionRow[]>();
    for (const r of filtered) {
      const key = r.segment_name || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <CalendarRange className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
          <span className="font-medium">Ano-alvo:</span>
        </div>
        <div className="relative">
          <select
            value={targetYear}
            onChange={(e) => setTargetYear(Number(e.target.value))}
            className="appearance-none pl-3 pr-9 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary"
          >
            {[currentYear, currentYear + 1, currentYear + 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <span className="text-xs text-gray-400">
          (sugestões baseadas em resultados de {targetYear - 1})
        </span>
        <div className="flex-1" />
        {!canPromote && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Lock className="w-3.5 h-3.5" />
            Apenas administradores podem confirmar promoções
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',      value: counts.total,   color: 'text-gray-600 dark:text-gray-300',     bg: 'bg-gray-50 dark:bg-gray-800/50' },
          { label: 'Avançam',    value: counts.advance, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Repetem',    value: counts.repeat,  color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Pendentes',  value: counts.pending, color: 'text-gray-500 dark:text-gray-400',     bg: 'bg-gray-50 dark:bg-gray-800/50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border border-gray-100 dark:border-gray-700 p-4 ${kpi.bg}`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {(['all', 'advance', 'repeat', 'pending'] as FilterMode[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filter === f
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-brand-primary/50'
            }`}
          >
            {f === 'all' ? 'Todos' : ACTION_LABELS[f].label}
          </button>
        ))}
      </div>

      {/* Loading / empty */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}
      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <CalendarRange className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">Nenhum aluno ativo encontrado para {targetYear - 1}.</p>
        </div>
      )}

      {/* Grouped rows */}
      {!loading && grouped.map(([segment, items]) => (
        <div key={segment} className="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {segment} · {items.length} aluno{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((row) => {
              const action = ACTION_LABELS[row.suggested_action] ?? ACTION_LABELS.pending;
              const ActionIcon = action.icon;
              const candidates = candidateClasses(row);
              const isMoved = moved[row.student_id];
              const isMoving = movingId === row.student_id;

              return (
                <div key={row.student_id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.student_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {row.current_series_name} {row.current_class_name} · {row.current_school_year}
                    </p>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${action.color}`}>
                    <ActionIcon className="w-3 h-3" />
                    {action.label}
                  </span>

                  <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />

                  <div className="flex items-center gap-2 min-w-[200px]">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {row.suggested_series_name ?? row.current_series_name}
                    </span>
                  </div>

                  {!isMoved && candidates.length > 0 && (
                    <div className="relative">
                      <select
                        value={selection[row.student_id] ?? ''}
                        onChange={(e) => setSelection((p) => ({ ...p, [row.student_id]: e.target.value }))}
                        className="appearance-none pl-3 pr-9 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:border-brand-primary min-w-[180px]"
                      >
                        <option value="">Turma {targetYear}…</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.series?.name ?? ''} {c.name}
                            {c.max_students ? ` · max ${c.max_students}` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                  )}

                  {!isMoved && candidates.length === 0 && (
                    <span className="text-[11px] text-gray-400">
                      Sem turma {targetYear} para esta série
                    </span>
                  )}

                  {!isMoved && (
                    <button
                      onClick={() => moveStudent(row, false)}
                      disabled={!canPromote || !selection[row.student_id] || isMoving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors disabled:opacity-40"
                    >
                      {isMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                      Promover
                    </button>
                  )}

                  {isMoved && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Promovido
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <CapacityOverrideModal
        open={!!capacityModal}
        onClose={() => setCapacityModal(null)}
        canOverride={canPromote}
        currentCount={capacityModal?.current ?? 0}
        maxStudents={capacityModal?.max ?? 0}
        className={capacityModal?.className}
        onConfirm={async () => {
          if (!capacityModal) return;
          const row = rows.find((r) => r.student_id === capacityModal.studentId);
          setCapacityModal(null);
          if (row) await moveStudent(row, true);
        }}
      />
    </div>
  );
}
