/**
 * Dashboard Widget Registry
 *
 * Cada widget declara:
 *   - `id`              — identificador único
 *   - `anyModuleKeys`   — chaves de `has_module_permission` que o liberam
 *                         (usuário vê o widget se tem `view` em qualquer uma)
 *   - `requireRole?`    — restringe a roles específicos (ex.: widgets de
 *                         teacher). Combina com `anyModuleKeys` em AND.
 *   - `slot`            — posição visual ('kpi' | 'chart' | 'list' | 'wide')
 *   - `order`           — ordem dentro do slot
 *   - `load(ctx)`       — async fetch que devolve os dados do widget
 *   - `Render({data, ctx})` — componente de apresentação
 *
 * A página `/admin` (DashboardPage) itera o registry, filtra por
 * permissão + role, dispara `Promise.all` nos `load()` dos visíveis e
 * renderiza cada `Render()` no grid adequado ao slot.
 *
 * Super_admin é atendido automaticamente via bypass de
 * `has_module_permission` — não precisa de lógica separada.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  GraduationCap,
  LogOut,
  MessageSquare,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import type { Profile, Role } from '../../types/admin.types';
import {
  BarChart,
  OverdueContactsWidget,
  StatCard,
  UpcomingVisitsWidget,
  WaStatsWidget,
  periodDays,
  periodStart,
} from './widgets';
import type {
  GroupCount,
  OverdueContact,
  Period,
  UpcomingAppointment,
  WaStats,
} from './widgets';
import { ListCard } from './widgets/ListCard';
import {
  APPT_STATUS,
  ENROLLMENT_PIPELINE,
  LEAD_FUNNEL,
  REASON_LABELS,
  formatBRL,
} from './widgets/constants';

// ── Tipos compartilhados ──────────────────────────────────────────────────────
export type DashboardSlot = 'kpi' | 'chart' | 'list' | 'wide';

export interface LoadCtx {
  profile: Pick<Profile, 'id' | 'role'>;
  period: Period;
  hasRole: (...r: Role[]) => boolean;
}

export interface DashboardWidget<TData = unknown> {
  id: string;
  /** Rótulo amigável para o painel "Personalizar" (default: derivado do id). */
  label?: string;
  anyModuleKeys: readonly string[];
  requireRole?: readonly Role[];
  slot: DashboardSlot;
  order: number;
  load: (ctx: LoadCtx) => Promise<TData>;
  Render: (props: { data: TData; ctx: LoadCtx }) => ReactNode;
}

