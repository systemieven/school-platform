/**
 * AgendarVisita — Agendamento de visitas presenciais (estilo cal.com)
 *
 * Fluxo:
 *  Step 1 → Identificação: nome, celular, e-mail, motivo, acompanhantes
 *  Step 2 → Data e horário: calendário mensal + slots disponíveis
 *  Step 3 → Confirmação: resumo completo + feedback de sucesso
 *
 * Dados pré-preenchidos quando vindo de /contato (via location.state)
 *
 * Slots consultados em tempo real no Supabase (visit_appointments).
 * Datas bloqueadas vindas de visit_blocked_dates.
 * Configurações hardcoded por enquanto; futuramente vindas de visit_settings.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  User, Phone, Mail, CalendarDays, Clock, MapPin, ChevronLeft,
  ChevronRight, ArrowRight, ArrowLeft, CheckCircle, Plus, X,
  Users, FileText, Loader2, Building2, AlertTriangle, Edit3,
  BookOpen, BookMarked, GraduationCap, MessageCircle, MessageSquare,
  Calendar, ClipboardList, PenLine, Briefcase, Heart, Star,
  Home, HelpCircle, Award, UserCheck, Handshake, Baby, Bus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveConsent } from '../lib/consent';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useSettings } from '../hooks/useSettings';
import { useSEO } from '../hooks/useSEO';
import LegalConsent from '../components/LegalConsent';
import HeroMedia from '../components/HeroMedia';
import { InputField } from '../admin/components/FormField';

// ─── Fallback constants (used when DB settings are not yet loaded) ───────────

interface VisitAvailabilityInterval {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

interface VisitReason {
  key: string;
  label: string;
  icon?: string;
  duration_minutes: number;
  buffer_minutes: number;
  max_per_slot: number;
  max_daily: number;
  availability_enabled: boolean;
  /** 0 = Dom ... 6 = Sáb. Lista vazia = motivo indisponível. */
  availability_weekdays: number[];
  /** 1..3 intervalos não-sobrepostos. */
  availability_intervals: VisitAvailabilityInterval[];
  lead_integrated: boolean;
  /** Antecedência mínima em horas. 0 = sem restrição. */
  min_advance_hours: number;
}

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const DEFAULT_VISIT_REASONS: VisitReason[] = [
  { key: 'conhecer_estrutura',     label: 'Conhecer a estrutura',       icon: 'Building2', duration_minutes: 60, buffer_minutes: 0, max_per_slot: 2, max_daily: 0, availability_enabled: false, availability_weekdays: [...ALL_WEEKDAYS], availability_intervals: [], lead_integrated: false, min_advance_hours: 0 },
  { key: 'coordenacao',            label: 'Conversar com coordenação',  icon: 'Users',     duration_minutes: 60, buffer_minutes: 0, max_per_slot: 2, max_daily: 0, availability_enabled: false, availability_weekdays: [...ALL_WEEKDAYS], availability_intervals: [], lead_integrated: false, min_advance_hours: 0 },
  { key: 'gestora',                label: 'Conversar com a gestora',    icon: 'User',      duration_minutes: 60, buffer_minutes: 0, max_per_slot: 2, max_daily: 0, availability_enabled: false, availability_weekdays: [...ALL_WEEKDAYS], availability_intervals: [], lead_integrated: false, min_advance_hours: 0 },
  { key: 'entrega_documentos',     label: 'Entrega de documentos',      icon: 'FileText',  duration_minutes: 60, buffer_minutes: 0, max_per_slot: 2, max_daily: 0, availability_enabled: false, availability_weekdays: [...ALL_WEEKDAYS], availability_intervals: [], lead_integrated: false, min_advance_hours: 0 },
  { key: 'assinatura_contratos',   label: 'Assinatura de contratos',    icon: 'FileText',  duration_minutes: 60, buffer_minutes: 0, max_per_slot: 2, max_daily: 0, availability_enabled: false, availability_weekdays: [...ALL_WEEKDAYS], availability_intervals: [], lead_integrated: false, min_advance_hours: 0 },
  { key: 'solicitacao_documentos', label: 'Solicitação de documentos',  icon: 'FileText',  duration_minutes: 60, buffer_minutes: 0, max_per_slot: 2, max_daily: 0, availability_enabled: false, availability_weekdays: [...ALL_WEEKDAYS], availability_intervals: [], lead_integrated: false, min_advance_hours: 0 },
];

/**
 * Normaliza um raw reason do banco (que pode estar no formato legacy
 * `availability_start`/`availability_end`) para o shape novo com
 * `availability_weekdays` e `availability_intervals`.
 */
function normalizeLegacyAvailability(raw: Record<string, unknown>): {
  availability_weekdays: number[];
  availability_intervals: VisitAvailabilityInterval[];
} {
  const weekdays =
    Array.isArray(raw.availability_weekdays) &&
    (raw.availability_weekdays as unknown[]).every((n) => typeof n === 'number')
      ? (raw.availability_weekdays as number[])
      : [...ALL_WEEKDAYS];
  let intervals: VisitAvailabilityInterval[] = [];
  if (Array.isArray(raw.availability_intervals)) {
    intervals = (raw.availability_intervals as Array<Record<string, unknown>>)
      .filter((i) => typeof i.start === 'string' && typeof i.end === 'string')
      .map((i) => ({ start: String(i.start), end: String(i.end) }));
  } else if (typeof raw.availability_start === 'string' && typeof raw.availability_end === 'string' && raw.availability_start && raw.availability_end) {
    intervals = [{ start: String(raw.availability_start), end: String(raw.availability_end) }];
  }
  return { availability_weekdays: weekdays, availability_intervals: intervals };
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Users, User, FileText,
  BookOpen, BookMarked, GraduationCap, MessageCircle, MessageSquare,
  Calendar, ClipboardList, PenLine, Briefcase, Heart, Star,
  Phone, Mail, Home, HelpCircle, Award, UserCheck, Handshake, Baby, Bus,
};

