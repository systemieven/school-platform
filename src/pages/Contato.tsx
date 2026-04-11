import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Phone, Mail, Clock, MapPin, MessageSquare,
  CheckCircle2, XCircle, Loader2, Send, ChevronRight,
  Sunrise, Sunset, PhoneCall, MessageCircle,
  GraduationCap, Building2, HelpCircle, Lightbulb, AlertCircle, Handshake, Calendar, MoreHorizontal,
  Users, FileText, BookOpen, Heart, Star, Home, Award, Briefcase, PenLine,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveConsent } from '../lib/consent';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useSettings } from '../hooks/useSettings';
import LegalConsent from '../components/LegalConsent';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CONTACT_ICON_MAP: Record<string, any> = {
  GraduationCap, Building2, HelpCircle, Lightbulb, AlertCircle, Handshake, Calendar, MoreHorizontal,
  MessageSquare, MessageCircle, PhoneCall,
  User, Users, FileText, BookOpen, Heart, Star, Mail, Phone, Home, Award, Briefcase, PenLine,
};

const DEFAULT_CONTACT_REASONS = [
  { value: 'matricula',          label: 'Interesse em matrícula',   icon: 'GraduationCap' },
  { value: 'conhecer_estrutura', label: 'Conhecer a estrutura',     icon: 'Building2' },
  { value: 'duvidas',            label: 'Dúvidas',                  icon: 'HelpCircle' },
  { value: 'sugestoes',          label: 'Sugestões',                icon: 'Lightbulb' },
  { value: 'reclamacoes',        label: 'Reclamações',              icon: 'AlertCircle' },
  { value: 'parcerias',          label: 'Parcerias',                icon: 'Handshake' },
  { value: 'eventos',            label: 'Eventos',                  icon: 'Calendar' },
  { value: 'outro',              label: 'Outro assunto',            icon: 'MoreHorizontal' },
];