/** Rótulos legíveis para os widgets do registry, indexados pelo `id`. */
export const WIDGET_LABELS: Record<string, string> = {
  'appointments.kpi':         'Agendamentos (KPI)',
  'enrollments.kpi':          'Pré-matrículas (KPI)',
  'contacts.kpi':             'Contatos (KPI)',
  'finance.snapshot':         'Resumo financeiro',
  'enrollments.funnel':       'Pré-matrículas por status',
  'appointments.status':      'Agendamentos por status',
  'leads.funnel':             'Funil de leads',
  'whatsapp.stats':           'WhatsApp · estatísticas',
  'contacts.overdue':         'Contatos atrasados',
  'appointments.upcoming':    'Próximas visitas',
  'finance.inadimplencia':    'Inadimplência · top 5',
  'finance.nfse':             'NFS-e no mês',
  'academic.alertas':         'Alunos em alerta',
  'academic.minhas_aulas':    'Minhas aulas de hoje',
  'academic.diario_pendente': 'Diário pendente',
  'academic.provas_corrigir': 'Provas a corrigir',
  'academic.rematricula':     'Rematrícula',
  'ops.ocorrencias':          'Ocorrências recentes',
  'ops.saidas_hoje':          'Saídas autorizadas hoje',
  'ops.declaracoes':          'Declarações em aberto',
  'academic.minhas_turmas':   'Minhas turmas',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════════════
// KPIs
// ═══════════════════════════════════════════════════════════════════════════

const AppointmentsKpi: DashboardWidget<{
  total: number;
  prev: number;
  pending: number;
}> = {
  id: 'appointments.kpi',
  anyModuleKeys: ['appointments'],
  slot: 'kpi',
  order: 10,
  load: async ({ period }) => {
    const days = periodDays(period);
    const start = periodStart(days);
    const prevStart = periodStart(days, days);
    const [curr, prev, pending] = await Promise.all([
      supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start),
      supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    return { total: curr.count ?? 0, prev: prev.count ?? 0, pending: pending.count ?? 0 };
  },
  Render: ({ data }) => (
    <StatCard
      label={data.pending > 0 ? `Agendamentos · ${data.pending} pendentes` : 'Agendamentos'}
      value={data.total}
      prev={data.prev}
      icon={CalendarCheck}
      colorClass="text-blue-600"
      iconBg="bg-blue-100 dark:bg-blue-900/30"
      linkTo="/admin/agendamentos"
    />
  ),
};

const EnrollmentsKpi: DashboardWidget<{ total: number; prev: number }> = {
  id: 'enrollments.kpi',
  anyModuleKeys: ['students'],
  slot: 'kpi',
  order: 20,
  load: async ({ period }) => {
    const days = periodDays(period);
    const start = periodStart(days);
    const prevStart = periodStart(days, days);
    const [curr, prev] = await Promise.all([
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start),
    ]);
    return { total: curr.count ?? 0, prev: prev.count ?? 0 };
  },
  Render: ({ data }) => (
    <StatCard
      label="Pré-Matrículas"
      value={data.total}
      prev={data.prev}
      icon={GraduationCap}
      colorClass="text-emerald-600"
      iconBg="bg-emerald-100 dark:bg-emerald-900/30"
      linkTo="/admin/matriculas"
    />
  ),
};

const ContactsKpi: DashboardWidget<{ total: number; prev: number }> = {
  id: 'contacts.kpi',
  anyModuleKeys: ['kanban'],
  slot: 'kpi',
  order: 30,
  load: async ({ period }) => {
    const days = periodDays(period);
    const start = periodStart(days);
    const prevStart = periodStart(days, days);
    const [curr, prev] = await Promise.all([
      supabase.from('contact_requests').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('contact_requests').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start),
    ]);
    return { total: curr.count ?? 0, prev: prev.count ?? 0 };
  },
  Render: ({ data }) => (
    <StatCard
      label="Contatos"
      value={data.total}
      prev={data.prev}
      icon={MessageSquare}
      colorClass="text-purple-600"
      iconBg="bg-purple-100 dark:bg-purple-900/30"
      linkTo="/admin/contatos"
    />
  ),
};