const MAX_COMPANIONS = 3;

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Gera slots encaixados dentro de cada intervalo da lista. Cada intervalo é
 * tratado como um bloco contínuo — o espaço entre dois intervalos (ex.:
 * pausa de almoço) é automaticamente ignorado porque slots só são gerados
 * dentro dos próprios intervalos.
 */
function generateSlotsForIntervals(
  intervals: { start: string; end: string }[],
  slotInterval: number,
  reasonDuration: number,
): string[] {
  const unique = new Set<string>();
  for (const iv of intervals) {
    const s = timeToMinutes(iv.start);
    const e = timeToMinutes(iv.end);
    for (let t = s; t + reasonDuration <= e; t += slotInterval) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      unique.add(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return Array.from(unique).sort();
}

/** Interseção de dois intervalos. Retorna null se não há overlap. */
function intersectIntervals(
  a: { start: string; end: string },
  b: { start: string; end: string },
): { start: string; end: string } | null {
  const start = a.start > b.start ? a.start : b.start;
  const end   = a.end   < b.end   ? a.end   : b.end;
  return start < end ? { start, end } : null;
}

/**
 * Extrai os intervalos de funcionamento do dia da semana a partir de
 * `general.business_hours`. Retorna [] se o dia estiver fechado ou o config
 * não existir. Aceita tanto o shape novo (`intervals: [...]`) quanto o legado
 * (`start` + `end`).
 */
function getBusinessIntervalsForWeekday(
  rawBH: unknown,
  weekday: number,
): { start: string; end: string }[] {
  if (!rawBH) return [];
  let bh: Record<string, { open?: boolean; intervals?: Array<{ start?: string; end?: string }>; start?: string; end?: string }>;
  try {
    bh = typeof rawBH === 'string' ? JSON.parse(rawBH) : (rawBH as Record<string, never>);
  } catch {
    return [];
  }
  const d = bh?.[String(weekday)];
  if (!d?.open) return [];
  if (Array.isArray(d.intervals) && d.intervals.length > 0) {
    return d.intervals
      .filter((i) => typeof i.start === 'string' && typeof i.end === 'string')
      .map((i) => ({ start: i.start as string, end: i.end as string }));
  }
  if (typeof d.start === 'string' && typeof d.end === 'string') {
    return [{ start: d.start, end: d.end }];
  }
  return [];
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isToday(d: Date) { return isSameDay(d, new Date()); }

function isPast(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}


function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(d: Date) {
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatTimeRange(time: string, durationMin = 60) {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + durationMin;
  const endH = Math.floor(totalMin / 60);
  const endM = totalMin % 60;
  return `${time} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Dados' },
    { n: 2, label: 'Horário' },
    { n: 3, label: 'Confirmação' },
  ];
  return (
    <div className="flex items-center justify-center gap-3">
      {steps.map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
              ${n < current
                ? 'bg-brand-secondary text-brand-primary'
                : n === current
                  ? 'bg-brand-primary text-white ring-4 ring-brand-primary/20'
                  : 'bg-gray-100 text-gray-400'
              }
            `}>
              {n < current ? <CheckCircle className="w-4 h-4" /> : n}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${
              n <= current ? 'text-brand-primary' : 'text-gray-400'
            }`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 sm:w-12 h-[2px] rounded-full transition-colors duration-300 ${
              n < current ? 'bg-brand-secondary' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgendarVisita() {
  useSEO('agendar_visita');
  const location  = useLocation();
  const heroRef   = useScrollReveal();
  const bodyRef   = useScrollReveal();
  const { settings: visitSettings }     = useSettings('visit');
  const { settings: appearanceSettings } = useSettings('appearance');
  const { settings: generalSettings }   = useSettings('general');
  const heroApp = (appearanceSettings.visita as Record<string, string> | undefined) ?? {};
  const heroBadge    = heroApp.badge     || 'Visita presencial';
  const heroTitle    = heroApp.title     || 'Agende sua Visita';
  const heroHL       = heroApp.highlight || 'Visita';
  const heroSubtitle = heroApp.subtitle  || 'Conheça pessoalmente nossa estrutura, equipe pedagógica e tudo que temos a oferecer.';
  const heroImage    = heroApp.image     || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2070';

  // General settings — card info
  const schoolName = (generalSettings.school_name as string) || '';

  const cardAddress = (() => {
    const raw = generalSettings.address;
    if (!raw) return '';
    if (typeof raw === 'object' && raw !== null) {
      const a = raw as Record<string, string>;
      return [a.rua, a.numero && `, ${a.numero}`, a.bairro && ` - ${a.bairro}`, a.cidade && `, ${a.cidade}`, a.estado && `/${a.estado}`].filter(Boolean).join('');
    }
    return String(raw);
  })();

  const cardHours = (() => {
    const raw = generalSettings.business_hours;
    if (!raw) return '';
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`; };
    // Para cada dia aberto extrai os intervalos e cria uma assinatura que
    // permite agrupar dias consecutivos com a mesma grade horária.
    const openDays: { idx: number; name: string; intervals: { start: string; end: string }[]; signature: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const intervals = getBusinessIntervalsForWeekday(raw, i);
      if (intervals.length === 0) continue;
      openDays.push({
        idx: i,
        name: DAYS[i],
        intervals,
        signature: intervals.map((iv) => `${iv.start}-${iv.end}`).join('|'),
      });
    }
    if (openDays.length === 0) return '';
    const groups: { names: string[]; lastIdx: number; intervals: { start: string; end: string }[]; signature: string }[] = [];
    for (const d of openDays) {
      const last = groups[groups.length - 1];
      if (last && last.signature === d.signature && last.lastIdx + 1 === d.idx) {
        last.names.push(d.name); last.lastIdx = d.idx;
      } else {
        groups.push({ names: [d.name], lastIdx: d.idx, intervals: d.intervals, signature: d.signature });
      }
    }
    return groups.map((g) => {
      const label = g.names.length === 1 ? g.names[0] : `${g.names[0]} - ${g.names[g.names.length - 1]}`;
      const times = g.intervals.map((iv) => `${fmt(iv.start)} às ${fmt(iv.end)}`).join(' e ');
      return `${label}: ${times}`;
    }).join(', ');
  })();

  // Derive blocked weekdays from business_hours (days where open === false)
  const blockedWeekdays = useMemo(() => {
    const bh = generalSettings.business_hours;
    if (!bh || typeof bh !== 'object') return new Set([0, 6]);
    const bhObj = bh as Record<string, { open?: boolean }>;
    return new Set(Array.from({ length: 7 }, (_, i) => i).filter((i) => !bhObj[String(i)]?.open));
  }, [generalSettings.business_hours]);

  const VISIT_REASONS = useMemo(() => {
    if (Array.isArray(visitSettings.reasons) && visitSettings.reasons.length > 0) {
      const mergedReasons = (visitSettings.reasons as Array<Record<string, unknown>>).map((r) => {
        const { availability_weekdays, availability_intervals } = normalizeLegacyAvailability(r);
        const defaults = DEFAULT_VISIT_REASONS.find((d) => d.key === r.key);
        return {
          duration_minutes: 60,
          buffer_minutes: 0,
          max_per_slot: 2,
          max_daily: 0,
          availability_enabled: false,
          lead_integrated: false,
          min_advance_hours: 0,
          ...defaults,
          ...r,
          availability_weekdays,
          availability_intervals,
        } as VisitReason;
      });
      return mergedReasons.map((r) => ({
        ...r,
        icon: (r.icon && ICON_MAP[r.icon as string]) || FileText,
      }));
    }
    return DEFAULT_VISIT_REASONS.map((r) => ({
      ...r,
      icon: ICON_MAP[r.icon as string] || FileText,
    }));
  }, [visitSettings.reasons]);

  const isBlockedDay = useCallback(
    (d: Date) => blockedWeekdays.has(d.getDay()),
    [blockedWeekdays],
  );

  // ── Reason config (computed after VISIT_REASONS) ──
  const [reason, setReason]     = useState('');

  const selectedReasonConfig = useMemo(
    () => VISIT_REASONS.find((r) => r.key === reason) ?? {
      duration_minutes: 60,
      buffer_minutes: 0,
      max_per_slot: 2,
      max_daily: 0,
      lead_integrated: false,
      min_advance_hours: 0,
      availability_enabled: false,
      availability_weekdays: [...ALL_WEEKDAYS],
      availability_intervals: [] as VisitAvailabilityInterval[],
    },
    [VISIT_REASONS, reason],
  );

  /**
   * Quando o motivo tem restrição de dias da semana (availability_enabled),
   * bloqueia visualmente os dias que NÃO estão na lista. Se nenhum motivo
   * foi selecionado ainda, não filtra por aqui.
   */
  const isBlockedByReasonWeekday = useCallback(
    (d: Date) => {
      if (!reason) return false;
      if (!selectedReasonConfig.availability_enabled) return false;
      const wd = selectedReasonConfig.availability_weekdays;
      if (!Array.isArray(wd) || wd.length === 0) return true; // lista vazia = indisponível
      return !wd.includes(d.getDay());
    },
    [reason, selectedReasonConfig],
  );

  // ── Step state ──
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Form state ──
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [companions, setCompanions] = useState<string[]>([]);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  // ── Calendar state ──
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots]   = useState<{ time: string; duration: number; buffer: number }[]>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [fullDates, setFullDates]       = useState<Set<string>>(new Set());

  /**
   * Slots do dia selecionado. A fonte de verdade da janela horária é
   * `general.business_hours` (por dia da semana) — se o dia está fechado,
   * não gera nada; se tem 2 intervalos, a pausa entre eles é ignorada
   * automaticamente. Quando o motivo tem restrição própria
   * (`availability_intervals`), fazemos a interseção de cada intervalo da
   * escola com cada intervalo do motivo.
   */
  const ALL_SLOTS = useMemo(() => {
    if (!selectedDate) return [];
    const step = selectedReasonConfig.duration_minutes + (selectedReasonConfig.buffer_minutes || 0);
    const duration = selectedReasonConfig.duration_minutes;
    const weekday = selectedDate.getDay();
    const baseIntervals = getBusinessIntervalsForWeekday(generalSettings.business_hours, weekday);
    if (baseIntervals.length === 0) return [];

    let effectiveIntervals: { start: string; end: string }[];
    if (!selectedReasonConfig.availability_enabled || !selectedReasonConfig.availability_intervals?.length) {
      effectiveIntervals = baseIntervals;
    } else {
      effectiveIntervals = [];
      for (const base of baseIntervals) {
        for (const reasonIv of selectedReasonConfig.availability_intervals) {
          const cut = intersectIntervals(base, reasonIv);
          if (cut) effectiveIntervals.push(cut);
        }
      }
    }
    return generateSlotsForIntervals(effectiveIntervals, step || 30, duration);
  }, [selectedDate, generalSettings.business_hours, selectedReasonConfig]);
  const [holidays, setHolidays]         = useState<{ name: string; month: number; day: number }[]>([]);

  // ── Submit state ──
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);

  // ── Existing appointment state ──
  type ExistingAppointment = {
    id: string;
    visitor_name: string;
    visitor_phone: string;
    visitor_email: string | null;
    visit_reason: string;
    companions: string[];
    appointment_date: string;
    appointment_time: string;
    status: string;
  };
  const [existingAppt, setExistingAppt]   = useState<ExistingAppointment | null>(null);
  const [lookingUp, setLookingUp]         = useState(false);
  const [editMode, setEditMode]           = useState(false);
  const [showExistingBanner, setShowExistingBanner] = useState(false);
  const [checkedPhone, setCheckedPhone]   = useState('');

  // ── Lookup existing appointment by phone ──
  const lookupByPhone = useCallback(async (rawPhone: string) => {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length < 11 || digits === checkedPhone) return;

    setLookingUp(true);
    const { data } = await supabase
      .from('visit_appointments')
      .select('id, visitor_name, visitor_phone, visitor_email, visit_reason, companions, appointment_date, appointment_time, status')
      .eq('visitor_phone', rawPhone.trim())
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1);

    setLookingUp(false);
    setCheckedPhone(digits);

    if (data && data.length > 0) {
      setExistingAppt(data[0] as ExistingAppointment);
      setShowExistingBanner(true);
    } else {
      setExistingAppt(null);
      setShowExistingBanner(false);
    }
  }, [checkedPhone]);

  // ── Enter edit mode: pre-fill fields with existing data ──
  const enterEditMode = useCallback(() => {
    if (!existingAppt) return;
    setEditMode(true);
    setShowExistingBanner(false);
    setName(existingAppt.visitor_name);
    setPhone(existingAppt.visitor_phone);
    setEmail(existingAppt.visitor_email ?? '');
    setReason(existingAppt.visit_reason);
    setCompanions(existingAppt.companions?.length ? existingAppt.companions : []);
  }, [existingAppt]);

  // ── Dismiss banner: continue as new appointment ──
  const dismissBanner = () => {
    setShowExistingBanner(false);
    setExistingAppt(null);
    setEditMode(false);
  };

  // ── Pre-fill from /contato ──
  useEffect(() => {
    const state = location.state as Record<string, string> | null;
    if (state?.name)  setName(state.name);
    if (state?.phone) setPhone(state.phone);
    if (state?.email) setEmail(state.email);
    if (state?.name)  setStep(1); // still show step 1 so user can pick reason
  }, [location.state]);

  // ── Fetch holidays once ──
  useEffect(() => {
    const fetchHolidays = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', 'visit')
        .eq('key', 'holidays')
        .single();
      if (data?.value) {
        try {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (Array.isArray(parsed)) setHolidays(parsed);
        } catch {
          // ignore parse errors
        }
      }
    };
    fetchHolidays();
  }, []);

  // ── Fetch blocked dates for visible month ──
  useEffect(() => {
    const fetchBlocked = async () => {
      const startDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-01`;
      const endDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-31`;

      const { data } = await supabase
        .from('visit_blocked_dates')
        .select('blocked_date')
        .gte('blocked_date', startDate)
        .lte('blocked_date', endDate);

      if (data) {
        setBlockedDates(new Set(data.map((d: { blocked_date: string }) => d.blocked_date)));
      }
    };
    fetchBlocked();
  }, [currentMonth]);

  // ── Fetch daily counts for max_daily enforcement ──
  useEffect(() => {
    const fetchDailyCounts = async () => {
      if (!reason || selectedReasonConfig.max_daily <= 0) {
        setFullDates(new Set());
        return;
      }
      const firstDayOfMonth = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-01`;
      const lastDayOfMonth  = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-31`;

      const { data: dailyCounts } = await supabase
        .from('visit_appointments')
        .select('appointment_date')
        .eq('visit_reason', reason)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', firstDayOfMonth)
        .lte('appointment_date', lastDayOfMonth);

      const countByDate: Record<string, number> = {};
      (dailyCounts || []).forEach((r: { appointment_date: string }) => {
        countByDate[r.appointment_date] = (countByDate[r.appointment_date] || 0) + 1;
      });

      const full = new Set(
        Object.entries(countByDate)
          .filter(([, count]) => count >= selectedReasonConfig.max_daily)
          .map(([date]) => date),
      );
      setFullDates(full);
    };
    fetchDailyCounts();
  }, [currentMonth, reason, selectedReasonConfig.max_daily]);

  // ── Fetch booked slots when date changes ──
  const fetchBookedSlots = useCallback(async (date: Date) => {
    const dk = dateKey(date);
    const { data } = await supabase
      .from('visit_appointments')
      .select('appointment_time, duration_minutes, buffer_minutes')
      .eq('appointment_date', dk)
      .in('status', ['pending', 'confirmed']);

    if (data) {
      setBookedSlots(data.map((d: { appointment_time: string; duration_minutes: number | null; buffer_minutes: number | null }) => ({
        time: d.appointment_time.slice(0, 5),
        duration: d.duration_minutes ?? 60,
        buffer: d.buffer_minutes ?? 0,
      })));
    }
  }, []);

  useEffect(() => {
    if (selectedDate) fetchBookedSlots(selectedDate);
  }, [selectedDate, fetchBookedSlots]);

  // ── Calendar data ──
  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth.year, currentMonth.month),
    [currentMonth],
  );

  const availableSlots = useMemo(() => {
    const duration = selectedReasonConfig.duration_minutes;
    const maxPerSlot = selectedReasonConfig.max_per_slot;
    const minAdvanceHours = selectedReasonConfig.min_advance_hours ?? 0;

    return ALL_SLOTS.filter((slot) => {
      const slotStart = timeToMinutes(slot);
      const slotEnd = slotStart + duration;

      // Antecedência mínima — bloqueia horários muito próximos do momento atual
      if (minAdvanceHours > 0 && selectedDate) {
        const now = new Date();
        const slotDate = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          Math.floor(slotStart / 60),
          slotStart % 60,
        );
        const diffMs = slotDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < minAdvanceHours) return false;
      }

      const overlapping = bookedSlots.filter((b) => {
        const bStart = timeToMinutes(b.time);
        const bEnd = bStart + b.duration + b.buffer;
        return slotStart < bEnd && slotEnd > bStart;
      });

      return overlapping.length < maxPerSlot;
    });
  }, [ALL_SLOTS, bookedSlots, selectedReasonConfig, selectedDate]);

  const canGoPrevMonth = useMemo(() => {
    const now = new Date();
    return currentMonth.year > now.getFullYear() ||
      (currentMonth.year === now.getFullYear() && currentMonth.month > now.getMonth());
  }, [currentMonth]);

  // ── Navigation ──
  const prevMonth = () => {
    if (!canGoPrevMonth) return;
    setCurrentMonth((m) => {
      if (m.month === 0) return { year: m.year - 1, month: 11 };
      return { ...m, month: m.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth((m) => {
      if (m.month === 11) return { year: m.year + 1, month: 0 };
      return { ...m, month: m.month + 1 };
    });
  };

  // ── Validation ──
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome obrigatório';
    if (!phone.trim()) errs.phone = 'Celular obrigatório';
    else if (phone.replace(/\D/g, '').length < 11)
      errs.phone = 'Celular incompleto';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = 'E-mail inválido';
    if (!reason) errs.reason = 'Selecione o motivo';
    companions.forEach((c, i) => {
      if (!c.trim()) errs[`companion_${i}`] = 'Nome obrigatório';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToStep2 = () => {
    if (validateStep1()) setStep(2);
  };

  // ── Submit (insert or update) ──
  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);

    let error;

    if (editMode && existingAppt) {
      // UPDATE existing appointment
      const { error: updateErr } = await supabase
        .from('visit_appointments')
        .update({
          visitor_name:     name.trim(),
          visitor_email:    email.trim() || null,
          visit_reason:     reason,
          companions:       companions.filter((c) => c.trim()),
          appointment_date: dateKey(selectedDate),
          appointment_time: selectedTime + ':00',
          status:           'pending', // reset to pending on reschedule
        })
        .eq('id', existingAppt.id);
      error = updateErr;
    } else {
      // INSERT new appointment
      const { error: insertErr } = await supabase.from('visit_appointments').insert({
        visitor_name:    name.trim(),
        visitor_phone:   phone.trim(),
        visitor_email:   email.trim() || null,
        visit_reason:    reason,
        companions:      companions.filter((c) => c.trim()),
        appointment_date: dateKey(selectedDate),
        appointment_time: selectedTime + ':00',
        duration_minutes: selectedReasonConfig.duration_minutes,
        buffer_minutes:   selectedReasonConfig.buffer_minutes,
        status:          'pending',
      });
      error = insertErr;
    }

    setSubmitting(false);
    if (!error) {
      // Registrar aceite LGPD
      saveConsent({
        formType: 'visit',
        holderName: name.trim(),
        holderEmail: email.trim() || undefined,
      });

      setSubmitted(true);
      setStep(3);
    }
  };

  // ── Companion helpers ──
  const addCompanion = () => {
    if (companions.length < MAX_COMPANIONS) setCompanions((c) => [...c, '']);
  };

  const updateCompanion = (i: number, v: string) => {
    setCompanions((c) => c.map((x, j) => (j === i ? v : x)));
    setErrors((e) => {
      const next = { ...e };
      delete next[`companion_${i}`];
      return next;
    });
  };

  const removeCompanion = (i: number) => {
    setCompanions((c) => c.filter((_, j) => j !== i));
  };

  // ── Derived ──
  const reasonLabel = VISIT_REASONS.find((r) => r.key === reason)?.label ?? '';

  const isHoliday = (d: Date) =>
    holidays.some((h) => h.month === d.getMonth() + 1 && h.day === d.getDate());

  const isDateDisabled = (d: Date) =>
    isPast(d) || isBlockedDay(d) || isBlockedByReasonWeekday(d) || blockedDates.has(dateKey(d)) ||
    isHoliday(d) ||
    (selectedReasonConfig.max_daily > 0 && fullDates.has(dateKey(d)));

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative h-[45vh] min-h-[340px] overflow-hidden">
        <div className="absolute inset-0">
          <HeroMedia url={heroImage} />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/95 via-brand-primary/85 to-brand-primary-dark/75" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        <div ref={heroRef} className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            <div className="hero-badge inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-brand-secondary rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-medium tracking-wide">
                {heroBadge}
              </span>
            </div>

            <h1 className="hero-text-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              {(() => {
                if (!heroHL || !heroTitle.includes(heroHL)) return heroTitle;
                const parts = heroTitle.split(heroHL);
                return <>{parts[0]}<span className="italic text-brand-secondary">{heroHL}</span>{parts[1]}</>;
              })()}
            </h1>

            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-brand-secondary to-brand-secondary-light rounded-full mb-8" />

            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed">
              {heroSubtitle}
            </p>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <section className="py-16 bg-[var(--surface)]">
        <div ref={bodyRef} className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto" data-reveal="up">

            <div className="grid lg:grid-cols-[280px_1fr] gap-8">

              {/* ── Sidebar — Resumo ── */}
              <aside className="hidden lg:block">
                <div className="sticky top-28 bg-white rounded-2xl border border-gray-100 shadow-lg shadow-brand-primary/5 p-6 space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-brand-primary text-sm">{schoolName}</p>
                      <p className="text-gray-400 text-xs">Visita Presencial</p>
                    </div>
                  </div>

                  {/* Info pills */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {/* Duração: só aparece após o contato escolher o motivo,
                        já que o tempo varia conforme o tipo de visita. */}
                    {reason && (
                      <span className="inline-flex items-center gap-1.5 bg-brand-secondary text-brand-primary font-semibold px-3 py-1.5 rounded-lg">
                        <Clock className="w-3 h-3 text-brand-primary" />
                        {selectedReasonConfig.duration_minutes} min
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 bg-brand-secondary text-brand-primary font-semibold px-3 py-1.5 rounded-lg">
                      <MapPin className="w-3 h-3 text-brand-primary" />
                      Presencial
                    </span>
                  </div>

                  {/* Address + business hours */}
                  <div className="pt-1 space-y-2 text-xs text-gray-500">
                    {cardAddress && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <span className="leading-snug">{cardAddress}</span>
                      </div>
                    )}
                    {cardHours && (
                      <div className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <span className="leading-snug">{cardHours}</span>
                      </div>
                    )}
                  </div>

                  {/* Progressive summary */}
                  {step >= 1 && name && (
                    <div className="pt-4 border-t border-gray-100 space-y-3 text-sm">
                      <div className="flex items-start gap-2.5">
                        <User className="w-4 h-4 text-brand-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800 leading-snug">{name}</p>
                          <p className="text-gray-400 text-xs">{phone}</p>
                        </div>
                      </div>
                      {reasonLabel && (
                        <div className="flex items-start gap-2.5">
                          <FileText className="w-4 h-4 text-brand-primary mt-0.5 shrink-0" />
                          <p className="text-gray-600 leading-snug">{reasonLabel}</p>
                        </div>
                      )}
                      {companions.length > 0 && (
                        <div className="flex items-start gap-2.5">
                          <Users className="w-4 h-4 text-brand-primary mt-0.5 shrink-0" />
                          <p className="text-gray-600 leading-snug">
                            +{companions.filter((c) => c.trim()).length} acompanhante{companions.filter((c) => c.trim()).length > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {step >= 2 && selectedDate && (
                    <div className="pt-4 border-t border-gray-100 space-y-3 text-sm">
                      <div className="flex items-start gap-2.5">
                        <CalendarDays className="w-4 h-4 text-brand-secondary mt-0.5 shrink-0" />
                        <p className="font-medium text-gray-800 leading-snug">
                          {formatDateLong(selectedDate)}
                        </p>
                      </div>
                      {selectedTime && (
                        <div className="flex items-start gap-2.5">
                          <Clock className="w-4 h-4 text-brand-secondary mt-0.5 shrink-0" />
                          <p className="font-medium text-gray-800 leading-snug">
                            {formatTimeRange(selectedTime, selectedReasonConfig.duration_minutes)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>

              {/* ── Main ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-brand-primary/5 overflow-hidden">

                {/* Step indicator inside card */}
                <div className="px-6 md:px-10 pt-8 pb-6 border-b border-gray-100">
                  <StepIndicator current={step} />
                </div>

                {/* ═══════════ STEP 1: Dados pessoais ═══════════ */}
                {step === 1 && (
                  <div className="p-6 md:p-10">
                    <h2 className="font-display text-2xl font-bold text-brand-primary mb-2">
                      {editMode ? 'Alterar agendamento' : 'Seus dados'}
                    </h2>
                    <p className="text-gray-400 text-sm mb-8">
                      {editMode
                        ? 'Modifique os campos que deseja atualizar e prossiga para escolher o novo horário.'
                        : 'Preencha seus dados para prosseguir com o agendamento.'
                      }
                    </p>

                    <div className="space-y-5">
                      <InputField
                        label="Nome completo *"
                        icon={User}
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: '' })); }}
                        placeholder="Seu nome completo"
                        error={errors.name || undefined}
                      />

                      <div className="grid sm:grid-cols-2 gap-5">
                        <InputField
                          label="Celular *"
                          icon={Phone}
                          type="text"
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) => { setPhone(maskPhone(e.target.value)); setErrors((er) => ({ ...er, phone: '' })); }}
                          onBlur={() => lookupByPhone(phone)}
                          placeholder="(00) 00000-0000"
                          error={errors.phone || undefined}
                        />
                        <InputField
                          label="E-mail (opcional)"
                          icon={Mail}
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: '' })); }}
                          placeholder="email@exemplo.com"
                          error={errors.email || undefined}
                        />
                      </div>

                      {/* Banner: agendamento existente */}
                      {lookingUp && (
                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          Verificando agendamentos existentes...
                        </div>
                      )}

                      {showExistingBanner && existingAppt && (
                        <div className="bg-brand-secondary/10 border border-brand-secondary/40 rounded-xl p-5 space-y-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-[#b8860b] shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-brand-primary text-sm mb-1">
                                Você já possui um agendamento
                              </p>
                              <p className="text-gray-600 text-sm leading-relaxed">
                                Encontramos uma visita marcada para{' '}
                                <strong className="text-brand-primary">
                                  {(() => {
                                    const [y, m, d] = existingAppt.appointment_date.split('-').map(Number);
                                    return `${d} de ${MONTH_NAMES[m - 1]} de ${y}`;
                                  })()}
                                </strong>{' '}
                                às{' '}
                                <strong className="text-brand-primary">
                                  {existingAppt.appointment_time.slice(0, 5)}
                                </strong>{' '}
                                — {VISIT_REASONS.find((r) => r.key === existingAppt.visit_reason)?.label ?? existingAppt.visit_reason}
                                {existingAppt.status === 'confirmed' && (
                                  <span className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Confirmado
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pl-8">
                            <button
                              type="button"
                              onClick={enterEditMode}
                              className="inline-flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-brand-primary-dark transition-all duration-200"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Alterar agendamento
                            </button>
                            <button
                              type="button"
                              onClick={dismissBanner}
                              className="inline-flex items-center gap-2 text-gray-500 px-5 py-2.5 rounded-lg font-medium text-sm hover:text-brand-primary hover:bg-white border border-gray-200 transition-all duration-200"
                            >
                              Criar novo agendamento
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Badge de edição */}
                      {editMode && (
                        <div className="flex items-center gap-2 bg-brand-primary/5 border border-brand-primary/20 rounded-xl px-4 py-3 text-sm">
                          <Edit3 className="w-4 h-4 text-brand-primary shrink-0" />
                          <p className="text-brand-primary font-medium">
                            Modo de edição — altere os campos desejados e confirme no próximo passo.
                          </p>
                        </div>
                      )}

                      {/* Motivo */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2.5">
                          Motivo da visita <span className="text-red-500">*</span>
                        </label>
                        <div className="grid sm:grid-cols-2 gap-2.5">
                          {VISIT_REASONS.map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => { setReason(key); setErrors((er) => ({ ...er, reason: '' })); }}
                              className={`
                                flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left text-sm transition-all duration-200
                                ${reason === key
                                  ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/20'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-primary/30 hover:text-brand-primary'
                                }
                              `}
                            >
                              <Icon className={`w-4 h-4 shrink-0 ${
                                reason === key ? 'text-brand-secondary' : 'text-gray-400'
                              }`} />
                              {label}
                            </button>
                          ))}
                        </div>
                        {errors.reason && <p className="mt-1 text-xs text-red-500">{errors.reason}</p>}
                      </div>

                      {/* Acompanhantes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2.5">
                          Acompanhantes <span className="text-gray-300 text-xs font-normal">(opcional, máx. {MAX_COMPANIONS})</span>
                        </label>

                        {companions.map((c, i) => (
                          <div key={i} className="flex gap-2 mb-2.5 items-start">
                            <div className="flex-1">
                              <InputField
                                label={`Acompanhante ${i + 1}`}
                                icon={Users}
                                type="text"
                                value={c}
                                onChange={(e) => updateCompanion(i, e.target.value)}
                                placeholder={`Nome do acompanhante ${i + 1}`}
                                error={errors[`companion_${i}`] || undefined}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCompanion(i)}
                              className="w-[52px] h-[52px] rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-200"
                              aria-label="Remover acompanhante"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}

                        {companions.length < MAX_COMPANIONS && (
                          <button
                            type="button"
                            onClick={addCompanion}
                            className="inline-flex items-center gap-2 text-sm text-brand-primary font-medium hover:text-brand-secondary transition-colors mt-1"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar acompanhante
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end mt-10 pt-6 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={goToStep2}
                        className="inline-flex items-center gap-2 bg-brand-primary text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-brand-primary-dark transition-all duration-300 hover:shadow-lg hover:shadow-brand-primary/25"
                      >
                        Escolher horário
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══════════ STEP 2: Data e horário ═══════════ */}
                {step === 2 && (
                  <div className="p-6 md:p-10">
                    <h2 className="font-display text-2xl font-bold text-brand-primary mb-2">
                      {editMode ? 'Nova data e horário' : 'Data e horário'}
                    </h2>
                    <p className="text-gray-400 text-sm mb-8">
                      {editMode
                        ? 'Selecione a nova data e horário para sua visita.'
                        : 'Selecione uma data disponível e o horário de sua preferência.'
                      }
                    </p>

                    <div className="grid md:grid-cols-[1fr_200px] gap-8">

                      {/* Calendário */}
                      <div>
                        {/* Month nav */}
                        <div className="flex items-center justify-between mb-5">
                          <button
                            type="button"
                            onClick={prevMonth}
                            disabled={!canGoPrevMonth}
                            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-brand-primary hover:text-brand-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <h3 className="font-display text-lg font-bold text-brand-primary">
                            {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
                          </h3>
                          <button
                            type="button"
                            onClick={nextMonth}
                            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-brand-primary hover:text-brand-primary transition-all duration-200"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Day headers */}
                        <div className="grid grid-cols-7 mb-2">
                          {DAY_HEADERS.map((dh) => (
                            <div key={dh} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-2">
                              {dh}
                            </div>
                          ))}
                        </div>

                        {/* Day grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((day, i) => {
                            if (!day) return <div key={`empty-${i}`} />;
                            const disabled = isDateDisabled(day);
                            const selected = selectedDate && isSameDay(day, selectedDate);
                            const today = isToday(day);
                            const holiday = isHoliday(day);

                            return (
                              <button
                                key={dateKey(day)}
                                type="button"
                                disabled={disabled}
                                onClick={() => { setSelectedDate(day); setSelectedTime(null); }}
                                className={`
                                  relative h-11 rounded-lg text-sm font-medium transition-all duration-200
                                  ${disabled
                                    ? 'text-gray-200 cursor-not-allowed'
                                    : selected
                                      ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/25'
                                      : today
                                        ? 'bg-brand-secondary/10 text-brand-primary font-bold ring-1 ring-brand-secondary/40 hover:bg-brand-primary hover:text-white'
                                        : 'text-gray-700 hover:bg-brand-primary/5 hover:text-brand-primary'
                                  }
                                `}
                              >
                                {day.getDate()}
                                {today && !selected && (
                                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-secondary" />
                                )}
                                {holiday && !today && !selected && (
                                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Time slots */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          {selectedDate
                            ? `${selectedDate.getDate()} de ${MONTH_NAMES[selectedDate.getMonth()]}`
                            : 'Selecione uma data'
                          }
                        </p>

                        {selectedDate ? (
                          availableSlots.length > 0 ? (
                            <div className="space-y-2">
                              {ALL_SLOTS.map((slot) => {
                                const isAvailable = availableSlots.includes(slot);
                                const isSelected = selectedTime === slot;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    disabled={!isAvailable}
                                    onClick={() => setSelectedTime(slot)}
                                    className={`
                                      w-full py-3 px-4 rounded-xl text-sm font-semibold text-center transition-all duration-200 border
                                      ${!isAvailable
                                        ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                                        : isSelected
                                          ? 'border-brand-primary bg-brand-primary text-white shadow-md shadow-brand-primary/25'
                                          : 'border-gray-200 bg-white text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5'
                                      }
                                    `}
                                  >
                                    {slot}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 text-center py-8">
                              Sem horários disponíveis nesta data.
                            </p>
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                            <CalendarDays className="w-10 h-10 mb-3" />
                            <p className="text-sm text-center">
                              Selecione uma data no calendário
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-primary font-medium text-sm transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!selectedDate || !selectedTime || submitting || !legalConsent}
                        className="inline-flex items-center gap-2 bg-brand-secondary text-brand-primary px-8 py-4 rounded-xl font-bold text-sm transition-all duration-300 hover:bg-white hover:shadow-lg hover:shadow-brand-secondary/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-secondary disabled:hover:shadow-none"
                      >
                        {submitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> {editMode ? 'Atualizando...' : 'Agendando...'}</>
                        ) : (
                          <>{editMode ? 'Salvar alterações' : 'Confirmar agendamento'} <CheckCircle className="w-4 h-4" /></>
                        )}
                      </button>
                    </div>

                    <div className="mt-6 px-6 pb-2">
                      <LegalConsent checked={legalConsent} onChange={setLegalConsent} />
                    </div>
                  </div>
                )}

                {/* ═══════════ STEP 3: Confirmação ═══════════ */}
                {step === 3 && submitted && (
                  <div className="p-6 md:p-10">
                    <div className="text-center max-w-md mx-auto py-8">
                      <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-8 rotate-3">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                      </div>
                      <h2 className="font-display text-3xl font-bold text-brand-primary mb-3">
                        {editMode ? 'Agendamento atualizado!' : 'Visita agendada!'}
                      </h2>
                      <p className="text-gray-500 text-sm leading-relaxed mb-10">
                        {editMode
                          ? 'Seu agendamento foi alterado com sucesso. Nossa equipe entrará em contato para confirmar.'
                          : 'Recebemos seu agendamento. Nossa equipe entrará em contato para confirmar.'
                        }
                      </p>

                      {/* Summary card */}
                      <div className="bg-[var(--surface)] rounded-2xl p-6 text-left space-y-4 mb-10 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-brand-primary rounded-lg flex items-center justify-center shrink-0">
                            <CalendarDays className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Data e horário</p>
                            <p className="font-bold text-brand-primary text-sm">
                              {selectedDate && formatDateLong(selectedDate)} · {selectedTime && formatTimeRange(selectedTime, selectedReasonConfig.duration_minutes)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-brand-primary rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Motivo</p>
                            <p className="font-bold text-brand-primary text-sm">{reasonLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-brand-primary rounded-lg flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Visitantes</p>
                            <p className="font-bold text-brand-primary text-sm">
                              {1 + companions.filter((c) => c.trim()).length} pessoa{companions.filter((c) => c.trim()).length > 0 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-brand-primary rounded-lg flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Local</p>
                            <p className="font-bold text-brand-primary text-sm">
                              {cardAddress}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Link
                        to="/"
                        className="inline-flex items-center gap-2 bg-brand-primary text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-brand-primary-dark transition-all duration-300 hover:shadow-lg hover:shadow-brand-primary/25"
                      >
                        Voltar ao início
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
