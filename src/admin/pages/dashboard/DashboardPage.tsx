import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { supabase } from '../../../lib/supabase';
import {
  CalendarCheck, GraduationCap, MessageSquare, Clock, Loader2,
  ChevronRight, TrendingUp, TrendingDown, Minus,
  AlertCircle, CheckCircle2, Send, Eye,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Period = 'today' | '7d' | '30d';

interface PeriodStats {
  appointments: number;
  enrollments: number;
  contacts: number;
  pendingVisits: number;
  prevAppointments: number;
  prevEnrollments: number;
  prevContacts: number;
}

interface WaStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

interface OverdueContact {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  status: string;
}

interface GroupCount { label: string; value: number; color: string }

interface UpcomingAppointment {
  id: string;
  visitor_name: string;
  appointment_date: string;
  appointment_time: string;
  visit_reason: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function periodDays(p: Period) {
  return p === 'today' ? 1 : p === '7d' ? 7 : 30;
}

function periodStart(days: number, offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days - offset);
  if (days === 1) {
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

function fmtTime(t: string) { return t.slice(0, 5); }

function pct(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

const REASON_LABELS: Record<string, string> = {
  conhecer_escola: 'Conhecer a escola', matricula: 'Pré-Matrícula',
  entrega_documentos: 'Entrega de docs.', conversa_pedagogica: 'Conv. pedagógica', outros: 'Outros',
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

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ items, title, emptyLabel, linkTo }: {
  items: GroupCount[]; title: string; emptyLabel: string; linkTo: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">{title}</h3>
        <Link to={linkTo} className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1">
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      {items.filter((i) => i.value > 0).length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">
          {items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value).map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-28 text-xs text-right text-gray-500 dark:text-gray-400 truncate flex-shrink-0">{item.label}</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${item.color} transition-all duration-500`}
                  style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }}
                />
              </div>
              <span className="w-6 text-xs font-bold text-gray-700 dark:text-gray-300 text-right flex-shrink-0">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, prev, icon: Icon, colorClass, iconBg, linkTo }: {
  label: string; value: number; prev: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string; iconBg: string; linkTo: string;
}) {
  const change = pct(value, prev);
  return (
    <Link to={linkTo} className="block bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${
          change > 0 ? 'text-emerald-600 dark:text-emerald-400' :
          change < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'
        }`}>
          {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> :
           change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> :
           <Minus className="w-3.5 h-3.5" />}
          {prev > 0 ? `${Math.abs(change)}%` : '—'}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-800 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 group-hover:text-brand-primary dark:group-hover:text-brand-secondary transition-colors">{label}</p>
    </Link>
  );
}

// ── WA Stats Widget ───────────────────────────────────────────────────────────
function WaStatsWidget({ stats }: { stats: WaStats }) {
  const items = [
    { label: 'Enviadas',   value: stats.sent,      icon: Send,         color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Entregues',  value: stats.delivered, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Lidas',      value: stats.read,      icon: Eye,          color: 'text-purple-500',  bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Falhas',     value: stats.failed,    icon: AlertCircle,  color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-900/20' },
  ];
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">Mensagens WhatsApp</h3>
        <Link to="/admin/configuracoes" className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1">
          Ver histórico <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`flex items-center gap-2.5 rounded-xl p-3 ${item.bg}`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-white leading-none">{item.value}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Overdue Contacts Widget ───────────────────────────────────────────────────
function OverdueContactsWidget({ contacts }: { contacts: OverdueContact[] }) {
  function hoursAgo(dateStr: string) {
    const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">Contatos pendentes</h3>
          {contacts.length > 0 && (
            <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {contacts.length}
            </span>
          )}
        </div>
        <Link to="/admin/contatos" className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1">
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">Nenhum contato sem resposta</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <Link
              key={c.id}
              to="/admin/contatos"
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            >
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.phone}</p>
              </div>
              <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 flex-shrink-0">
                {hoursAgo(c.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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

    // Enrollment pipeline groups
    const enrData = (allEnr.data ?? []) as { status: string }[];
    setEnrollmentGroups(ENROLLMENT_PIPELINE.map((p) => ({
      label: p.label,
      value: enrData.filter((e) => e.status === p.key).length,
      color: p.color,
    })));

    // Appointment status groups
    const apptData = (allAppt.data ?? []) as { status: string }[];
    setApptGroups(APPT_STATUS.map((s) => ({
      label: s.label,
      value: apptData.filter((a) => a.status === s.key).length,
      color: s.color,
    })));

    // Contact reason groups
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

    // Lead funnel
    const leadData = (allLeads.data ?? []) as { status: string }[];
    setLeadFunnel(LEAD_FUNNEL.map((s) => ({
      label: s.label,
      value: leadData.filter((l) => l.status === s.key).length,
      color: s.color,
    })));

    // WhatsApp stats
    const waData = (waLogs.data ?? []) as { status: string }[];
    setWaStats({
      sent:      waData.filter((m) => ['sent', 'delivered', 'read'].includes(m.status)).length,
      delivered: waData.filter((m) => ['delivered', 'read'].includes(m.status)).length,
      read:      waData.filter((m) => m.status === 'read').length,
      failed:    waData.filter((m) => m.status === 'failed').length,
    });

    // Overdue contacts
    setOverdueContacts((overdue.data ?? []) as OverdueContact[]);

    setUpcoming((upcomingRes.data ?? []) as UpcomingAppointment[]);
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const PERIOD_OPTS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-primary dark:text-white">
            {greeting}, {profile?.full_name?.split(' ')[0] || 'Administrador'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Aqui está o resumo do seu painel.</p>
        </div>

        {/* Period selector */}
        <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 gap-1">
          {PERIOD_OPTS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === opt.key
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
            <Link to="/admin/agendamentos" className="block bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-xs text-gray-400">Visitas</span>
              </div>
              <p className="text-3xl font-bold text-gray-800 dark:text-white">{stats!.pendingVisits}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 group-hover:text-brand-primary dark:group-hover:text-brand-secondary transition-colors">Pendentes de confirmação</p>
            </Link>
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
            {/* Contact reasons */}
            <BarChart
              title="Contatos por motivo"
              items={contactGroups}
              emptyLabel="Nenhum contato recebido"
              linkTo="/admin/contatos"
            />

            {/* Overdue contacts */}
            <OverdueContactsWidget contacts={overdueContacts} />
          </div>

          {/* Upcoming appointments — full width */}
          <div className="mt-4">
            {/* Upcoming appointments */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">Próximas visitas (7 dias)</h3>
                <Link to="/admin/agendamentos" className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1">
                  Ver todos <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {upcoming.length === 0 ? (
                <div className="text-center py-6">
                  <CalendarCheck className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 dark:text-gray-500">Nenhuma visita nos próximos 7 dias</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((apt) => (
                    <Link
                      key={apt.id}
                      to="/admin/agendamentos"
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
                    >
                      <div className="w-9 h-9 bg-brand-primary/10 dark:bg-white/10 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-brand-primary dark:text-brand-secondary uppercase leading-none">
                          {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                        </span>
                        <span className="text-sm font-bold text-brand-primary dark:text-brand-secondary leading-none">
                          {new Date(apt.appointment_date + 'T00:00:00').getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{apt.visitor_name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {fmtTime(apt.appointment_time)} · {REASON_LABELS[apt.visit_reason] || apt.visit_reason}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        apt.status === 'confirmed'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {apt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