const FinanceSnapshotKpi: DashboardWidget<{
  receita30: number;
  arOpen: number;
  apDue7: number;
}> = {
  id: 'finance.snapshot',
  anyModuleKeys: ['financial', 'financial-receivables', 'financial-payables', 'financial-installments'],
  slot: 'kpi',
  order: 40,
  load: async () => {
    const start30 = periodStart(30);
    const in7 = daysFromNow(7);
    const today = todayIso();

    const [received30, arOpen, apDue] = await Promise.all([
      supabase
        .from('financial_installments')
        .select('paid_amount')
        .gte('paid_at', start30)
        .not('paid_at', 'is', null),
      supabase
        .from('financial_installments')
        .select('amount, paid_amount')
        .neq('status', 'paid')
        .neq('status', 'cancelled'),
      supabase
        .from('financial_payables')
        .select('amount')
        .gte('due_date', today)
        .lte('due_date', in7)
        .neq('status', 'paid'),
    ]);

    const receita30 = (received30.data ?? []).reduce(
      (s: number, r: any) => s + Number(r.paid_amount ?? 0),
      0,
    );
    const arSum = (arOpen.data ?? []).reduce(
      (s: number, r: any) => s + Math.max(Number(r.amount ?? 0) - Number(r.paid_amount ?? 0), 0),
      0,
    );
    const apSum = (apDue.data ?? []).reduce(
      (s: number, r: any) => s + Number(r.amount ?? 0),
      0,
    );

    return { receita30, arOpen: arSum, apDue7: apSum };
  },
  Render: ({ data }) => (
    <Link
      to="/admin/financeiro"
      className="block bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
          <DollarSign className="w-5 h-5 text-emerald-600" />
        </div>
        <span className="text-xs text-gray-400">últimos 30d</span>
      </div>
      <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatBRL(data.receita30)}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 group-hover:text-brand-primary dark:group-hover:text-brand-secondary transition-colors">
        Receita recebida
      </p>
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-gray-400">A/R aberto</p>
          <p className="font-semibold text-amber-600">{formatBRL(data.arOpen)}</p>
        </div>
        <div>
          <p className="text-gray-400">A/P 7d</p>
          <p className="font-semibold text-red-500">{formatBRL(data.apDue7)}</p>
        </div>
      </div>
    </Link>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════════════════════════════════

const EnrollmentFunnelChart: DashboardWidget<GroupCount[]> = {
  id: 'enrollments.funnel',
  anyModuleKeys: ['students'],
  slot: 'chart',
  order: 10,
  load: async () => {
    const { data } = await supabase.from('enrollments').select('status');
    const rows = (data ?? []) as { status: string }[];
    return ENROLLMENT_PIPELINE.map((p) => ({
      label: p.label,
      value: rows.filter((e) => e.status === p.key).length,
      color: p.color,
    }));
  },
  Render: ({ data }) => (
    <BarChart
      title="Pré-Matrículas por status"
      items={data}
      emptyLabel="Nenhuma pré-matrícula cadastrada"
      linkTo="/admin/matriculas"
    />
  ),
};

const AppointmentStatusChart: DashboardWidget<GroupCount[]> = {
  id: 'appointments.status',
  anyModuleKeys: ['appointments'],
  slot: 'chart',
  order: 20,
  load: async () => {
    const { data } = await supabase.from('visit_appointments').select('status');
    const rows = (data ?? []) as { status: string }[];
    return APPT_STATUS.map((s) => ({
      label: s.label,
      value: rows.filter((a) => a.status === s.key).length,
      color: s.color,
    }));
  },
  Render: ({ data }) => (
    <BarChart
      title="Agendamentos por status"
      items={data}
      emptyLabel="Nenhum agendamento cadastrado"
      linkTo="/admin/agendamentos"
    />
  ),
};

const LeadsFunnelChart: DashboardWidget<GroupCount[]> = {
  id: 'leads.funnel',
  anyModuleKeys: ['kanban'],
  slot: 'chart',
  order: 30,
  load: async () => {
    const { data } = await supabase.from('contact_requests').select('status');
    const rows = (data ?? []) as { status: string }[];
    return LEAD_FUNNEL.map((s) => ({
      label: s.label,
      value: rows.filter((l) => l.status === s.key).length,
      color: s.color,
    }));
  },
  Render: ({ data }) => (
    <BarChart
      title="Funil de leads (contatos)"
      items={data}
      emptyLabel="Nenhum lead cadastrado"
      linkTo="/admin/contatos"
    />
  ),
};

const WhatsAppStatsChart: DashboardWidget<WaStats> = {
  id: 'whatsapp.stats',
  anyModuleKeys: ['kanban'],
  slot: 'chart',
  order: 40,
  load: async ({ period }) => {
    const days = periodDays(period);
    const start = periodStart(days);
    const { data } = await supabase
      .from('whatsapp_message_log')
      .select('status')
      .gte('created_at', start);
    const rows = (data ?? []) as { status: string }[];
    return {
      sent:      rows.filter((m) => ['sent', 'delivered', 'read'].includes(m.status)).length,
      delivered: rows.filter((m) => ['delivered', 'read'].includes(m.status)).length,
      read:      rows.filter((m) => m.status === 'read').length,
      failed:    rows.filter((m) => m.status === 'failed').length,
    };
  },
  Render: ({ data }) => <WaStatsWidget stats={data} />,
};

// ═══════════════════════════════════════════════════════════════════════════
// LISTS
// ═══════════════════════════════════════════════════════════════════════════

const OverdueContactsList: DashboardWidget<OverdueContact[]> = {
  id: 'contacts.overdue',
  anyModuleKeys: ['kanban'],
  slot: 'list',
  order: 10,
  load: async () => {
    const overdueThreshold = new Date(Date.now() - 48 * 3600000).toISOString();
    const { data } = await supabase
      .from('contact_requests')
      .select('id,name,phone,created_at,status')
      .in('status', ['new', 'first_contact'])
      .lt('created_at', overdueThreshold)
      .order('created_at')
      .limit(5);
    return (data ?? []) as OverdueContact[];
  },
  Render: ({ data }) => <OverdueContactsWidget contacts={data} />,
};

const UpcomingVisitsList: DashboardWidget<UpcomingAppointment[]> = {
  id: 'appointments.upcoming',
  anyModuleKeys: ['appointments'],
  slot: 'wide',
  order: 10,
  load: async () => {
    const { data } = await supabase
      .from('visit_appointments')
      .select('id,visitor_name,appointment_date,appointment_time,visit_reason,status')
      .gte('appointment_date', todayIso())
      .lte('appointment_date', daysFromNow(7))
      .in('status', ['pending', 'confirmed'])
      .order('appointment_date')
      .order('appointment_time')
      .limit(6);
    return (data ?? []) as UpcomingAppointment[];
  },
  Render: ({ data }) => (
    <UpcomingVisitsWidget appointments={data} reasonLabels={REASON_LABELS} />
  ),
};

// ── Inadimplência (top 5 parcelas vencidas >30d) ─────────────────────────────
interface InadimplenciaRow {
  id: string;
  student_name: string;
  amount: number;
  paid_amount: number;
  days_overdue: number;
  due_date: string;
}

const InadimplenciaList: DashboardWidget<InadimplenciaRow[]> = {
  id: 'finance.inadimplencia',
  anyModuleKeys: ['financial-installments', 'financial-receivables'],
  slot: 'list',
  order: 20,
  load: async () => {
    const cutoff = daysFromNow(-30);
    const { data } = await supabase
      .from('financial_installments')
      .select('id, amount, paid_amount, due_date, student:students(full_name)')
      .lt('due_date', cutoff)
      .neq('status', 'paid')
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true })
      .limit(5);
    const rows = (data ?? []) as any[];
    const today = new Date();
    return rows.map((r) => {
      const due = new Date(r.due_date);
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      return {
        id: r.id as string,
        student_name: r.student?.full_name ?? '—',
        amount: Number(r.amount ?? 0),
        paid_amount: Number(r.paid_amount ?? 0),
        days_overdue: days,
        due_date: r.due_date as string,
      };
    });
  },
  Render: ({ data }) => (
    <ListCard
      title="Inadimplência · top 5"
      icon={AlertTriangle}
      iconColor="text-red-600"
      iconBg="bg-red-100 dark:bg-red-900/30"
      linkTo="/admin/financeiro/parcelas"
      isEmpty={data.length === 0}
      emptyLabel="Nenhuma parcela vencida há mais de 30 dias"
    >
      <ul className="space-y-2">
        {data.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between text-sm rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-700/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-700 dark:text-gray-200">
                {r.student_name}
              </p>
              <p className="text-[11px] text-gray-400">
                {r.days_overdue}d em atraso · venc. {new Date(r.due_date).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <span className="text-sm font-semibold text-red-600 ml-2 flex-shrink-0">
              {formatBRL(Math.max(r.amount - r.paid_amount, 0))}
            </span>
          </li>
        ))}
      </ul>
    </ListCard>
  ),
};

