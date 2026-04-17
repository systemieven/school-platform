/**
 * AcademicoDashboardPage
 *
 * Primeira aba do modulo academico.
 * KPIs fixos + widget "Proximos Eventos" + grid de graficos personalizaveis.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Users, Activity, BarChart3, AlertTriangle,
  CalendarDays, Loader2, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import DashboardChartGrid from '../../components/DashboardChartGrid';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AcademicKPIs {
  totalStudents: number;
  totalClasses: number;
  totalCapacity: number;
  attendanceIndex: number | null;   // media % presenca
  gradeAverage: number | null;      // media das medias finais
  alertsActive: number;
  eventsThisWeek: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  type: string;
  color: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function occupancyPct(students: number, capacity: number) {
  if (!capacity) return null;
  return Math.round((students / capacity) * 100);
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  feriado: 'Feriado', recesso: 'Recesso', prova: 'Prova',
  evento: 'Evento', reuniao: 'Reunião', outro: 'Outro',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AcademicoDashboardPage() {
  const [kpis, setKpis] = useState<AcademicKPIs | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [classesRes, attRes, resultsRes, calRes] = await Promise.all([
      supabase
        .from('school_classes')
        .select('id, name, capacity, students(id)')
        .eq('is_active', true),
      supabase
        .from('student_attendance')
        .select('status')
        .in('status', ['present', 'absent', 'late', 'justified'])
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .lte('date', today),
      supabase
        .from('student_results')
        .select('final_average, attendance_status')
        .not('final_average', 'is', null),
      supabase
        .from('school_calendar_events')
        .select('id, title, event_date, type, color')
        .gte('event_date', today)
        .lte('event_date', in30Days)
        .order('event_date')
        .limit(10),
    ]);

    type ClassRow = { id: string; capacity: number | null; students: { id: string }[] };
    const classes = ((classesRes.data ?? []) as unknown as ClassRow[]);
    const totalStudents = classes.reduce((s, c) => s + c.students.length, 0);
    const totalCapacity = classes.reduce((s, c) => s + (c.capacity ?? 0), 0);

    type AttRow = { status: string };
    const att = (attRes.data ?? []) as AttRow[];
    const attPresent = att.filter((r) => r.status === 'present' || r.status === 'late').length;
    const attIndex = att.length ? Math.round((attPresent / att.length) * 100) : null;

    type ResultRow = { final_average: number; attendance_status: string };
    const results = (resultsRes.data ?? []) as ResultRow[];
    const gradeAvg = results.length
      ? Math.round((results.reduce((s, r) => s + Number(r.final_average), 0) / results.length) * 10) / 10
      : null;
    const alertsActive = results.filter((r) => r.attendance_status === 'critical' || r.attendance_status === 'warning').length;

    const allCalEvents = ((calRes.data ?? []) as CalendarEvent[]);
    const weekEvents = allCalEvents.filter((e) => e.event_date <= in7Days);

    setKpis({
      totalStudents,
      totalClasses: classes.length,
      totalCapacity,
      attendanceIndex: attIndex,
      gradeAverage: gradeAvg,
      alertsActive,
      eventsThisWeek: weekEvents.length,
    });
    setEvents(allCalEvents.slice(0, 5));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!kpis) return null;

  const occ = occupancyPct(kpis.totalStudents, kpis.totalCapacity);

  const kpiCards = [
    {
      label: 'Taxa de Ocupação',
      value: occ != null ? `${occ}%` : `${kpis.totalStudents}`,
      sub: `${kpis.totalStudents} alunos em ${kpis.totalClasses} turmas`,
      icon: Users,
      color: 'blue',
    },
    {
      label: 'Índice de Frequência',
      value: kpis.attendanceIndex != null ? `${kpis.attendanceIndex}%` : '—',
      sub: 'Últimos 30 dias',
      icon: Activity,
      color: kpis.attendanceIndex == null ? 'gray'
           : kpis.attendanceIndex >= 80 ? 'emerald'
           : kpis.attendanceIndex >= 60 ? 'amber'
           : 'red',
    },
    {
      label: 'Média Geral',
      value: kpis.gradeAverage != null ? String(kpis.gradeAverage) : '—',
      sub: 'Último período fechado',
      icon: BarChart3,
      color: kpis.gradeAverage == null ? 'gray'
           : kpis.gradeAverage >= 7 ? 'emerald'
           : kpis.gradeAverage >= 5 ? 'amber'
           : 'red',
    },
    {
      label: 'Alertas Ativos',
      value: String(kpis.alertsActive),
      sub: 'Alunos com frequência baixa',
      icon: AlertTriangle,
      color: kpis.alertsActive === 0 ? 'emerald' : kpis.alertsActive <= 5 ? 'amber' : 'red',
    },
    {
      label: 'Eventos esta Semana',
      value: String(kpis.eventsThisWeek),
      sub: 'No calendário letivo (7 dias)',
      icon: CalendarDays,
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const c = card.color;
          return (
            <div
              key={card.label}
              className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">
                  {card.label}
                </span>
                <div className={`p-2 rounded-xl bg-${c}-50 dark:bg-${c}-900/20`}>
                  <Icon className={`w-4 h-4 text-${c}-500`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Alerts banner */}
      {kpis.alertsActive > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {kpis.alertsActive} aluno{kpis.alertsActive !== 1 ? 's' : ''} com alertas de frequência
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Acesse a aba "Alertas de Frequência" para ver detalhes e notificar responsáveis.
            </p>
          </div>
        </div>
      )}

      {/* Proximos eventos + Chart grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Proximos eventos */}
        <div className="xl:col-span-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">Próximos Eventos</h3>
            </div>
          </div>
          {events.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Sem eventos nos próximos 30 dias</p>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2.5 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: ev.color ?? '#6366f1' }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{ev.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {fmtDate(ev.event_date)} · {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              // Dispatch a custom event to switch to the 'calendario' tab
              window.dispatchEvent(new CustomEvent('academico:switch-tab', { detail: 'calendario' }));
            }}
            className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-brand-primary hover:text-brand-primary-dark font-medium transition-colors"
          >
            Ver calendário completo <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Chart grid */}
        <div className="xl:col-span-3">
          <DashboardChartGrid module="academico" />
        </div>
      </div>
    </div>
  );
}