// ── Institutional data helpers (same logic as Footer) ─────────────────────
interface BHInterval { start: string; end: string }
interface BHDay { open?: boolean; intervals?: Array<{ start?: string; end?: string }>; start?: string; end?: string }

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function getBusinessIntervalsForWeekday(rawBH: unknown, weekday: number): BHInterval[] {
  if (!rawBH) return [];
  let bh: Record<string, BHDay>;
  try {
    bh = typeof rawBH === 'string' ? JSON.parse(rawBH) : (rawBH as Record<string, BHDay>);
  } catch { return []; }
  const d = bh?.[String(weekday)];
  if (!d?.open) return [];
  if (Array.isArray(d.intervals) && d.intervals.length > 0) {
    return d.intervals
      .filter((i) => typeof i.start === 'string' && typeof i.end === 'string')
      .map((i) => ({ start: i.start as string, end: i.end as string }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }
  if (typeof d.start === 'string' && typeof d.end === 'string') {
    return [{ start: d.start, end: d.end }];
  }
  return [];
}

function buildBusinessHoursLines(raw: unknown): string[] {
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const openDays: { idx: number; name: string; intervals: BHInterval[]; signature: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const intervals = getBusinessIntervalsForWeekday(raw, i);
    if (intervals.length === 0) continue;
    openDays.push({ idx: i, name: DAYS[i], intervals, signature: intervals.map((iv) => `${iv.start}-${iv.end}`).join('|') });
  }
  if (openDays.length === 0) return [];
  const groups: { names: string[]; lastIdx: number; intervals: BHInterval[]; signature: string }[] = [];
  for (const d of openDays) {
    const last = groups[groups.length - 1];
    if (last && last.signature === d.signature && last.lastIdx + 1 === d.idx) {
      last.names.push(d.name);
      last.lastIdx = d.idx;
    } else {
      groups.push({ names: [d.name], lastIdx: d.idx, intervals: d.intervals, signature: d.signature });
    }
  }
  return groups.map((g) => {
    const label = g.names.length === 1 ? g.names[0] : `${g.names[0]} - ${g.names[g.names.length - 1]}`;
    const times = g.intervals.map((iv) => `${fmtTime(iv.start)} às ${fmtTime(iv.end)}`).join(' e ');
    return `${label}: ${times}`;
  });
}

function formatInstitutionalAddress(raw: unknown): string[] {
  if (!raw) return ['Rua Marcílio Dias, 99', 'São Francisco, Caruaru/PE'];
  if (typeof raw === 'object' && raw !== null) {
    const a = raw as Record<string, string>;
    const line1 = [a.rua, a.numero && `, ${a.numero}`].filter(Boolean).join('');
    const line2 = [a.bairro, a.cidade && `${a.cidade}${a.estado ? `/${a.estado}` : ''}`].filter(Boolean).join(', ');
    return [line1, line2].filter(Boolean);
  }
  const s = String(raw);
  const idx = s.indexOf(' | ');
  if (idx !== -1) return [s.slice(0, idx), s.slice(idx + 3)];
  const idx2 = s.indexOf(' - ');
  if (idx2 !== -1) return [s.slice(0, idx2), s.slice(idx2 + 3)];
  return [s];
}

// ── Masks ──────────────────────────────────────────────────────────────────
function maskPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Types ──────────────────────────────────────────────────────────────────
type BestTime      = 'morning' | 'afternoon' | null;
type ContactVia    = 'phone_call' | 'whatsapp' | 'email' | null;
type ContactReason = string | null;
type Segment       = 'educacao_infantil' | 'fundamental_1' | 'fundamental_2' | 'ensino_medio' | null;
type HowFound      = 'indicacao' | 'redes_sociais' | 'google' | 'passou_na_frente' | 'outro' | null;
type Count         = '1' | '2' | '3+' | null;
type Errors        = Partial<Record<string, string>>;

interface FormState {
  name: string;
  phone: string;
  email: string;
  bestTime: BestTime;
  contactVia: ContactVia;
  contactReason: ContactReason;
  segmentInterest: Segment;
  studentCount: Count;
  howFoundUs: HowFound;
  wantsVisit: boolean;
  message: string;
}

// ── Small helpers ──────────────────────────────────────────────────────────
function inputCls(error?: string) {
  return [
    'w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-colors',
    'focus:outline-none focus:ring-2 focus:border-transparent',
    error
      ? 'border-red-400 bg-red-50 focus:ring-red-300'
      : 'border-gray-200 bg-white focus:ring-[#003876]',
  ].join(' ');
}

function Field({
  label, required, error, icon: Icon, children,
}: {
  label: string; required?: boolean; error?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
        {children}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

function ToggleGroup<T extends string>({
  label, required, options, value, onChange, error,
}: {
  label: string; required?: boolean; error?: string;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200',
              value === opt.value
                ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#003876]/40 hover:text-[#003876]',
            ].join(' ')}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Contato() {
  const navigate  = useNavigate();
  const formRef   = useScrollReveal();
  const infoRef   = useScrollReveal();
  const { settings: contactSettings } = useSettings('contact');
  const { settings: appearanceSettings } = useSettings('appearance');
  const { settings: generalSettings } = useSettings('general');
  const heroCont = (appearanceSettings.contato as Record<string, string> | undefined) ?? {};
  const heroBadge    = heroCont.badge     || 'Fale conosco';
  const heroTitle    = heroCont.title     || 'Entre em Contato';
  const heroHL       = heroCont.highlight || 'Contato';
  const heroSubtitle = heroCont.subtitle  || 'Tire suas dúvidas, agende uma visita ou solicite informações sobre matrículas.';
  const heroImage    = heroCont.image     || 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=2070';

  // Dados institucionais (fonte única de verdade — Institucional > Contato / Horários)
  const instPhone   = (generalSettings.phone as string) || '(81) 3721-4787';
  const instAddress = formatInstitutionalAddress(generalSettings.address);
  const instHoursLines = buildBusinessHoursLines(generalSettings.business_hours);

  // Fields the admin marked as required
  const requiredFields = useMemo(() => {
    const arr = Array.isArray(contactSettings.required_fields)
      ? (contactSettings.required_fields as string[])
      : ['nome', 'celular'];
    return new Set(arr);
  }, [contactSettings.required_fields]);

  const contactReasons = useMemo(() => {
    if (Array.isArray(contactSettings.contact_reasons) && contactSettings.contact_reasons.length > 0) {
      return (contactSettings.contact_reasons as Array<{ value?: string; key?: string; label: string; icon?: string; lead_integrated?: boolean; require_message?: boolean }>).map((r) => ({
        value: r.key || r.value || r.label.toLowerCase().replace(/\s+/g, '_'),
        label: r.label,
        icon: (r.icon && CONTACT_ICON_MAP[r.icon]) || MessageSquare,
        lead_integrated: r.lead_integrated ?? false,
        require_message: r.require_message ?? false,
      }));
    }
    return DEFAULT_CONTACT_REASONS.map((r) => ({
      ...r,
      icon: CONTACT_ICON_MAP[r.icon] || MessageSquare,
      lead_integrated: false,
      require_message: r.value === 'outro',
    }));
  }, [contactSettings.contact_reasons]);

  const [form, setForm] = useState<FormState>({
    name: '', phone: '', email: '',
    bestTime: null, contactVia: null, contactReason: null,
    segmentInterest: null, studentCount: null, howFoundUs: null,
    wantsVisit: false, message: '',
  });
  const [errors,       setErrors]       = useState<Errors>({});
  const [submitting,   setSubmitting]   = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [legalConsent, setLegalConsent] = useState(false);

  const selectedReason = useMemo(
    () => contactReasons.find((r) => r.value === form.contactReason) ?? null,
    [contactReasons, form.contactReason],
  );

  const set = (key: keyof FormState, value: unknown) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Errors = {};
    if (!form.name.trim())  errs.name  = 'Nome obrigatório';
    if (!form.phone.trim()) errs.phone = 'Celular obrigatório';
    else if (form.phone.replace(/\D/g, '').length < 11)
      errs.phone = 'Celular incompleto (DDD + 9 dígitos)';
    if (requiredFields.has('email') && !form.email.trim())
      errs.email = 'E-mail obrigatório';
    else if (form.email.trim() && !validateEmail(form.email))
      errs.email = 'E-mail inválido';
    if ((selectedReason?.require_message || requiredFields.has('mensagem')) && !form.message.trim())
      errs.message = 'Descreva o motivo do seu contato';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const { error } = await supabase.from('contact_requests').insert({
        name:             form.name,
        phone:            form.phone,
        email:            form.email || null,
        best_time:        form.bestTime,
        contact_via:      form.contactVia,
        contact_reason:   form.contactReason,
        segment_interest: form.segmentInterest,
        student_count:    form.studentCount,
        how_found_us:     form.howFoundUs,
        wants_visit:      form.wantsVisit,
        message:          form.message || null,
      });
      if (error) throw error;

      // Registrar aceite LGPD
      saveConsent({
        formType: 'contact',
        holderName: form.name,
        holderEmail: form.email || undefined,
      });

      // Se quer agendar visita → redireciona com dados preenchidos
      if (form.wantsVisit) {
        navigate('/agendar-visita', {
          state: { name: form.name, phone: form.phone, email: form.email },
        });
        return;
      }

      setSubmitResult('success');
    } catch (err) {
      console.error(err);
      setSubmitResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  const SEGMENTS = [
    { value: 'educacao_infantil' as Segment, label: 'Educação Infantil', sub: '2 a 5 anos' },
    { value: 'fundamental_1'    as Segment, label: 'Fundamental I',      sub: '1º ao 5º ano' },
    { value: 'fundamental_2'    as Segment, label: 'Fundamental II',     sub: '6º ao 9º ano' },
    { value: 'ensino_medio'     as Segment, label: 'Ensino Médio',       sub: '1º a 3º ano' },
  ];

  return (
    <div className="min-h-screen">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative h-[55vh] min-h-[400px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Colégio Batista"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#003876]/95 via-[#003876]/80 to-[#002855]/70" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        <div className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            <div className="hero-badge inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-[#ffd700] rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-medium tracking-wide">{heroBadge}</span>
            </div>
            <h1 className="hero-text-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              {(() => {
                if (!heroHL || !heroTitle.includes(heroHL)) return heroTitle;
                const parts = heroTitle.split(heroHL);
                return <>{parts[0]}<span className="italic text-[#ffd700]">{heroHL}</span>{parts[1]}</>;
              })()}
            </h1>
            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-[#ffd700] to-[#ffe44d] rounded-full mb-8" />
            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed">
              {heroSubtitle}
            </p>
          </div>
        </div>
      </section>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-[var(--surface)]">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12">

            {/* ── Info sidebar ── */}
            <aside className="lg:col-span-2 space-y-6" ref={infoRef}>
              <div data-reveal="up">
                <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#ffd700] mb-2">Informações</p>
                <h2 className="font-display text-3xl font-bold text-[#003876] mb-1">Estamos aqui</h2>
                <div className="section-divider mt-3 mb-6" />
              </div>

              {[
                {
                  icon: Phone,
                  title: 'Telefone',
                  lines: [instPhone],
                },
                {
                  icon: MapPin,
                  title: 'Endereço',
                  lines: instAddress,
                },
                ...(instHoursLines.length > 0
                  ? [{
                      icon: Clock,
                      title: 'Horário de Atendimento',
                      lines: instHoursLines,
                    }]
                  : []),
              ].map(({ icon: Icon, title, lines }, i) => (
                <div
                  key={title}
                  className="flex items-start gap-4"
                  data-reveal="up"
                  style={{ '--delay': `${0.1 + i * 0.1}s` } as React.CSSProperties}
                >
                  <div className="w-11 h-11 bg-[#003876] rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-[#003876]/20">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#003876] text-sm mb-0.5">{title}</p>
                    {lines.map((l) => <p key={l} className="text-gray-600 text-sm">{l}</p>)}
                  </div>
                </div>
              ))}

              {/* WhatsApp CTA */}
              <div
                className="mt-2 p-5 bg-[#003876] rounded-2xl text-white"
                data-reveal="up"
                style={{ '--delay': '0.4s' } as React.CSSProperties}
              >
                <p className="font-display text-lg font-bold mb-1">Prefere o WhatsApp?</p>
                <p className="text-white/70 text-sm mb-4">Atendemos também pelo WhatsApp em horário comercial.</p>
                <a
                  href="https://wa.me/5581991398203?text=Olá, vim do site e queria mais informações"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 bg-[#ffd700] text-[#003876] px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-[#ffe44d] transition-all duration-300"
                >
                  Chamar no WhatsApp
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
            </aside>

            {/* ── Form ── */}
            <div className="lg:col-span-3" ref={formRef}>
              <div
                className="bg-white rounded-2xl shadow-xl shadow-[#003876]/5 p-8 border border-gray-100"
                data-reveal="up"
              >
                {submitResult === 'success' ? (
                  <div className="text-center py-12">
                    <div className="flex justify-center mb-6">
                      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                      </div>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-[#003876] mb-3">Mensagem enviada!</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                      Recebemos seu contato e retornaremos em breve no horário indicado.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate className="space-y-6">

                    {/* Dados pessoais */}
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#003876] mb-4 pb-2 border-b border-gray-100">
                        Dados pessoais
                      </h3>
                      <div className="space-y-4">
                        <Field label="Nome completo" required={requiredFields.has('nome')} icon={User} error={errors.name}>
                          <input
                            type="text"
                            placeholder="Seu nome completo"
                            className={inputCls(errors.name)}
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                          />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field label="Celular" required={requiredFields.has('celular')} icon={Phone} error={errors.phone}>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="(00) 00000-0000"
                              maxLength={15}
                              className={inputCls(errors.phone)}
                              value={form.phone}
                              onChange={(e) => set('phone', maskPhone(e.target.value))}
                            />
                          </Field>

                          <Field label="E-mail" required={requiredFields.has('email')} icon={Mail} error={errors.email}>
                            <input
                              type="email"
                              placeholder="email@exemplo.com (opcional)"
                              className={inputCls(errors.email)}
                              value={form.email}
                              onChange={(e) => set('email', e.target.value)}
                              onBlur={() => {
                                if (form.email && !validateEmail(form.email))
                                  setErrors((er) => ({ ...er, email: 'E-mail inválido' }));
                              }}
                            />
                          </Field>
                        </div>

                        {/* Melhor horário */}
                        <ToggleGroup
                          label="Melhor horário para contato"
                          value={form.bestTime}
                          onChange={(v) => set('bestTime', v)}
                          options={[
                            { value: 'morning',   label: 'Manhã',  icon: <Sunrise className="w-4 h-4" /> },
                            { value: 'afternoon', label: 'Tarde', icon: <Sunset className="w-4 h-4" /> },
                          ]}
                        />

                        {/* Melhor meio de contato */}
                        <ToggleGroup
                          label="Melhor meio de contato"
                          value={form.contactVia}
                          onChange={(v) => set('contactVia', v)}
                          options={[
                            { value: 'phone_call', label: 'Ligação',  icon: <PhoneCall className="w-4 h-4" /> },
                            { value: 'whatsapp',   label: 'WhatsApp', icon: <MessageCircle className="w-4 h-4" /> },
                            ...(form.email.trim()
                              ? [{ value: 'email' as ContactVia & string, label: 'E-mail', icon: <Mail className="w-4 h-4" /> }]
                              : []),
                          ]}
                        />

                        {/* Motivo do contato */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2.5">
                            Motivo do contato
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {contactReasons.map(({ value, label, icon: Icon }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set('contactReason', value)}
                                className={[
                                  'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left text-sm transition-all duration-200',
                                  form.contactReason === value
                                    ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#003876]/40 hover:text-[#003876]',
                                ].join(' ')}
                              >
                                <Icon className={`w-4 h-4 shrink-0 ${
                                  form.contactReason === value ? 'text-[#ffd700]' : 'text-gray-400'
                                }`} />
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Qualificação — só exibe se motivo é matrícula ou conhecer estrutura */}
                    {(form.contactReason === 'matricula' || form.contactReason === 'conhecer_estrutura') && (
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#003876] mb-4 pb-2 border-b border-gray-100">
                        Sobre sua família
                      </h3>
                      <div className="space-y-5">

                        {/* Segmento */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Qual segmento educacional tem interesse?
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {SEGMENTS.map((seg) => (
                              <button
                                key={seg.value}
                                type="button"
                                onClick={() => set('segmentInterest', seg.value)}
                                className={[
                                  'flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-all duration-200',
                                  form.segmentInterest === seg.value
                                    ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#003876]/40 hover:text-[#003876]',
                                ].join(' ')}
                              >
                                <span className="font-semibold text-sm">{seg.label}</span>
                                <span className={`text-xs mt-0.5 ${form.segmentInterest === seg.value ? 'text-white/70' : 'text-gray-400'}`}>
                                  {seg.sub}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Qtd alunos */}
                        <ToggleGroup
                          label="Quantos filhos pretende matricular?"
                          value={form.studentCount}
                          onChange={(v) => set('studentCount', v)}
                          options={[
                            { value: '1',  label: '1 filho' },
                            { value: '2',  label: '2 filhos' },
                            { value: '3+', label: '3 ou mais' },
                          ]}
                        />

                        {/* Como nos conheceu */}
                        <ToggleGroup
                          label="Como nos conheceu?"
                          value={form.howFoundUs}
                          onChange={(v) => set('howFoundUs', v)}
                          options={[
                            { value: 'indicacao',       label: 'Indicação' },
                            { value: 'redes_sociais',   label: 'Redes sociais' },
                            { value: 'google',          label: 'Google' },
                            { value: 'passou_na_frente',label: 'Passou em frente' },
                            { value: 'outro',           label: 'Outro' },
                          ]}
                        />

                        {/* Quer agendar visita */}
                        <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-xl border border-gray-100">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Gostaria de agendar uma visita?</p>
                            <p className="text-xs text-gray-400 mt-0.5">Conheça nossas instalações pessoalmente</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => set('wantsVisit', !form.wantsVisit)}
                            className={[
                              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                              form.wantsVisit ? 'bg-[#003876]' : 'bg-gray-200',
                            ].join(' ')}
                            role="switch"
                            aria-checked={form.wantsVisit}
                          >
                            <span className={[
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
                              form.wantsVisit ? 'translate-x-5' : 'translate-x-0',
                            ].join(' ')} />
                          </button>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Mensagem / Observações */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {selectedReason?.require_message
                          ? <>Detalhe sua solicitação <span className="text-red-500">*</span></>
                          : 'Observações ou dúvidas'
                        }
                      </label>
                      {selectedReason?.require_message && (
                        <p className="text-xs text-gray-400 mb-2">
                          Descreva brevemente o motivo do seu contato para que possamos ajudar melhor.
                        </p>
                      )}
                      <div className="relative">
                        <MessageSquare className="absolute left-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                        <textarea
                          rows={3}
                          placeholder={selectedReason?.require_message
                            ? 'Descreva o motivo do seu contato...'
                            : 'Fique à vontade para escrever... (opcional)'
                          }
                          className={[
                            'w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none transition-colors',
                            errors.message
                              ? 'border-red-400 bg-red-50 focus:ring-red-300'
                              : 'border-gray-200 bg-white focus:ring-[#003876]',
                          ].join(' ')}
                          value={form.message}
                          onChange={(e) => set('message', e.target.value)}
                        />
                      </div>
                      {errors.message && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {errors.message}
                        </p>
                      )}
                    </div>

                    {/* Legal consent */}
                    <LegalConsent checked={legalConsent} onChange={setLegalConsent} />

                    {/* Error feedback */}
                    {submitResult === 'error' && (
                      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
                        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Erro ao enviar mensagem.</p>
                          <p className="text-red-700 mt-0.5">Verifique sua conexão e tente novamente.</p>
                        </div>
                      </div>
                    )}

                    {/* Submit */}
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting || !legalConsent}
                        className="inline-flex items-center gap-2 bg-[#ffd700] text-[#003876] px-8 py-4 rounded-xl font-bold text-sm transition-all duration-300 hover:bg-white hover:shadow-lg hover:shadow-[#ffd700]/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#ffd700] disabled:hover:shadow-none"
                      >
                        {submitting
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                          : <>Enviar mensagem <Send className="w-4 h-4" /></>}
                      </button>
                    </div>

                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