// ── NFS-e: emitidas × pendentes × canceladas no mês ──────────────────────────
const NfseStatusList: DashboardWidget<{ emitidas: number; pendentes: number; canceladas: number }> = {
  id: 'finance.nfse',
  anyModuleKeys: ['nfse-emitidas'],
  slot: 'list',
  order: 30,
  load: async () => {
    const startMonth = new Date();
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);
    const startIso = startMonth.toISOString();

    const { data } = await supabase
      .from('nfse_emitidas')
      .select('status')
      .gte('created_at', startIso);
    const rows = (data ?? []) as { status: string }[];
    return {
      emitidas: rows.filter((r) => ['autorizada', 'emitida', 'issued'].includes(r.status)).length,
      pendentes: rows.filter((r) => ['pending', 'pendente', 'processing'].includes(r.status)).length,
      canceladas: rows.filter((r) => ['cancelada', 'cancelled'].includes(r.status)).length,
    };
  },
  Render: ({ data }) => (
    <ListCard
      title="NFS-e no mês"
      icon={Receipt}
      iconColor="text-indigo-600"
      iconBg="bg-indigo-100 dark:bg-indigo-900/30"
      linkTo="/admin/financeiro/nfse"
      isEmpty={data.emitidas + data.pendentes + data.canceladas === 0}
      emptyLabel="Nenhuma NFS-e emitida neste mês"
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
          <p className="text-2xl font-bold text-emerald-600">{data.emitidas}</p>
          <p className="text-[11px] text-gray-500">Emitidas</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="text-2xl font-bold text-amber-600">{data.pendentes}</p>
          <p className="text-[11px] text-gray-500">Pendentes</p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-2xl font-bold text-red-500">{data.canceladas}</p>
          <p className="text-[11px] text-gray-500">Canceladas</p>
        </div>
      </div>
    </ListCard>
  ),
};

