/**
 * ChartWidget
 *
 * Renderiza um widget de dashboard a partir de sua configuracao (DashboardWidget).
 * Busca os dados da fonte correspondente, agrega no cliente e renderiza com Recharts.
 * Suporta: bar, bar_horizontal, line, area, pie, donut, metric.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, BarChart as BarHChart,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ReactNode } from 'react';
import { Pencil, Trash2, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { DashboardWidget, ChartPeriod } from '../types/admin.types';

// ── Palette ───────────────────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

// ── Period helper ─────────────────────────────────────────────────────────────

function getDateRange(period: ChartPeriod = '12months'): { start: string; end: string } {
  const now = new Date();
  let startD = new Date(now);
  let endD   = new Date(now);

  switch (period) {
    case '3months':       startD.setMonth(startD.getMonth() - 3);                          break;
    case '6months':       startD.setMonth(startD.getMonth() - 6);                          break;
    case 'current_year':  startD = new Date(now.getFullYear(), 0, 1);                       break;
    case 'previous_year':
      startD = new Date(now.getFullYear() - 1, 0, 1);
      endD   = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default: /* 12months */ startD.setMonth(startD.getMonth() - 12);                       break;
  }
  return { start: startD.toISOString().slice(0, 10), end: endD.toISOString().slice(0, 10) };
}

