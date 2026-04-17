/**
 * SharedDashboard
 *
 * Painel compartilhado entre todos os roles que têm acesso à rota
 * `/admin` (módulo `dashboard`) e que NÃO são `super_admin` — quem
 * decide o roteamento é o `DashboardRouter`.
 *
 * Filosofia
 * ─────────
 * Reaproveita o **mesmo** vocabulário visual do dashboard do
 * super_admin (StatCards com tendência, BarCharts, WaStatsWidget,
 * lista de visitas, contatos pendentes, …) — porém **cada elemento
 * é renderizado apenas quando o usuário tem permissão** sobre o
 * módulo correspondente. Sem permissão = sem fetch e sem widget.
 *
 * Mapa de gating (moduleKey ↔ widget):
 *   appointments  → StatCard "Agendamentos", StatCard "Pendentes",
 *                   BarChart "Agendamentos por status",
 *                   UpcomingVisitsWidget
 *   students      → StatCard "Pré-Matrículas",
 *                   BarChart "Pré-Matrículas por status"
 *   kanban        → StatCard "Contatos", BarChart "Funil de leads",
 *                   BarChart "Contatos por motivo",
 *                   OverdueContactsWidget, WaStatsWidget
 *   teacher-area  → seção "Minhas turmas"
 *
 * Empty-state: se o usuário tem `dashboard.can_view = true` mas
 * nenhum dos widgets é visível para ele, mostramos um card educativo
 * apontando para Configurações.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Clock,
  GraduationCap,
  Loader2,
  Lock,
  MessageSquare,
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import {
  BarChart,
  DashboardHeader,
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

// ── Tabelas de cor / labels (espelham as do DashboardPage do super_admin) ───
const REASON_LABELS: Record<string, string> = {
  conhecer_escola: 'Conhecer a escola',
  matricula: 'Pré-Matrícula',
  entrega_documentos: 'Entrega de docs.',
  conversa_pedagogica: 'Conv. pedagógica',
  outros: 'Outros',
};

const ENROLLMENT_PIPELINE = [
  { key: 'new', label: 'Novo', color: 'bg-blue-500' },
  { key: 'under_review', label: 'Em análise', color: 'bg-purple-500' },
  { key: 'docs_pending', label: 'Docs. pendentes', color: 'bg-amber-500' },
  { key: 'docs_received', label: 'Docs. recebidos', color: 'bg-cyan-500' },
  { key: 'interview_scheduled', label: 'Entrevista', color: 'bg-indigo-500' },
  { key: 'approved', label: 'Aprovado', color: 'bg-emerald-500' },
  { key: 'confirmed', label: 'Confirmado', color: 'bg-green-600' },
  { key: 'archived', label: 'Arquivado', color: 'bg-gray-400' },
];

const APPT_STATUS = [
  { key: 'pending', label: 'Pendente', color: 'bg-amber-400' },
  { key: 'confirmed', label: 'Confirmado', color: 'bg-emerald-500' },
  { key: 'completed', label: 'Realizado', color: 'bg-blue-500' },
  { key: 'cancelled', label: 'Cancelado', color: 'bg-red-400' },
  { key: 'no_show', label: 'Não veio', color: 'bg-gray-400' },
];

const LEAD_FUNNEL = [
  { key: 'new',           label: 'Novos',          color: 'bg-blue-500' },
  { key: 'first_contact', label: '1º contato',      color: 'bg-indigo-500' },
  { key: 'follow_up',     label: 'Follow-up',       color: 'bg-purple-500' },
  { key: 'contacted',     label: 'Contatado',       color: 'bg-cyan-500' },
  { key: 'converted',     label: 'Convertido',      color: 'bg-emerald-500' },
  { key: 'resolved',      label: 'Resolvido',       color: 'bg-green-600' },
  { key: 'closed',        label: 'Encerrado',       color: 'bg-gray-400' },
  { key: 'archived',      label: 'Arquivado',       color: 'bg-gray-300' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'administrador(a)',
  coordinator: 'coordenador(a)',
  teacher: 'professor(a)',
  user: 'colaborador(a)',
};

// ── Estado local ──────────────────────────────────────────────────────────────
interface DashState {
  // Counters do período
  appointments: number;
  prevAppointments: number;
  enrollments: number;
  prevEnrollments: number;
  contacts: number;
  prevContacts: number;
  pendingVisits: number;

  // Agregados
  enrollmentGroups: GroupCount[];
  apptGroups: GroupCount[];
  contactGroups: GroupCount[];
  leadFunnel: GroupCount[];
  waStats: WaStats;
  overdueContacts: OverdueContact[];
  upcoming: UpcomingAppointment[];
}

interface TeacherClassRow {
  id: string;
  name: string;
  school_year: number | null;
  shift: string | null;
}

const EMPTY_STATE: DashState = {
  appointments: 0,
  prevAppointments: 0,
  enrollments: 0,
  prevEnrollments: 0,
  contacts: 0,
  prevContacts: 0,
  pendingVisits: 0,
  enrollmentGroups: [],
  apptGroups: [],
  contactGroups: [],
  leadFunnel: [],
  waStats: { sent: 0, delivered: 0, read: 0, failed: 0 },
  overdueContacts: [],
  upcoming: [],
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SharedDashboard() {
  const { profile, hasRole } = useAdminAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<DashState>(EMPTY_STATE);
  const [classes, setClasses] = useState<TeacherClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Quais widgets estão visíveis para este usuário?
  const showAppointments = canView('appointments');
  const showStudents = canView('students');
  const showKanban = canView('kanban');
  const showTeacher = canView('teacher-area');

  const visibleCount = useMemo(
    () => [showAppointments, showStudents, showKanban, showTeacher].filter(Boolean).length,
    [showAppointments, showStudents, showKanban, showTeacher],
  );

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const days = periodDays(period);
    const start = periodStart(days);
    const prevStart = periodStart(days * 2);

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const overdueThreshold = new Date(Date.now() - 48 * 3600000).toISOString();

    // Cada Promise só roda se a permissão estiver liberada — o usuário
    // sem `appointments` não dispara queries de visit_appointments etc.
    type Counter = { count: number | null };
    const empty: Counter = { count: 0 };

    const [
      apptCurr,
      apptPrev,
      pending,
      allAppt,
      upcomingRes,
      enrCurr,
      enrPrev,
      allEnr,
      contCurr,
      contPrev,
      allCont,
      allLeads,
      waLogs,
      overdue,
      classesRes,
    ] = await Promise.all([
      showAppointments
        ? supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).gte('created_at', start)
        : Promise.resolve(empty),
      showAppointments
        ? supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start)
        : Promise.resolve(empty),
      showAppointments
        ? supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        : Promise.resolve(empty),
      showAppointments
        ? supabase.from('visit_appointments').select('status')
        : Promise.resolve({ data: [] as { status: string }[] }),
      showAppointments
        ? supabase.from('visit_appointments')
            .select('id,visitor_name,appointment_date,appointment_time,visit_reason,status')
            .gte('appointment_date', today)
            .lte('appointment_date', nextWeek)
            .in('status', ['pending', 'confirmed'])
            .order('appointment_date').order('appointment_time').limit(6)
        : Promise.resolve({ data: [] as UpcomingAppointment[] }),

      showStudents
        ? supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('created_at', start)
        : Promise.resolve(empty),
      showStudents
        ? supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start)
        : Promise.resolve(empty),
      showStudents
        ? supabase.from('enrollments').select('status')
        : Promise.resolve({ data: [] as { status: string }[] }),

      showKanban
        ? supabase.from('contact_requests').select('id', { count: 'exact', head: true }).gte('created_at', start)
        : Promise.resolve(empty),
      showKanban
        ? supabase.from('contact_requests').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start)
        : Promise.resolve(empty),
      showKanban
        ? supabase.from('contact_requests').select('contact_reason')
        : Promise.resolve({ data: [] as { contact_reason: string | null }[] }),
      showKanban
        ? supabase.from('contact_requests').select('status')
        : Promise.resolve({ data: [] as { status: string }[] }),
      showKanban
        ? supabase.from('whatsapp_message_log').select('status').gte('created_at', start)
        : Promise.resolve({ data: [] as { status: string }[] }),
      showKanban
        ? supabase.from('contact_requests')
            .select('id,name,phone,created_at,status')
            .in('status', ['new', 'first_contact'])
            .lt('created_at', overdueThreshold)
            .order('created_at')
            .limit(5)
        : Promise.resolve({ data: [] as OverdueContact[] }),

      showTeacher
        ? (() => {
            let q = supabase
              .from('school_classes')
              .select('id,name,school_year,shift')
              .eq('is_active', true);
            // Professor "puro" só vê suas turmas; coord/admin vê tudo.
            if (!hasRole('super_admin', 'admin', 'coordinator')) {
              q = q.contains('teacher_ids', [profile.id]);
            }
            return q.order('name').limit(6);
          })()
        : Promise.resolve({ data: [] as TeacherClassRow[] }),
    ]);

    // ── Aggregations ────────────────────────────────────────────────────────
    const apptData = ((allAppt as { data: { status: string }[] | null }).data ?? []);
    const enrData = ((allEnr as { data: { status: string }[] | null }).data ?? []);
    const contData = ((allCont as { data: { contact_reason: string | null }[] | null }).data ?? []);
    const leadData = ((allLeads as { data: { status: string }[] | null }).data ?? []);
    const waData = ((waLogs as { data: { status: string }[] | null }).data ?? []);

    const reasonMap: Record<string, number> = {};
    contData.forEach((c) => {
      const k = c.contact_reason || 'outros';
      reasonMap[k] = (reasonMap[k] ?? 0) + 1;
    });

    setData({
      appointments: (apptCurr as Counter).count ?? 0,
      prevAppointments: (apptPrev as Counter).count ?? 0,
      pendingVisits: (pending as Counter).count ?? 0,
      enrollments: (enrCurr as Counter).count ?? 0,
      prevEnrollments: (enrPrev as Counter).count ?? 0,
      contacts: (contCurr as Counter).count ?? 0,
      prevContacts: (contPrev as Counter).count ?? 0,

      apptGroups: APPT_STATUS.map((s) => ({
        label: s.label,
        value: apptData.filter((a) => a.status === s.key).length,
        color: s.color,
      })),
      enrollmentGroups: ENROLLMENT_PIPELINE.map((p) => ({
        label: p.label,
        value: enrData.filter((e) => e.status === p.key).length,
        color: p.color,
      })),
      contactGroups: Object.entries(reasonMap).map(([k, v]) => ({
        label: REASON_LABELS[k] || k,
        value: v,
        color: 'bg-brand-primary',
      })),
      leadFunnel: LEAD_FUNNEL.map((s) => ({
        label: s.label,
        value: leadData.filter((l) => l.status === s.key).length,
        color: s.color,
      })),
      waStats: {
        sent:      waData.filter((m) => ['sent', 'delivered', 'read'].includes(m.status)).length,
        delivered: waData.filter((m) => ['delivered', 'read'].includes(m.status)).length,
        read:      waData.filter((m) => m.status === 'read').length,
        failed:    waData.filter((m) => m.status === 'failed').length,
      },
      overdueContacts: ((overdue as { data: OverdueContact[] | null }).data ?? []),
      upcoming: ((upcomingRes as { data: UpcomingAppointment[] | null }).data ?? []),
    });

    setClasses(((classesRes as { data: TeacherClassRow[] | null }).data ?? []));
    setLoading(false);
  }, [profile, period, showAppointments, showStudents, showKanban, showTeacher, hasRole]);

  useEffect(() => {
    if (permsLoading) return;
    fetchData();
  }, [permsLoading, fetchData]);

  // ── Loading inicial ─────────────────────────────────────────────────────────
  if (permsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
      </div>
    );
  }

  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] ?? null : null;
  const description = roleLabel
    ? `Resumo do que você acompanha como ${roleLabel}.`
    : 'Resumo dos seus módulos.';

  // Quantos stat cards o usuário verá? Ajusta o grid pra não deixar lacuna.
  const statSlots = [
    showAppointments && 'appointments',
    showStudents && 'students',
    showKanban && 'kanban',
    showAppointments && 'pending',
  ].filter(Boolean) as string[];
  const statColsClass =
    statSlots.length >= 4 ? 'lg:grid-cols-4'
    : statSlots.length === 3 ? 'lg:grid-cols-3'
    : statSlots.length === 2 ? 'lg:grid-cols-2'
    : 'lg:grid-cols-1';

  return (
    <div>
      <DashboardHeader
        fullName={profile?.full_name ?? null}
        fallbackName={profile?.email?.split('@')[0] ?? null}
        description={description}
        period={period}
        onPeriodChange={setPeriod}
      />

      {visibleCount === 0 ? (
        // ── Empty state ──────────────────────────────────────────────────────
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700/40 flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">
            Nenhum bloco para exibir
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md mx-auto">
            Você ainda não tem acesso a nenhum dos módulos exibidos neste dashboard.
            Solicite ao administrador do sistema o acesso aos módulos que você utiliza.
          </p>
          <Link
            to="/admin/configuracoes"
            className="inline-flex items-center gap-1 mt-4 text-xs font-medium text-brand-primary dark:text-brand-secondary hover:underline"
          >
            Ir para Configurações
          </Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Stat cards (somente os módulos liberados) ───────────────── */}
          {statSlots.length > 0 && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${statColsClass} gap-4 mb-6`}>
              {showAppointments && (
                <StatCard
                  label="Agendamentos"
                  value={data.appointments}
                  prev={data.prevAppointments}
                  icon={CalendarCheck}
                  colorClass="text-blue-600"
                  iconBg="bg-blue-100 dark:bg-blue-900/30"
                  linkTo="/admin/agendamentos"
                />
              )}
              {showStudents && (
                <StatCard
                  label="Pré-Matrículas"
                  value={data.enrollments}
                  prev={data.prevEnrollments}
                  icon={GraduationCap}
                  colorClass="text-emerald-600"
                  iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                  linkTo="/admin/matriculas"
                />
              )}
              {showKanban && (
                <StatCard
                  label="Contatos"
                  value={data.contacts}
                  prev={data.prevContacts}
                  icon={MessageSquare}
                  colorClass="text-purple-600"
                  iconBg="bg-purple-100 dark:bg-purple-900/30"
                  linkTo="/admin/contatos"
                />
              )}
              {showAppointments && (
                <StatCard
                  label="Pendentes de confirmação"
                  value={data.pendingVisits}
                  icon={Clock}
                  colorClass="text-amber-600"
                  iconBg="bg-amber-100 dark:bg-amber-900/30"
                  linkTo="/admin/agendamentos"
                  rightLabel="Visitas"
                />
              )}
            </div>
          )}

          {/* ── Charts row 1: matrículas + agendamentos ─────────────────── */}
          {(showStudents || showAppointments) && (
            <div className="grid lg:grid-cols-2 gap-4 mb-4">
              {showStudents && (
                <BarChart
                  title="Pré-Matrículas por status"
                  items={data.enrollmentGroups}
                  emptyLabel="Nenhuma pré-matrícula cadastrada"
                  linkTo="/admin/matriculas"
                />
              )}
              {showAppointments && (
                <BarChart
                  title="Agendamentos por status"
                  items={data.apptGroups}
                  emptyLabel="Nenhum agendamento cadastrado"
                  linkTo="/admin/agendamentos"
                />
              )}
            </div>
          )}

          {/* ── Charts row 2: leads + WhatsApp ──────────────────────────── */}
          {showKanban && (
            <div className="grid lg:grid-cols-2 gap-4 mb-4">
              <BarChart
                title="Funil de leads (contatos)"
                items={data.leadFunnel}
                emptyLabel="Nenhum lead cadastrado"
                linkTo="/admin/contatos"
              />
              <WaStatsWidget stats={data.waStats} />
            </div>
          )}

          {/* ── Bottom row: motivos + contatos pendentes ────────────────── */}
          {showKanban && (
            <div className="grid lg:grid-cols-2 gap-4">
              <BarChart
                title="Contatos por motivo"
                items={data.contactGroups}
                emptyLabel="Nenhum contato recebido"
                linkTo="/admin/contatos"
              />
              <OverdueContactsWidget contacts={data.overdueContacts} />
            </div>
          )}

          {/* ── Próximas visitas (full width) ───────────────────────────── */}
          {showAppointments && (
            <div className="mt-4">
              <UpcomingVisitsWidget appointments={data.upcoming} reasonLabels={REASON_LABELS} />
            </div>
          )}

          {/* ── Minhas turmas (apenas quem tem teacher-area) ────────────── */}
          {showTeacher && (
            <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
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

              {classes.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Nenhuma turma atribuída
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {classes.map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/admin/area-professor"
                        className="flex items-center justify-between text-sm rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors"
                      >
                        <span className="text-gray-700 dark:text-gray-200 truncate flex-1 min-w-0 font-medium">
                          {c.name}
                        </span>
                        <span className="text-gray-400 ml-2 flex-shrink-0 text-xs">
                          {c.school_year ?? ''}{c.shift ? ` · ${c.shift}` : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