// ── Alertas de frequência (top 5 críticos) ────────────────────────────────────
interface AlertaFrequenciaRow {
  student_id: string;
  student_name: string;
  pct: number;
  total: number;
}

const AlertasFrequenciaList: DashboardWidget<AlertaFrequenciaRow[]> = {
  id: 'academic.alertas',
  anyModuleKeys: ['academic-alerts', 'attendance'],
  slot: 'list',
  order: 10,
  load: async () => {
    // Últimos 90 dias para ter massa suficiente
    const start = daysFromNow(-90);
    const { data } = await supabase
      .from('student_attendance')
      .select('student_id, status, student:students(id, full_name)')
      .gte('date', start);

    const rows = (data ?? []) as any[];
    const grouped = new Map<string, { name: string; total: number; present: number }>();
    for (const r of rows) {
      const st = r.student;
      if (!st?.id) continue;
      const g = grouped.get(st.id) ?? { name: st.full_name ?? '—', total: 0, present: 0 };
      g.total += 1;
      if (r.status === 'present' || r.status === 'late') g.present += 1;
      grouped.set(st.id, g);
    }
    const out: AlertaFrequenciaRow[] = [];
    for (const [id, g] of grouped) {
      if (g.total < 10) continue;
      const pct = Math.round((g.present / g.total) * 100);
      if (pct >= 75) continue;
      out.push({ student_id: id, student_name: g.name, pct, total: g.total });
    }
    return out.sort((a, b) => a.pct - b.pct).slice(0, 5);
  },
  Render: ({ data }) => (
    <ListCard
      title="Alunos com frequência crítica"
      icon={TrendingDown}
      iconColor="text-red-600"
      iconBg="bg-red-100 dark:bg-red-900/30"
      linkTo="/admin/academico/alertas-frequencia"
      isEmpty={data.length === 0}
      emptyLabel="Nenhum aluno com frequência abaixo de 75%"
    >
      <ul className="space-y-2">
        {data.map((r) => (
          <li
            key={r.student_id}
            className="flex items-center justify-between text-sm rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-700/40"
          >
            <span className="truncate font-medium text-gray-700 dark:text-gray-200 flex-1 min-w-0">
              {r.student_name}
            </span>
            <span className="text-sm font-semibold text-red-600 ml-2">{r.pct}%</span>
          </li>
        ))}
      </ul>
    </ListCard>
  ),
};

// ── Minhas aulas hoje (teacher) ───────────────────────────────────────────────
interface AulaHojeRow {
  id: string;
  start_time: string | null;
  end_time: string | null;
  class_name: string;
  discipline_name: string;
}

const MinhasAulasHojeList: DashboardWidget<AulaHojeRow[]> = {
  id: 'academic.minhas_aulas',
  anyModuleKeys: ['teacher-diary', 'teacher-area'],
  requireRole: ['teacher'],
  slot: 'list',
  order: 5,
  load: async ({ profile }) => {
    const weekday = new Date().getDay();
    const { data } = await supabase
      .from('class_schedules')
      .select('id, start_time, end_time, day_of_week, class:school_classes(name), discipline:disciplines(name)')
      .eq('teacher_id', profile.id)
      .eq('day_of_week', weekday)
      .order('start_time');
    const rows = (data ?? []) as any[];
    return rows.map((r) => ({
      id: r.id as string,
      start_time: r.start_time ?? null,
      end_time: r.end_time ?? null,
      class_name: r.class?.name ?? '—',
      discipline_name: r.discipline?.name ?? '—',
    }));
  },
  Render: ({ data }) => (
    <ListCard
      title="Minhas aulas de hoje"
      icon={Clock}
      linkTo="/admin/area-professor"
      isEmpty={data.length === 0}
      emptyLabel="Você não tem aulas agendadas para hoje"
    >
      <ul className="space-y-2">
        {data.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 text-sm rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-700/40"
          >
            <span className="text-xs font-mono text-brand-primary dark:text-brand-secondary min-w-[56px]">
              {(r.start_time ?? '').slice(0, 5)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-700 dark:text-gray-200">{r.discipline_name}</p>
              <p className="text-[11px] text-gray-400 truncate">{r.class_name}</p>
            </div>
          </li>
        ))}
      </ul>
    </ListCard>
  ),
};