function fmtMonth(d: string) {
  const [y, m] = d.slice(0, 7).split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function toYYYYMM(d: string) { return d.slice(0, 7); }

function currency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

type ChartDatum = Record<string, string | number>;

// ── Data loaders ──────────────────────────────────────────────────────────────

async function loadData(source: string, period: ChartPeriod = '12months'): Promise<ChartDatum[]> {
  const { start, end } = getDateRange(period);

  // ── Financial ──────────────────────────────────────────────────────────────

  if (source === 'revenue_by_month') {
    const { data } = await supabase
      .from('financial_cash_flow_view')
      .select('entry_date, amount')
      .eq('direction', 'entrada')
      .gte('entry_date', start)
      .lte('entry_date', end);

    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { entry_date: string; amount: number }) => {
      const ym = toYYYYMM(r.entry_date);
      agg[ym] = (agg[ym] ?? 0) + Number(r.amount);
    });
    return Object.entries(agg)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, value]) => ({ month: fmtMonth(ym), value }));
  }

  if (source === 'overdue_trend') {
    const { data } = await supabase
      .from('financial_installments')
      .select('due_date, amount')
      .eq('status', 'overdue')
      .gte('due_date', start)
      .lte('due_date', end);

    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { due_date: string; amount: number }) => {
      const ym = toYYYYMM(r.due_date);
      agg[ym] = (agg[ym] ?? 0) + Number(r.amount);
    });
    return Object.entries(agg)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, value]) => ({ month: fmtMonth(ym), value }));
  }

  if (source === 'contracts_by_segment') {
    // Conta contratos ativos criados dentro do período selecionado.
    const { data } = await supabase
      .from('financial_contracts')
      .select('status, created_at, school_class:school_classes(series:school_series(segment:school_segments(name)))')
      .eq('status', 'active')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');

    type ContractRow = { school_class: { series: { segment: { name: string } | null } | null } | null };
    const agg: Record<string, number> = {};
    ((data ?? []) as unknown as ContractRow[]).forEach((r) => {
      const name = r.school_class?.series?.segment?.name ?? 'Sem segmento';
      agg[name] = (agg[name] ?? 0) + 1;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }

  if (source === 'installments_status_dist') {
    const { data } = await supabase
      .from('financial_installments')
      .select('status')
      .gte('due_date', start)
      .lte('due_date', end);

    const labels: Record<string, string> = {
      paid: 'Pago', pending: 'Pendente', overdue: 'Vencido',
      cancelled: 'Cancelado', blocked: 'Bloqueado',
    };
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { status: string }) => {
      const name = labels[r.status] ?? r.status;
      agg[name] = (agg[name] ?? 0) + 1;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }

  if (source === 'collection_funnel') {
    const { data } = await supabase
      .from('financial_installments')
      .select('status, amount, due_date')
      .gte('due_date', start)
      .lte('due_date', end);

    const labels: Record<string, string> = {
      paid: 'Pago', pending: 'Pendente', overdue: 'Vencido',
    };
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { status: string; amount: number }) => {
      const name = labels[r.status] ?? r.status;
      if (name) agg[name] = (agg[name] ?? 0) + Number(r.amount);
    });
    const order = ['Pago', 'Pendente', 'Vencido'];
    return order
      .filter((n) => agg[n] !== undefined)
      .map((name) => ({ name, value: agg[name] }));
  }

  if (source === 'monthly_revenue_vs_overdue') {
    const [recRes, ovdRes] = await Promise.all([
      supabase.from('financial_cash_flow_view').select('entry_date, amount').eq('direction', 'entrada').gte('entry_date', start).lte('entry_date', end),
      supabase.from('financial_installments').select('due_date, amount').eq('status', 'overdue').gte('due_date', start).lte('due_date', end),
    ]);

    const rec: Record<string, number> = {};
    const ovd: Record<string, number> = {};
    (recRes.data ?? []).forEach((r: { entry_date: string; amount: number }) => {
      const ym = toYYYYMM(r.entry_date);
      rec[ym] = (rec[ym] ?? 0) + Number(r.amount);
    });
    (ovdRes.data ?? []).forEach((r: { due_date: string; amount: number }) => {
      const ym = toYYYYMM(r.due_date);
      ovd[ym] = (ovd[ym] ?? 0) + Number(r.amount);
    });

    const allYMs = Array.from(new Set([...Object.keys(rec), ...Object.keys(ovd)])).sort();
    return allYMs.map((ym) => ({
      month: fmtMonth(ym),
      receita: rec[ym] ?? 0,
      inadimplencia: ovd[ym] ?? 0,
    }));
  }

  // ── Principal (cross-module) ──────────────────────────────────────────────

  if (source === 'leads_by_month') {
    const { data } = await supabase
      .from('contact_requests')
      .select('created_at')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { created_at: string }) => {
      const ym = toYYYYMM(r.created_at.slice(0, 10));
      agg[ym] = (agg[ym] ?? 0) + 1;
    });
    return Object.entries(agg)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, value]) => ({ month: fmtMonth(ym), value }));
  }

  if (source === 'appointments_by_status') {
    const { data } = await supabase
      .from('visit_appointments')
      .select('status')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');
    const labels: Record<string, string> = {
      pending: 'Pendente', confirmed: 'Confirmado', completed: 'Realizado',
      cancelled: 'Cancelado', no_show: 'Não compareceu',
    };
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { status: string }) => {
      const name = labels[r.status] ?? r.status;
      agg[name] = (agg[name] ?? 0) + 1;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }

  if (source === 'enrollments_funnel') {
    const [leads, visits, enrolls] = await Promise.all([
      supabase.from('contact_requests').select('id', { count: 'exact', head: true }).gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59'),
      supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59'),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59'),
    ]);
    return [
      { name: 'Leads', value: leads.count ?? 0 },
      { name: 'Visitas', value: visits.count ?? 0 },
      { name: 'Matrículas', value: enrolls.count ?? 0 },
    ];
  }

  if (source === 'wa_messages_by_status') {
    // Tabela correta é `whatsapp_message_log` (alinhada com o widget do registry
    // `whatsapp.stats`). `whatsapp_messages` nunca existiu no schema.
    const { data } = await supabase
      .from('whatsapp_message_log')
      .select('status')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');
    const labels: Record<string, string> = {
      pending: 'Pendente', sent: 'Enviada', delivered: 'Entregue',
      read: 'Lida', failed: 'Falhou',
    };
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { status: string }) => {
      const name = labels[r.status] ?? r.status;
      agg[name] = (agg[name] ?? 0) + 1;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }

  // ── Academic ───────────────────────────────────────────────────────────────

  if (source === 'class_occupancy') {
    // Só alunos `status='active'` contam para ocupação — inativos, transferidos
    // e formados distorceriam a taxa de ocupação.
    const { data } = await supabase
      .from('school_classes')
      .select('name, capacity, students!inner(id, status)')
      .eq('is_active', true)
      .eq('students.status', 'active');

    type ClassRow = { name: string; capacity: number | null; students: { id: string }[] };
    return ((data ?? []) as unknown as ClassRow[]).map((c) => ({
      name: c.name,
      value: c.capacity ? Math.round((c.students.length / c.capacity) * 100) : c.students.length,
      alunos: c.students.length,
      vagas: c.capacity ?? 0,
    })).sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 12);
  }

  if (source === 'attendance_by_class') {
    // Embed filtra por aluno ativo — chamadas de alunos transferidos/formados
    // poluiriam a média por turma.
    const { data } = await supabase
      .from('student_attendance')
      .select('student:students!inner(status, school_class:school_classes(name)), status')
      .in('status', ['present', 'absent', 'late', 'justified'])
      .eq('student.status', 'active')
      .gte('date', start)
      .lte('date', end);

    type AttRow = { student: { school_class: { name: string } | null } | null; status: string };
    const byClass: Record<string, { present: number; total: number }> = {};
    ((data ?? []) as unknown as AttRow[]).forEach((r) => {
      const cls = r.student?.school_class?.name ?? 'Sem turma';
      if (!byClass[cls]) byClass[cls] = { present: 0, total: 0 };
      byClass[cls].total++;
      if (r.status === 'present' || r.status === 'late') byClass[cls].present++;
    });
    return Object.entries(byClass)
      .map(([name, d]) => ({ name, value: d.total ? Math.round((d.present / d.total) * 100) : 0 }))
      .sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 12);
  }

  if (source === 'grades_distribution') {
    // A tabela `grades` não tem coluna `value`; a nota é `score`/`max_score`.
    // Normalizamos para escala 0–10 antes de bucketizar.
    const { data } = await supabase
      .from('grades')
      .select('score, max_score')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');

    const buckets: Record<string, number> = { '0–4': 0, '4–6': 0, '6–8': 0, '8–10': 0 };
    (data ?? []).forEach((r: { score: number | null; max_score: number | null }) => {
      const score = Number(r.score);
      const max = Number(r.max_score);
      if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return;
      const v = (score / max) * 10;
      if (v < 4) buckets['0–4']++;
      else if (v < 6) buckets['4–6']++;
      else if (v < 8) buckets['6–8']++;
      else buckets['8–10']++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }

  if (source === 'learning_curve') {
    // Colunas reais em `student_results`: `period1_avg`..`period4_avg` + `final_avg`.
    // Não existe `period_label`/`final_average`. Derreto os 4 períodos em linhas
    // para produzir a curva média da escola ao longo do ano.
    const { data } = await supabase
      .from('student_results')
      .select('period1_avg, period2_avg, period3_avg, period4_avg')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');

    type ResultRow = { period1_avg: number | null; period2_avg: number | null; period3_avg: number | null; period4_avg: number | null };
    const byPeriod: Record<string, { sum: number; count: number }> = {};
    ((data ?? []) as ResultRow[]).forEach((r) => {
      ([
        ['1º bim', r.period1_avg],
        ['2º bim', r.period2_avg],
        ['3º bim', r.period3_avg],
        ['4º bim', r.period4_avg],
      ] as [string, number | null][]).forEach(([key, v]) => {
        if (v == null) return;
        if (!byPeriod[key]) byPeriod[key] = { sum: 0, count: 0 };
        byPeriod[key].sum += Number(v);
        byPeriod[key].count++;
      });
    });
    return Object.entries(byPeriod)
      .map(([period, d]) => ({ period, media: Math.round((d.sum / d.count) * 10) / 10 }));
  }

  if (source === 'alerts_by_severity') {
    // `student_results` não tem `attendance_status`; derivamos do `attendance_pct`:
    // <75% = Crítico, <85% = Alerta, >=85% = OK. Escolhido para cobrir o piso legal
    // de 75% de presença exigido pela LDB.
    const { data } = await supabase
      .from('student_results')
      .select('attendance_pct')
      .not('attendance_pct', 'is', null);

    const agg: Record<string, number> = { 'Crítico': 0, 'Alerta': 0, 'OK': 0 };
    (data ?? []).forEach((r: { attendance_pct: number }) => {
      const pct = Number(r.attendance_pct);
      if (!Number.isFinite(pct)) return;
      if (pct < 75) agg['Crítico']++;
      else if (pct < 85) agg['Alerta']++;
      else agg['OK']++;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }

  if (source === 'top_absences') {
    // Apenas faltas de alunos ativos — transferidos acumulariam zeros forever.
    const { data } = await supabase
      .from('student_attendance')
      .select('student:students!inner(status, school_class:school_classes(name)), status')
      .eq('status', 'absent')
      .eq('student.status', 'active')
      .gte('date', start)
      .lte('date', end);

    type AbsRow = { student: { school_class: { name: string } | null } | null };
    const agg: Record<string, number> = {};
    ((data ?? []) as unknown as AbsRow[]).forEach((r) => {
      const cls = r.student?.school_class?.name ?? 'Sem turma';
      agg[cls] = (agg[cls] ?? 0) + 1;
    });
    return Object.entries(agg)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }

  // ── Secretaria ──────────────────────────────────────────────────────────────

  if (source === 'declaracoes_by_status') {
    const { data } = await supabase
      .from('document_requests')
      .select('status, created_at')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');
    const labels: Record<string, string> = {
      pending: 'Pendente', approved: 'Aprovada', generating: 'Gerando',
      generated: 'Gerada', delivered: 'Entregue', rejected: 'Rejeitada',
    };
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { status: string }) => {
      const name = labels[r.status] ?? r.status;
      agg[name] = (agg[name] ?? 0) + 1;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }

  if (source === 'declaracoes_by_month') {
    const { data } = await supabase
      .from('document_requests')
      .select('created_at')
      .gte('created_at', start)
      .lte('created_at', end + 'T23:59:59');
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { created_at: string }) => {
      const ym = toYYYYMM(r.created_at);
      agg[ym] = (agg[ym] ?? 0) + 1;
    });
    return Object.entries(agg)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, value]) => ({ name: fmtMonth(ym), value }));
  }

  if (source === 'transfers_by_type') {
    const { data } = await supabase
      .from('student_transfers')
      .select('type, effective_date')
      .gte('effective_date', start)
      .lte('effective_date', end);
    const labels: Record<string, string> = {
      internal: 'Interna', transfer_out: 'Transferência', trancamento: 'Trancamento', cancellation: 'Cancelamento',
    };
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { type: string }) => {
      const name = labels[r.type] ?? r.type;
      agg[name] = (agg[name] ?? 0) + 1;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }

  if (source === 'rematricula_funnel') {
    const { data } = await supabase
      .from('reenrollment_applications')
      .select('status, created_at')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');
    const labels: Record<string, string> = {
      pending: 'Pendente', confirmed: 'Confirmada', signed: 'Assinada',
      contract_generated: 'Contrato', completed: 'Concluída', cancelled: 'Cancelada',
    };
    const order = ['pending', 'confirmed', 'signed', 'contract_generated', 'completed', 'cancelled'];
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { status: string }) => {
      agg[r.status] = (agg[r.status] ?? 0) + 1;
    });
    return order
      .filter((k) => agg[k] !== undefined)
      .map((k) => ({ name: labels[k] ?? k, value: agg[k] }));
  }

  // ── Área do Professor (RLS filtra por teacher_id = auth.uid()) ──────────────

  if (source === 'teacher_plans_by_month') {
    const { data } = await supabase
      .from('lesson_plans')
      .select('created_at')
      .gte('created_at', start)
      .lte('created_at', end + 'T23:59:59');
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { created_at: string }) => {
      const ym = toYYYYMM(r.created_at);
      agg[ym] = (agg[ym] ?? 0) + 1;
    });
    return Object.entries(agg)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, value]) => ({ name: fmtMonth(ym), value }));
  }

  if (source === 'teacher_exams_by_status') {
    const { data } = await supabase
      .from('class_exams')
      .select('status, exam_date')
      .gte('exam_date', start)
      .lte('exam_date', end);
    const labels: Record<string, string> = {
      draft: 'Rascunho', published: 'Publicada', applied: 'Aplicada', corrected: 'Corrigida',
    };
    const agg: Record<string, number> = {};
    (data ?? []).forEach((r: { status: string }) => {
      const name = labels[r.status] ?? r.status;
      agg[name] = (agg[name] ?? 0) + 1;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }

  return [];
}

// ── Tooltip formatters ────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? currency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── ChartWidget component ─────────────────────────────────────────────────────

interface ChartWidgetProps {
  widget: DashboardWidget;
  onEdit: () => void;
  onDelete: () => void;
  /** Slot opcional para handle de drag-and-drop, renderizado à esquerda do título. */
  dragHandle?: ReactNode;
}

export default function ChartWidget({ widget, onEdit, onDelete, dragHandle }: ChartWidgetProps) {
  const [data, setData] = useState<ChartDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadData(widget.data_source, widget.config.period);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [widget.data_source, widget.config.period]);

  useEffect(() => { void fetch(); }, [fetch]);

  const showLegend = widget.config.show_legend ?? (widget.chart_type === 'pie' || widget.chart_type === 'donut');
  const showGrid   = widget.config.show_grid   ?? true;
  const isCurrency = ['revenue_by_month','overdue_trend','collection_funnel','monthly_revenue_vs_overdue'].includes(widget.data_source);
  const isPct      = ['class_occupancy','attendance_by_class'].includes(widget.data_source);

  function renderChart() {
    if (!data.length) {
      return (
        <div className="flex items-center justify-center h-full text-xs text-gray-400">
          Sem dados para o período selecionado
        </div>
      );
    }

    const commonProps = { data, margin: { top: 4, right: 8, left: 0, bottom: 0 } };
    const axisTick = { fontSize: 11, fill: '#9ca3af' };
    const valFmt = (v: number) => isCurrency ? currency(v) : isPct ? `${v}%` : String(v);

    if (widget.chart_type === 'metric') {
      const val = data[0]?.value ?? 0;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <TrendingUp className="w-8 h-8 text-brand-primary/60" />
          <p className="text-3xl font-bold text-gray-800 dark:text-white">
            {isCurrency ? currency(Number(val)) : isPct ? `${val}%` : val}
          </p>
          {data[0]?.month && <p className="text-xs text-gray-400">{String(data[0].month)}</p>}
        </div>
      );
    }

    if (widget.chart_type === 'pie' || widget.chart_type === 'donut') {
      const innerR = widget.chart_type === 'donut' ? '55%' : '0%';
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={innerR} outerRadius="75%" paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CurrencyTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (widget.chart_type === 'bar_horizontal') {
      const dataKey = Object.keys(data[0]).find((k) => k !== 'name' && k !== 'month' && k !== 'period') ?? 'value';
      const xKey    = data[0].month ? 'month' : data[0].period ? 'period' : 'name';
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarHChart {...commonProps} layout="vertical">
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />}
            <XAxis type="number" tick={axisTick} tickFormatter={valFmt} width={60} />
            <YAxis type="category" dataKey={String(xKey)} tick={axisTick} width={70} />
            <Tooltip content={<CurrencyTooltip />} />
            <Bar dataKey={dataKey} fill={COLORS[0]} radius={[0, 4, 4, 0]} />
          </BarHChart>
        </ResponsiveContainer>
      );
    }

    // Grouped bar (e.g. monthly_revenue_vs_overdue with multiple keys)
    const valueKeys = Object.keys(data[0]).filter((k) => k !== 'name' && k !== 'month' && k !== 'period');
    const xKey = data[0].month ? 'month' : data[0].period ? 'period' : 'name';

    if (widget.chart_type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />}
            <XAxis dataKey={String(xKey)} tick={axisTick} />
            <YAxis tick={axisTick} tickFormatter={valFmt} width={isCurrency ? 72 : 40} />
            <Tooltip content={<CurrencyTooltip />} />
            {showLegend && valueKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {valueKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (widget.chart_type === 'area') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />}
            <XAxis dataKey={String(xKey)} tick={axisTick} />
            <YAxis tick={axisTick} tickFormatter={valFmt} width={isCurrency ? 72 : 40} />
            <Tooltip content={<CurrencyTooltip />} />
            {showLegend && valueKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {valueKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} fill={COLORS[i % COLORS.length] + '33'} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // line (default)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />}
          <XAxis dataKey={String(xKey)} tick={axisTick} />
          <YAxis tick={axisTick} tickFormatter={valFmt} width={isCurrency ? 72 : 40} />
          <Tooltip content={<CurrencyTooltip />} />
          {showLegend && valueKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {valueKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 h-[280px] flex flex-col hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {dragHandle}
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{widget.title}</p>
        </div>
        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-brand-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="px-2 py-1 text-[10px] bg-red-500 text-white rounded-lg">Excluir</button>
              <button onClick={() => setConfirmDelete(false)} className="p-1 text-gray-400 hover:text-gray-600"><span className="text-xs">✕</span></button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="space-y-2 w-full px-2 animate-pulse">
              {[70, 50, 85, 60, 75].map((w, i) => (
                <div key={i} className="h-5 bg-gray-100 dark:bg-gray-700 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        ) : (
          renderChart()
        )}
      </div>
    </div>
  );
}
