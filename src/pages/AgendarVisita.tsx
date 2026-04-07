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
  Users, FileText, Loader2, Building2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveConsent } from '../lib/consent';
import { useScrollReveal } from '../hooks/useScrollReveal';
import LegalConsent from '../components/LegalConsent';

// ─── Constants ────────────────────────────────────────────────────────────────

const VISIT_REASONS = [
  { key: 'conhecer_estrutura',     label: 'Conhecer a estrutura',       icon: Building2 },
  { key: 'coordenacao',            label: 'Conversar com coordenação',  icon: Users },
  { key: 'gestora',                label: 'Conversar com a gestora',    icon: User },
  { key: 'entrega_documentos',     label: 'Entrega de documentos',      icon: FileText },
  { key: 'assinatura_contratos',   label: 'Assinatura de contratos',    icon: FileText },
  { key: 'solicitacao_documentos', label: 'Solicitação de documentos',  icon: FileText },
];

const VISIT_DURATION = 60; // minutos
const START_HOUR = 9;
const END_HOUR = 17;
const LUNCH_START = 12;
const LUNCH_END = 14;
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

function generateSlots(): string[] {
  const slots: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    if (h >= LUNCH_START && h < LUNCH_END) continue;
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

const ALL_SLOTS = generateSlots();

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

function isWeekend(d: Date) { return d.getDay() === 0 || d.getDay() === 6; }

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(d: Date) {
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatTimeRange(time: string) {
  const [h] = time.split(':').map(Number);
  const end = h + 1;
  return `${time} – ${String(end).padStart(2, '0')}:00`;
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
                ? 'bg-[#ffd700] text-[#003876]'
                : n === current
                  ? 'bg-[#003876] text-white ring-4 ring-[#003876]/20'
                  : 'bg-gray-100 text-gray-400'
              }
            `}>
              {n < current ? <CheckCircle className="w-4 h-4" /> : n}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${
              n <= current ? 'text-[#003876]' : 'text-gray-400'
            }`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 sm:w-12 h-[2px] rounded-full transition-colors duration-300 ${
              n < current ? 'bg-[#ffd700]' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

const inputCls =
  'w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#003876] focus:border-transparent placeholder-gray-400';

const inputClsError =
  'w-full pl-11 pr-4 py-3.5 rounded-xl border border-red-300 bg-red-50 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgendarVisita() {
  const location  = useLocation();
  const heroRef   = useScrollReveal();
  const bodyRef   = useScrollReveal();

  // ── Step state ──
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Form state ──
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [reason, setReason]     = useState('');
  const [companions, setCompanions] = useState<string[]>([]);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  // ── Calendar state ──
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots]   = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

  // ── Submit state ──
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);

  // ── Pre-fill from /contato ──
  useEffect(() => {
    const state = location.state as Record<string, string> | null;
    if (state?.name)  setName(state.name);
    if (state?.phone) setPhone(state.phone);
    if (state?.email) setEmail(state.email);
    if (state?.name)  setStep(1); // still show step 1 so user can pick reason
  }, [location.state]);

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

  // ── Fetch booked slots when date changes ──
  const fetchBookedSlots = useCallback(async (date: Date) => {
    const dk = dateKey(date);
    const { data } = await supabase
      .from('visit_appointments')
      .select('appointment_time')
      .eq('appointment_date', dk)
      .in('status', ['pending', 'confirmed']);

    if (data) {
      setBookedSlots(data.map((d: { appointment_time: string }) =>
        d.appointment_time.slice(0, 5)
      ));
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

  const availableSlots = useMemo(
    () => ALL_SLOTS.filter((s) => !bookedSlots.includes(s)),
    [bookedSlots],
  );

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

  // ── Submit ──
  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);

    const { error } = await supabase.from('visit_appointments').insert({
      visitor_name:    name.trim(),
      visitor_phone:   phone.trim(),
      visitor_email:   email.trim() || null,
      visit_reason:    reason,
      companions:      companions.filter((c) => c.trim()),
      appointment_date: dateKey(selectedDate),
      appointment_time: selectedTime + ':00',
      duration_minutes: VISIT_DURATION,
      status:          'pending',
    });

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

  const isDateDisabled = (d: Date) =>
    isPast(d) || isWeekend(d) || blockedDates.has(dateKey(d));

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative h-[45vh] min-h-[340px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2070"
            alt="Colégio Batista"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#003876]/95 via-[#003876]/85 to-[#002855]/75" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        <div ref={heroRef} className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            <div className="hero-badge inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-[#ffd700] rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-medium tracking-wide">
                Visita presencial
              </span>
            </div>

            <h1 className="hero-text-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              Agende sua{' '}
              <span className="italic text-[#ffd700]">Visita</span>
            </h1>

            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-[#ffd700] to-[#ffe44d] rounded-full mb-8" />

            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed">
              Conheça pessoalmente nossa estrutura, equipe pedagógica
              e tudo que o Colégio Batista tem a oferecer.
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
                <div className="sticky top-28 bg-white rounded-2xl border border-gray-100 shadow-lg shadow-[#003876]/5 p-6 space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 bg-[#003876] rounded-xl flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-[#003876] text-sm">Colégio Batista</p>
                      <p className="text-gray-400 text-xs">Visita Presencial</p>
                    </div>
                  </div>

                  {/* Info pills */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 bg-[var(--surface)] text-gray-600 px-3 py-1.5 rounded-lg">
                      <Clock className="w-3 h-3 text-[#003876]" />
                      {VISIT_DURATION} min
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-[var(--surface)] text-gray-600 px-3 py-1.5 rounded-lg">
                      <MapPin className="w-3 h-3 text-[#003876]" />
                      Presencial
                    </span>
                  </div>

                  {/* Progressive summary */}
                  {step >= 1 && name && (
                    <div className="pt-4 border-t border-gray-100 space-y-3 text-sm">
                      <div className="flex items-start gap-2.5">
                        <User className="w-4 h-4 text-[#003876] mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800 leading-snug">{name}</p>
                          <p className="text-gray-400 text-xs">{phone}</p>
                        </div>
                      </div>
                      {reasonLabel && (
                        <div className="flex items-start gap-2.5">
                          <FileText className="w-4 h-4 text-[#003876] mt-0.5 shrink-0" />
                          <p className="text-gray-600 leading-snug">{reasonLabel}</p>
                        </div>
                      )}
                      {companions.length > 0 && (
                        <div className="flex items-start gap-2.5">
                          <Users className="w-4 h-4 text-[#003876] mt-0.5 shrink-0" />
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
                        <CalendarDays className="w-4 h-4 text-[#ffd700] mt-0.5 shrink-0" />
                        <p className="font-medium text-gray-800 leading-snug">
                          {formatDateLong(selectedDate)}
                        </p>
                      </div>
                      {selectedTime && (
                        <div className="flex items-start gap-2.5">
                          <Clock className="w-4 h-4 text-[#ffd700] mt-0.5 shrink-0" />
                          <p className="font-medium text-gray-800 leading-snug">
                            {formatTimeRange(selectedTime)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>

              {/* ── Main ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-[#003876]/5 overflow-hidden">

                {/* Step indicator inside card */}
                <div className="px-6 md:px-10 pt-8 pb-6 border-b border-gray-100">
                  <StepIndicator current={step} />
                </div>

                {/* ═══════════ STEP 1: Dados pessoais ═══════════ */}
                {step === 1 && (
                  <div className="p-6 md:p-10">
                    <h2 className="font-display text-2xl font-bold text-[#003876] mb-2">
                      Seus dados
                    </h2>
                    <p className="text-gray-400 text-sm mb-8">
                      Preencha seus dados para prosseguir com o agendamento.
                    </p>

                    <div className="space-y-5">
                      {/* Nome */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Nome completo <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: '' })); }}
                            placeholder="Seu nome completo"
                            className={errors.name ? inputClsError : inputCls}
                          />
                        </div>
                        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                      </div>

                      {/* Celular + Email */}
                      <div className="grid sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Celular <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={phone}
                              onChange={(e) => { setPhone(maskPhone(e.target.value)); setErrors((er) => ({ ...er, phone: '' })); }}
                              placeholder="(00) 00000-0000"
                              maxLength={15}
                              className={errors.phone ? inputClsError : inputCls}
                            />
                          </div>
                          {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            E-mail <span className="text-gray-300 text-xs font-normal">(opcional)</span>
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: '' })); }}
                              placeholder="email@exemplo.com"
                              className={errors.email ? inputClsError : inputCls}
                            />
                          </div>
                          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                        </div>
                      </div>

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
                                  ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#003876]/30 hover:text-[#003876]'
                                }
                              `}
                            >
                              <Icon className={`w-4 h-4 shrink-0 ${
                                reason === key ? 'text-[#ffd700]' : 'text-gray-400'
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
                          <div key={i} className="flex gap-2 mb-2.5">
                            <div className="relative flex-1">
                              <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              <input
                                type="text"
                                value={c}
                                onChange={(e) => updateCompanion(i, e.target.value)}
                                placeholder={`Nome do acompanhante ${i + 1}`}
                                className={errors[`companion_${i}`] ? inputClsError : inputCls}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCompanion(i)}
                              className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-200"
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
                            className="inline-flex items-center gap-2 text-sm text-[#003876] font-medium hover:text-[#ffd700] transition-colors mt-1"
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
                        className="inline-flex items-center gap-2 bg-[#003876] text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-[#002855] transition-all duration-300 hover:shadow-lg hover:shadow-[#003876]/25"
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
                    <h2 className="font-display text-2xl font-bold text-[#003876] mb-2">
                      Data e horário
                    </h2>
                    <p className="text-gray-400 text-sm mb-8">
                      Selecione uma data disponível e o horário de sua preferência.
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
                            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <h3 className="font-display text-lg font-bold text-[#003876]">
                            {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
                          </h3>
                          <button
                            type="button"
                            onClick={nextMonth}
                            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#003876] hover:text-[#003876] transition-all duration-200"
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
                                      ? 'bg-[#003876] text-white shadow-md shadow-[#003876]/25'
                                      : today
                                        ? 'bg-[#ffd700]/10 text-[#003876] font-bold ring-1 ring-[#ffd700]/40 hover:bg-[#003876] hover:text-white'
                                        : 'text-gray-700 hover:bg-[#003876]/5 hover:text-[#003876]'
                                  }
                                `}
                              >
                                {day.getDate()}
                                {today && !selected && (
                                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ffd700]" />
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
                                const isBooked = bookedSlots.includes(slot);
                                const isSelected = selectedTime === slot;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    disabled={isBooked}
                                    onClick={() => setSelectedTime(slot)}
                                    className={`
                                      w-full py-3 px-4 rounded-xl text-sm font-semibold text-center transition-all duration-200 border
                                      ${isBooked
                                        ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                                        : isSelected
                                          ? 'border-[#003876] bg-[#003876] text-white shadow-md shadow-[#003876]/25'
                                          : 'border-gray-200 bg-white text-[#003876] hover:border-[#003876] hover:bg-[#003876]/5'
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
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-[#003876] font-medium text-sm transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!selectedDate || !selectedTime || submitting || !legalConsent}
                        className="inline-flex items-center gap-2 bg-[#ffd700] text-[#003876] px-8 py-4 rounded-xl font-bold text-sm transition-all duration-300 hover:bg-white hover:shadow-lg hover:shadow-[#ffd700]/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#ffd700] disabled:hover:shadow-none"
                      >
                        {submitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Agendando...</>
                        ) : (
                          <>Confirmar agendamento <CheckCircle className="w-4 h-4" /></>
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
                      <h2 className="font-display text-3xl font-bold text-[#003876] mb-3">
                        Visita agendada!
                      </h2>
                      <p className="text-gray-500 text-sm leading-relaxed mb-10">
                        Recebemos seu agendamento. Nossa equipe entrará em contato para confirmar.
                      </p>

                      {/* Summary card */}
                      <div className="bg-[var(--surface)] rounded-2xl p-6 text-left space-y-4 mb-10 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#003876] rounded-lg flex items-center justify-center shrink-0">
                            <CalendarDays className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Data e horário</p>
                            <p className="font-bold text-[#003876] text-sm">
                              {selectedDate && formatDateLong(selectedDate)} · {selectedTime && formatTimeRange(selectedTime)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#003876] rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Motivo</p>
                            <p className="font-bold text-[#003876] text-sm">{reasonLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#003876] rounded-lg flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Visitantes</p>
                            <p className="font-bold text-[#003876] text-sm">
                              {1 + companions.filter((c) => c.trim()).length} pessoa{companions.filter((c) => c.trim()).length > 0 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#003876] rounded-lg flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Local</p>
                            <p className="font-bold text-[#003876] text-sm">
                              Rua Marcílio Dias, 99 – São Francisco, Caruaru/PE
                            </p>
                          </div>
                        </div>
                      </div>

                      <Link
                        to="/"
                        className="inline-flex items-center gap-2 bg-[#003876] text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-[#002855] transition-all duration-300 hover:shadow-lg hover:shadow-[#003876]/25"
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