// ── Diário pendente (teacher) ─────────────────────────────────────────────────
const DiarioPendenteList: DashboardWidget<number> = {
  id: 'academic.diario_pendente',
  anyModuleKeys: ['teacher-diary'],
  requireRole: ['teacher'],
  slot: 'list',
  order: 15,
  load: async ({ profile }) => {
    const start = daysFromNow(-7);
    const { count } = await supabase
      .from('class_diary_entries')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', profile.id)
      .gte('entry_date', start)
      .eq('status', 'draft');
    return count ?? 0;
  },
  Render: ({ data }) => (
    <ListCard
      title="Diário pendente"
      icon={BookOpen}
      iconColor="text-amber-600"
      iconBg="bg-amber-100 dark:bg-amber-900/30"
      linkTo="/admin/academico/diario"
      isEmpty={data === 0}
      emptyLabel="Seu diário da última semana está em dia"
    >
      <div className="text-center py-4">
        <p className="text-4xl font-bold text-amber-600">{data}</p>
        <p className="text-xs text-gray-500 mt-1">
          {data === 1 ? 'entrada em rascunho' : 'entradas em rascunho'} (últimos 7 dias)
        </p>
      </div>
    </ListCard>
  ),
};

// ── Provas a corrigir (teacher) ───────────────────────────────────────────────
const ProvasACorrigirList: DashboardWidget<number> = {
  id: 'academic.provas_corrigir',
  anyModuleKeys: ['teacher-exams'],
  requireRole: ['teacher'],
  slot: 'list',
  order: 25,
  load: async ({ profile }) => {
    const { count } = await supabase
      .from('class_exams')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', profile.id)
      .in('status', ['applied', 'aplicada', 'pending_correction']);
    return count ?? 0;
  },
  Render: ({ data }) => (
    <ListCard
      title="Provas a corrigir"
      icon={ClipboardList}
      iconColor="text-indigo-600"
      iconBg="bg-indigo-100 dark:bg-indigo-900/30"
      linkTo="/admin/academico/provas"
      isEmpty={data === 0}
      emptyLabel="Sem provas aguardando correção"
    >
      <div className="text-center py-4">
        <p className="text-4xl font-bold text-indigo-600">{data}</p>
        <p className="text-xs text-gray-500 mt-1">
          {data === 1 ? 'prova aguardando correção' : 'provas aguardando correção'}
        </p>
      </div>
    </ListCard>
  ),
};

// ── Rematrícula (campanha ativa) ──────────────────────────────────────────────
interface RematriculaData {
  campaign_name: string | null;
  total: number;
  confirmed: number;
}

const RematriculaPanel: DashboardWidget<RematriculaData | null> = {
  id: 'academic.rematricula',
  anyModuleKeys: ['secretaria-rematricula'],
  slot: 'list',
  order: 35,
  load: async () => {
    const today = todayIso();
    const { data: campaigns } = await supabase
      .from('reenrollment_campaigns')
      .select('id, title, start_date, end_date')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1);
    const campaign = (campaigns ?? [])[0];
    if (!campaign) return null;
    const { data: apps } = await supabase
      .from('reenrollment_applications')
      .select('status')
      .eq('campaign_id', campaign.id);
    const rows = (apps ?? []) as { status: string }[];
    return {
      campaign_name: campaign.title ?? null,
      total: rows.length,
      confirmed: rows.filter((r) => ['confirmed', 'approved', 'completed'].includes(r.status)).length,
    };
  },
  Render: ({ data }) => {
    if (!data) return (
      <ListCard
        title="Rematrícula"
        icon={TrendingUp}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        linkTo="/admin/secretaria"
        isEmpty
        emptyLabel="Nenhuma campanha de rematrícula ativa"
      />
    );
    const pct = data.total > 0 ? Math.round((data.confirmed / data.total) * 100) : 0;
    return (
      <ListCard
        title={`Rematrícula · ${data.campaign_name ?? 'campanha'}`}
        icon={TrendingUp}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        linkTo="/admin/secretaria"
        isEmpty={false}
      >
        <div className="py-2">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-3xl font-bold text-emerald-600">{pct}%</p>
            <p className="text-xs text-gray-500">
              {data.confirmed} / {data.total} confirmadas
            </p>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </ListCard>
    );
  },
};

