/**
 * DashboardPage (super_admin)
 *
 * Painel cheio para super_admin. Reúne KPIs do período (com tendência
 * vs. período anterior), funis (matrículas / agendamentos / contatos
 * por motivo / leads), métricas de WhatsApp, contatos sem resposta e
 * próximas visitas. Os componentes visuais vivem em `./widgets/` para
 * serem reaproveitados pelo SharedDashboard (demais perfis).
 */
import { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { supabase } from '../../../lib/supabase';
import { CalendarCheck, GraduationCap, MessageSquare, Clock, Loader2 } from 'lucide-react';

import {
  DashboardHeader,
  periodDays,
  periodStart,
  StatCard,
  BarChart,
  WaStatsWidget,
  OverdueContactsWidget,
  UpcomingVisitsWidget,
} from './widgets';
import type {
  Period,
  GroupCount,
  WaStats,
  OverdueContact,
  UpcomingAppointment,
} from './widgets';

// ── Types locais ──────────────────────────────────────────────────────────────
interface PeriodStats {
  appointments: number;
  enrollments: number;
  contacts: number;
  pendingVisits: number;
  prevAppointments: number;
  prevEnrollments: number;
  prevContacts: number;
}

// ── Tabelas de cor / labels ───────────────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { profile } = useAdminAuth();
  const [period, setPeriod] = useState<Period>('7d');
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [enrollmentGroups, setEnrollmentGroups] = useState<GroupCount[]>([]);
  const [apptGroups, setApptGroups] = useState<GroupCount[]>([]);
  const [contactGroups, setContactGroups] = useState<GroupCount[]>([]);
  const [leadFunnel, setLeadFunnel] = useState<GroupCount[]>([]);
  const [waStats, setWaStats] = useState<WaStats>({ sent: 0, delivered: 0, read: 0, failed: 0 });
  const [overdueContacts, setOverdueContacts] = useState<OverdueContact[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const days = periodDays(period);
    const start = periodStart(days);
    const prevStart = periodStart(days * 2);

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const overdueThreshold = new Date(Date.now() - 48 * 3600000).toISOString();

    const [
      apptCurr, apptPrev, enrCurr, enrPrev, contCurr, contPrev,
      pending, allEnr, allAppt, allCont, upcomingRes,
      allLeads, waLogs, overdue,
    ] = await Promise.all([
      supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start),
      supabase.from('contact_requests').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('contact_requests').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start),
      supabase.from('visit_appointments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('enrollments').select('status'),
      supabase.from('visit_appointments').select('status'),
      supabase.from('contact_requests').select('contact_reason'),
      supabase.from('visit_appointments')
        .select('id,visitor_name,appointment_date,appointment_time,visit_reason,status')
        .gte('appointment_date', today)
        .lte('appointment_date', nextWeek)
        .in('status', ['pending', 'confirmed'])
        .order('appointment_date').order('appointment_time').limit(6),
      supabase.from('contact_requests').select('status'),
      supabase.from('whatsapp_message_log').select('status').gte('created_at', start),
      supabase.from('contact_requests')
        .select('id,name,phone,created_at,status')
        .in('status', ['new', 'first_contact'])
        .lt('created_at', overdueThreshold)
        .order('created_at')
        .limit(5),
    ]);

    setStats({
      appointments: apptCurr.count ?? 0,
      enrollments: enrCurr.count ?? 0,
      contacts: contCurr.count ?? 0,
      pendingVisits: pending.count ?? 0,
      prevAppointments: apptPrev.count ?? 0,
      prevEnrollments: enrPrev.count ?? 0,
      prevContacts: contPrev.count ?? 0,
    });

    const enrData = (allEnr.data ?? []) as { status: string }[];
    setEnrollmentGroups(ENROLLMENT_PIPELINE.map((p) => ({
      label: p.label,
      value: enrData.filter((e) => e.status === p.key).length,
      color: p.color,
    })));

    const apptData = (allAppt.data ?? []) as { status: string }[];
    setApptGroups(APPT_STATUS.map((s) => ({
      label: s.label,
      value: apptData.filter((a) => a.status === s.key).length,
      color: s.color,
    })));

    const contData = (allCont.data ?? []) as { contact_reason: string | null }[];
    const reasonMap: Record<string, number> = {};
    contData.forEach((c) => {
      const k = c.contact_reason || 'outros';
      reasonMap[k] = (reasonMap[k] ?? 0) + 1;
    });
    setContactGroups(
      Object.entries(reasonMap).map(([k, v]) => ({
        label: REASON_LABELS[k] || k,
        value: v,
        color: 'bg-brand-primary',
      })),
    );

    const leadData = (allLeads.data ?? []) as { status: string }[];
    setLeadFunnel(LEAD_FUNNEL.map((s) => ({
      label: s.label,
      value: leadData.filter((l) => l.status === s.key).length,
      color: s.color,
    })));

    const waData = (waLogs.data ?? []) as { status: string }[];
    setWaStats({
      sent:      waData.filter((m) => ['sent', 'delivered', 'read'].includes(m.status)).length,
      delivered: waData.filter((m) => ['delivered', 'read'].includes(m.status)).length,
      read:      waData.filter((m) => m.status === 'read').length,
      failed:    waData.filter((m) => m.status === 'failed').length,
    });

    setOverdueContacts((overdue.data ?? []) as OverdueContact[]);
    setUpcoming((upcomingRes.data ?? []) as UpcomingAppointment[]);
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <DashboardHeader
        fullName={profile?.full_name ?? null}
        fallbackName={profile?.email?.split('@')[0] ?? 'Administrador'}
        period={period}
        onPeriodChange={setPeriod}
      />

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Agendamentos" value={stats!.appointments} prev={stats!.prevAppointments}
              icon={CalendarCheck} colorClass="text-blue-600" iconBg="bg-blue-100 dark:bg-blue-900/30"
              linkTo="/admin/agendamentos"
            />
            <StatCard
              label="Pré-Matrículas" value={stats!.enrollments} prev={stats!.prevEnrollments}
              icon={GraduationCap} colorClass="text-emerald-600" iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              linkTo="/admin/matriculas"
            />
            <StatCard
              label="Contatos" value={stats!.contacts} prev={stats!.prevContacts}
              icon={MessageSquare} colorClass="text-purple-600" iconBg="bg-purple-100 dark:bg-purple-900/30"
              linkTo="/admin/contatos"
            />
            <StatCard
              label="Pendentes de confirmação" value={stats!.pendingVisits}
              icon={Clock} colorClass="text-amber-600" iconBg="bg-amber-100 dark:bg-amber-900/30"
              linkTo="/admin/agendamentos" rightLabel="Visitas"
            />
          </div>

          {/* Charts row */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <BarChart
              title="Pré-Matrículas por status"
              items={enrollmentGroups}
              emptyLabel="Nenhuma pré-matrícula cadastrada"
              linkTo="/admin/matriculas"
            />
            <BarChart
              title="Agendamentos por status"
              items={apptGroups}
              emptyLabel="Nenhum agendamento cadastrado"
              linkTo="/admin/agendamentos"
            />
          </div>

          {/* Lead funnel + WA stats */}
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <BarChart
              title="Funil de leads (contatos)"
              items={leadFunnel}
              emptyLabel="Nenhum lead cadastrado"
              linkTo="/admin/contatos"
            />
            <WaStatsWidget stats={waStats} />
          </div>

          {/* Bottom row */}
          <div className="grid lg:grid-cols-2 gap-4">
            <BarChart
              title="Contatos por motivo"
              items={contactGroups}
              emptyLabel="Nenhum contato recebido"
              linkTo="/admin/contatos"
            />
            <OverdueContactsWidget contacts={overdueContacts} />
          </div>

          {/* Upcoming appointments — full width */}
          <div className="mt-4">
            <UpcomingVisitsWidget appointments={upcoming} reasonLabels={REASON_LABELS} />
          </div>
        </>
      )}
    </div>
  );
}