// ── Ocorrências recentes ──────────────────────────────────────────────────────
interface OcorrenciaRow {
  id: string;
  student_name: string;
  type: string | null;
  occurrence_date: string;
}

const OcorrenciasRecentesList: DashboardWidget<OcorrenciaRow[]> = {
  id: 'ops.ocorrencias',
  anyModuleKeys: ['occurrences'],
  slot: 'list',
  order: 40,
  load: async () => {
    const { data } = await supabase
      .from('student_occurrences')
      .select('id, type, occurrence_date, student:students(full_name)')
      .order('occurrence_date', { ascending: false })
      .limit(5);
    const rows = (data ?? []) as any[];
    return rows.map((r) => ({
      id: r.id as string,
      type: r.type ?? null,
      occurrence_date: r.occurrence_date as string,
      student_name: r.student?.full_name ?? '—',
    }));
  },
  Render: ({ data }) => (
    <ListCard
      title="Ocorrências recentes"
      icon={AlertCircle}
      iconColor="text-amber-600"
      iconBg="bg-amber-100 dark:bg-amber-900/30"
      linkTo="/admin/ocorrencias"
      isEmpty={data.length === 0}
      emptyLabel="Nenhuma ocorrência registrada"
    >
      <ul className="space-y-2">
        {data.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between text-sm rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-700/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-700 dark:text-gray-200">{r.student_name}</p>
              <p className="text-[11px] text-gray-400 truncate">{r.type ?? 'ocorrência'}</p>
            </div>
            <span className="text-[11px] text-gray-400 ml-2 flex-shrink-0">
              {new Date(r.occurrence_date).toLocaleDateString('pt-BR')}
            </span>
          </li>
        ))}
      </ul>
    </ListCard>
  ),
};

// ── Saídas autorizadas para hoje ──────────────────────────────────────────────
interface SaidaHojeRow {
  id: string;
  student_name: string;
  period: string | null;
  third_party_rel: string | null;
}

const AutorizacoesSaidaHojeList: DashboardWidget<SaidaHojeRow[]> = {
  id: 'ops.saidas_hoje',
  anyModuleKeys: ['exit-authorizations'],
  slot: 'list',
  order: 50,
  load: async () => {
    const today = todayIso();
    const { data } = await supabase
      .from('exit_authorizations')
      .select('id, period, third_party_rel, status, valid_from, valid_until, student:students(full_name)')
      .lte('valid_from', today)
      .gte('valid_until', today)
      .eq('status', 'approved')
      .order('valid_from', { ascending: true })
      .limit(6);
    const rows = (data ?? []) as any[];
    return rows.map((r) => ({
      id: r.id as string,
      period: r.period ?? null,
      third_party_rel: r.third_party_rel ?? null,
      student_name: r.student?.full_name ?? '—',
    }));
  },
  Render: ({ data }) => (
    <ListCard
      title="Saídas autorizadas hoje"
      icon={LogOut}
      iconColor="text-blue-600"
      iconBg="bg-blue-100 dark:bg-blue-900/30"
      linkTo="/admin/autorizacoes-saida"
      isEmpty={data.length === 0}
      emptyLabel="Nenhuma saída autorizada para hoje"
    >
      <ul className="space-y-2">
        {data.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 text-sm rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-700/40"
          >
            <span className="text-xs font-medium text-blue-600 min-w-[56px]">
              {r.period ?? '—'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-700 dark:text-gray-200">{r.student_name}</p>
              {r.third_party_rel && <p className="text-[11px] text-gray-400 truncate">{r.third_party_rel}</p>}
            </div>
          </li>
        ))}
      </ul>
    </ListCard>
  ),
};

// ── Declarações pendentes ─────────────────────────────────────────────────────
interface DeclaracaoRow {
  id: string;
  student_name: string;
  document_type: string;
  requested_at: string;
}

const DeclaracoesPendentesList: DashboardWidget<DeclaracaoRow[]> = {
  id: 'ops.declaracoes',
  anyModuleKeys: ['secretaria-declaracoes'],
  slot: 'list',
  order: 60,
  load: async () => {
    const { data } = await supabase
      .from('document_requests')
      .select('id, status, created_at, template:document_templates(name), student:students(full_name)')
      .in('status', ['pending', 'requested', 'processing'])
      .order('created_at', { ascending: true })
      .limit(5);
    const rows = (data ?? []) as any[];
    return rows.map((r) => ({
      id: r.id as string,
      document_type: r.template?.name ?? '—',
      requested_at: r.created_at as string,
      student_name: r.student?.full_name ?? '—',
    }));
  },
  Render: ({ data }) => (
    <ListCard
      title="Declarações em aberto"
      icon={FileText}
      iconColor="text-purple-600"
      iconBg="bg-purple-100 dark:bg-purple-900/30"
      linkTo="/admin/secretaria"
      isEmpty={data.length === 0}
      emptyLabel="Nenhuma solicitação em aberto"
    >
      <ul className="space-y-2">
        {data.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between text-sm rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-700/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-700 dark:text-gray-200">{r.student_name}</p>
              <p className="text-[11px] text-gray-400 truncate">{r.document_type}</p>
            </div>
            <span className="text-[11px] text-gray-400 ml-2 flex-shrink-0">
              {new Date(r.requested_at).toLocaleDateString('pt-BR')}
            </span>
          </li>
        ))}
      </ul>
    </ListCard>
  ),
};

// ── Minhas turmas (teacher/coord) ─────────────────────────────────────────────
interface TurmaRow {
  id: string;
  name: string;
  school_year: number | null;
  shift: string | null;
}

const MinhasTurmasGrid: DashboardWidget<TurmaRow[]> = {
  id: 'academic.minhas_turmas',
  anyModuleKeys: ['teacher-area'],
  slot: 'wide',
  order: 20,
  load: async ({ profile, hasRole }) => {
    let q = supabase
      .from('school_classes')
      .select('id,name,school_year,shift')
      .eq('is_active', true);
    if (!hasRole('super_admin', 'admin', 'coordinator')) {
      q = q.contains('teacher_ids', [profile.id]);
    }
    const { data } = await q.order('name').limit(9);
    return (data ?? []) as TurmaRow[];
  },
  Render: ({ data }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-primary/10 dark:bg-white/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
          </div>
          <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">
            Minhas turmas
          </h3>
        </div>
        <Link
          to="/admin/area-professor"
          className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1"
        >
          Ver tudo <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      {data.length === 0 ? (
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">Nenhuma turma atribuída</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                to="/admin/area-professor"
                className="flex items-center justify-between text-sm rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors"
              >
                <span className="text-gray-700 dark:text-gray-200 truncate flex-1 min-w-0 font-medium">
                  {c.name}
                </span>
                <span className="text-gray-400 ml-2 flex-shrink-0 text-xs">
                  {c.school_year ?? ''}
                  {c.shift ? ` · ${c.shift}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════════════
export const DASHBOARD_WIDGETS: DashboardWidget<any>[] = [
  // KPIs
  AppointmentsKpi,
  EnrollmentsKpi,
  ContactsKpi,
  FinanceSnapshotKpi,

  // Charts
  EnrollmentFunnelChart,
  AppointmentStatusChart,
  LeadsFunnelChart,
  WhatsAppStatsChart,

  // Lists
  OverdueContactsList,
  InadimplenciaList,
  NfseStatusList,
  AlertasFrequenciaList,
  MinhasAulasHojeList,
  DiarioPendenteList,
  ProvasACorrigirList,
  RematriculaPanel,
  OcorrenciasRecentesList,
  AutorizacoesSaidaHojeList,
  DeclaracoesPendentesList,

  // Wide
  UpcomingVisitsList,
  MinhasTurmasGrid,
];
