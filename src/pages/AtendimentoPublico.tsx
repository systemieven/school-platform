/**
 * AtendimentoPublico
 *
 * Página acessada via QR Code na recepção. Fluxo em 4 steps:
 *   1. Entrada do telefone (com máscara)
 *   2. Dry-run do check-in → valida elegibilidade (agendamento encontrado)
 *      + mostra opção de walk-in quando habilitado
 *   3. Pedido de geolocalização (navigator.geolocation)
 *   4. Checkin real → ticket emitido, tela da senha aparece
 *
 * Depois de receber a senha a página se converte num painel dinâmico
 * mostrando a senha do visitante, o estado do atendimento, a última
 * senha chamada e um aviso sonoro quando o cliente for chamado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Phone,
  Loader2,
  Ticket,
  MapPin,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Bell,
  Clock,
  Hourglass,
  Star,
  LayoutGrid,
  // Icons used by ICON_MAP para os motivos de visita (espelha AgendarVisita)
  Users,
  User,
  FileText,
  Building2,
  BookOpen,
  BookMarked,
  GraduationCap,
  MessageCircle,
  MessageSquare,
  Calendar,
  ClipboardList,
  PenLine,
  Briefcase,
  Heart,
  Home,
  HelpCircle,
  Award,
  UserCheck,
  Handshake,
  Baby,
  Bus,
  Mail,
} from 'lucide-react';

type Step = 'phone' | 'validating' | 'eligible' | 'walkin' | 'locating' | 'issued' | 'error';

/**
 * Espelho público do AttendanceQuestion do admin. Declarado aqui para não
 * acoplar a página pública aos types do admin; o shape precisa ficar
 * sincronizado manualmente.
 */
type PublicQuestionType =
  | 'rating'
  | 'text'
  | 'single_choice'
  | 'multi_choice'
  | 'scale'
  | 'yes_no'
  | 'emoji';

interface PublicQuestion {
  id: string;
  label: string;
  type: PublicQuestionType;
  // Rating
  max?: number;
  // Single/multi choice
  options?: string[];
  // Scale
  min?: number;
  step?: number;
  min_label?: string;
  max_label?: string;
}

/** Valor aceito para uma resposta (payload enviado ao attendance-feedback). */
type AnswerValue = number | string | string[];

interface Sector { key: string; label: string; icon?: string }

/**
 * Mesmo mapa usado em AgendarVisita — mantem o icone cadastrado em
 * /admin/configuracoes/visitas sincronizado com o que o cliente ve no
 * walk-in. Se a chave vier desconhecida ou vazia, cai em FileText.
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Users, User, FileText,
  BookOpen, BookMarked, GraduationCap, MessageCircle, MessageSquare,
  Calendar, ClipboardList, PenLine, Briefcase, Heart, Star,
  Phone, Mail, Home, HelpCircle, Award, UserCheck, Handshake, Baby, Bus,
};

interface PublicConfig {
  school_name: string | null;
  client_screen_fields: {
    show_last_called?: boolean;
    show_sector?: boolean;
    show_wait_estimate?: boolean;
    show_instructions?: boolean;
    instructions_text?: string;
  } | null;
  ticket_format: unknown;
  sound: { enabled?: boolean; preset?: 'bell' | 'chime' | 'ding' | 'buzzer' } | null;
  estimated_service_time: Record<string, number> | null;
  allow_walkins: { enabled?: boolean };
  feedback: {
    enabled?: boolean;
    prompt_text?: string;
    scale?: 'stars' | 'numeric';
    max?: number;
    allow_comments?: boolean;
    custom_questions_enabled?: boolean;
    questions?: PublicQuestion[];
  } | null;
  geolocation: { latitude: number | null; longitude: number | null; radius_m: number } | null;
  sectors: Sector[];
}

interface TicketRow {
  id: string;
  ticket_number: string;
  sector_key: string;
  sector_label: string;
  status: 'waiting' | 'called' | 'in_service' | 'finished' | 'abandoned' | 'no_show';
  issued_at: string;
  called_at: string | null;
  finished_at: string | null;
}

const SOUND_FILES: Record<string, string> = {
  bell:   '/sounds/attendance-bell.mp3',
  chime:  '/sounds/attendance-chime.mp3',
  ding:   '/sounds/attendance-ding.mp3',
  buzzer: '/sounds/attendance-buzzer.mp3',
};

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : '';
  if (d.length <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Deriva uma sigla de ate 2 letras a partir do nome da instituicao, pulando
 * preposicoes comuns. Ex: "Colégio Batista em Caruaru" → "CB".
 * Usada apenas como fallback visual no badge dourado do header.
 */
function deriveInitials(name: string): string {
  const stopwords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no']);
  const letters = name
    .split(/\s+/)
    .filter((w) => w && !stopwords.has(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() || '')
    .filter(Boolean);
  return (letters[0] || '') + (letters[1] || '');
}

export default function AtendimentoPublico() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);

  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [walkinName, setWalkinName] = useState('');
  const [walkinSector, setWalkinSector] = useState<string>('');

  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [lastCalled, setLastCalled] = useState<{ ticket_number: string; sector_label: string } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const calledOnceRef = useRef(false);

  // ── Load public config once ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.functions
      .invoke('attendance-public-config', { method: 'GET' })
      .then(({ data, error: invokeErr }) => {
        if (invokeErr) {
          console.error(invokeErr);
          return;
        }
        setConfig(data as PublicConfig);
      });
  }, []);

  // ── Poll last called ticket (lightweight) ──────────────────────────────────
  useEffect(() => {
    if (!config?.client_screen_fields?.show_last_called) return;

    const fetchLastCalled = async () => {
      const { data } = await supabase
        .from('attendance_tickets')
        .select('ticket_number, sector_label')
        .eq('status', 'called')
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLastCalled(data as { ticket_number: string; sector_label: string });
    };

    fetchLastCalled();
    const id = setInterval(fetchLastCalled, 10000);
    return () => clearInterval(id);
  }, [config]);

  // ── Subscribe to our ticket updates after issued ───────────────────────────
  useEffect(() => {
    if (!ticket) return;

    const channel = supabase
      .channel(`public-ticket-${ticket.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attendance_tickets', filter: `id=eq.${ticket.id}` },
        (payload) => {
          const next = payload.new as TicketRow;
          setTicket((prev) => (prev ? { ...prev, ...next } : next));
          if (next.status === 'called' && !calledOnceRef.current) {
            calledOnceRef.current = true;
            // Play sound
            if (config?.sound?.enabled) {
              const file = SOUND_FILES[config.sound.preset || 'bell'];
              try {
                const audio = new Audio(file);
                audioRef.current = audio;
                audio.play().catch(() => { /* autoplay blocked */ });
              } catch { /* ignore */ }
            }
            // Vibrate on mobile
            if ('vibrate' in navigator) navigator.vibrate?.([300, 150, 300]);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket, config]);

  // ── Submit phone (dry-run) ─────────────────────────────────────────────────
  const submitPhone = useCallback(async () => {
    const digits = digitsOnly(phone);
    if (digits.length < 10) {
      setError('Informe um telefone válido.');
      return;
    }
    setError(null);
    setStep('validating');
    setLoadingMsg('Verificando agendamento…');

    const { data, error: invokeErr } = await supabase.functions.invoke('attendance-checkin', {
      body: { phone: digits, dry: true },
    });
    setLoadingMsg(null);

    if (invokeErr) {
      setError('Erro ao verificar agendamento. Tente novamente.');
      setStep('phone');
      return;
    }

    const result = data as {
      eligible?: boolean;
      error_code?: string;
      message?: string;
      appointment?: { appointment_date: string; appointment_time: string; visit_reason: string };
      walkin_required?: boolean;
    };

    if (result.eligible && result.appointment) {
      setStep('eligible');
    } else if (result.walkin_required || (result.error_code === 'no_appointment' && config?.allow_walkins.enabled)) {
      setStep('walkin');
    } else {
      setError(result.message || 'Nenhum agendamento encontrado para este telefone.');
      setStep('phone');
    }
  }, [phone, config]);

  // ── Request geolocation + real check-in ────────────────────────────────────
  const performCheckin = useCallback(
    async (body: Record<string, unknown>) => {
      setStep('locating');
      setLoadingMsg('Solicitando sua localização…');
      setError(null);

      if (!('geolocation' in navigator)) {
        setError('Seu navegador não suporta geolocalização.');
        setStep('error');
        setLoadingMsg(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setLoadingMsg('Gerando sua senha…');
          const { data, error: invokeErr } = await supabase.functions.invoke('attendance-checkin', {
            body: {
              ...body,
              phone: digitsOnly(phone),
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          });
          setLoadingMsg(null);

          if (invokeErr) {
            setError('Erro ao gerar senha. Tente novamente.');
            setStep('error');
            return;
          }

          const result = data as {
            ok?: boolean;
            error?: string;
            message?: string;
            ticket?: TicketRow;
          };

          if (result?.ticket) {
            setTicket(result.ticket);
            setStep('issued');
          } else {
            setError(result.message || 'Não foi possível gerar sua senha.');
            setStep('error');
          }
        },
        (err) => {
          setLoadingMsg(null);
          setError(
            err.code === err.PERMISSION_DENIED
              ? 'Precisamos da sua localização para confirmar que você está na instituição.'
              : 'Não conseguimos obter sua localização.',
          );
          setStep('error');
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    },
    [phone],
  );

  const elapsedWait = useTimer(ticket?.issued_at || null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const schoolName = config?.school_name?.trim() || 'Instituição';
  const schoolInitials = useMemo(() => {
    const fromName = deriveInitials(schoolName);
    return fromName || '??';
  }, [schoolName]);

  const estimatedLabel = useMemo(() => {
    if (!ticket || !config?.estimated_service_time) return null;
    const minutes = config.estimated_service_time[ticket.sector_key];
    if (!minutes) return null;
    return `~${minutes} min`;
  }, [ticket, config]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003876] to-[#001f44] text-white flex flex-col items-center justify-start px-4 py-8">
      {/* Brand header */}
      <div className="w-full max-w-md flex items-center gap-3 mb-8">
        <div className="w-11 h-11 bg-[#ffd700] rounded-xl flex items-center justify-center">
          <span className="text-[#003876] font-bold text-sm">{schoolInitials}</span>
        </div>
        <div>
          <p className="font-display font-bold text-lg leading-tight">{schoolName}</p>
          <p className="text-xs text-white/60">Atendimento presencial</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white text-gray-800 rounded-3xl shadow-2xl overflow-hidden">
        {step === 'phone' && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-[#003876]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Phone className="w-6 h-6 text-[#003876]" />
              </div>
              <h1 className="font-display text-2xl font-bold text-[#003876]">Bem-vindo!</h1>
              <p className="text-sm text-gray-500 mt-1">
                Digite seu telefone para gerar sua senha de atendimento.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Celular</label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={submitPhone}
              className="w-full py-3.5 rounded-xl bg-[#003876] text-white font-semibold hover:bg-[#002255] transition-colors inline-flex items-center justify-center gap-2"
            >
              Continuar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'validating' && (
          <div className="p-10 text-center">
            <Loader2 className="w-8 h-8 text-[#003876] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">{loadingMsg}</p>
          </div>
        )}

        {step === 'eligible' && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="font-display text-2xl font-bold text-[#003876]">Agendamento encontrado!</h1>
              <p className="text-sm text-gray-500 mt-1">
                Para confirmar sua presença, precisamos da sua localização.
              </p>
            </div>

            <button
              onClick={() => performCheckin({})}
              className="w-full py-3.5 rounded-xl bg-[#003876] text-white font-semibold hover:bg-[#002255] transition-colors inline-flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Gerar senha de atendimento
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full py-2 text-xs text-gray-400 hover:text-[#003876] transition-colors"
            >
              Voltar
            </button>
          </div>
        )}

        {step === 'walkin' && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <h1 className="font-display text-xl font-bold text-[#003876]">Sem agendamento prévio</h1>
              <p className="text-sm text-gray-500 mt-1">
                Não encontramos um agendamento para este telefone.
                Confirme seus dados abaixo para atendimento imediato.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome completo</label>
              <input
                type="text"
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                placeholder="Como gostaria de ser chamado"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Celular verificado</p>
                <p className="text-sm font-semibold text-[#003876] truncate">{maskPhone(phone)}</p>
              </div>
              <button
                type="button"
                onClick={() => { setError(null); setStep('phone'); }}
                className="text-[11px] font-medium text-[#003876] hover:underline flex-shrink-0"
              >
                Alterar
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Motivo da visita <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config?.sectors.map((s) => {
                  const Icon = (s.icon && ICON_MAP[s.icon]) || FileText;
                  const active = walkinSector === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => { setWalkinSector(s.key); setError(null); }}
                      className={`
                        flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left text-sm transition-all duration-200
                        ${active
                          ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#003876]/30 hover:text-[#003876]'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#ffd700]' : 'text-gray-400'}`} />
                      <span className="leading-tight">{s.label}</span>
                    </button>
                  );
                })}
              </div>
              {config?.sectors.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Nenhum motivo de visita cadastrado. Contate a recepção.
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={() => {
                // Telefone ja foi validado e confirmado no step 'phone'; aqui
                // so validamos os campos especificos do walkin.
                if (!walkinName.trim()) {
                  setError('Informe seu nome completo.');
                  return;
                }
                if (!walkinSector) {
                  setError('Selecione o motivo da visita.');
                  return;
                }
                setError(null);
                performCheckin({
                  walkin_name: walkinName.trim(),
                  walkin_sector: walkinSector,
                });
              }}
              className="w-full py-3.5 rounded-xl bg-[#003876] text-white font-semibold hover:bg-[#002255] transition-colors inline-flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Gerar senha
            </button>
            <button
              onClick={() => { setError(null); setStep('phone'); }}
              className="w-full py-2 text-xs text-gray-400 hover:text-[#003876] transition-colors"
            >
              Voltar
            </button>
          </div>
        )}

        {step === 'locating' && (
          <div className="p-10 text-center">
            <Loader2 className="w-8 h-8 text-[#003876] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">{loadingMsg || 'Processando…'}</p>
          </div>
        )}

        {step === 'error' && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h1 className="font-display text-xl font-bold text-[#003876]">Não foi possível continuar</h1>
              <p className="text-sm text-gray-500 mt-2">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setStep('phone'); }}
              className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {step === 'issued' && ticket && (
          <div className="p-6 space-y-5">
            {/* Big ticket number */}
            <div className="text-center">
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-gray-400">Sua senha</p>
              <p className="font-display text-6xl font-bold text-[#003876] leading-none my-3">
                {ticket.ticket_number}
              </p>
              {config?.client_screen_fields?.show_sector !== false && (
                <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  {ticket.sector_label}
                </p>
              )}
            </div>

            {/* Status banner */}
            {ticket.status === 'waiting' && (
              <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-center">
                <p className="text-xs font-semibold text-amber-700 flex items-center justify-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5" />
                  Aguardando ser chamado
                </p>
                {elapsedWait && <p className="text-[11px] text-amber-600 mt-0.5">há {elapsedWait}</p>}
              </div>
            )}
            {ticket.status === 'called' && (
              <div className="rounded-2xl bg-[#003876] text-white border border-[#003876] px-4 py-4 text-center animate-pulse">
                <p className="text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5">
                  <Bell className="w-4 h-4" />
                  Você foi chamado!
                </p>
                <p className="text-[11px] text-white/80 mt-1">Dirija-se ao atendimento.</p>
              </div>
            )}
            {ticket.status === 'in_service' && (
              <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-center">
                <p className="text-xs font-semibold text-indigo-700">Em atendimento</p>
              </div>
            )}
            {ticket.status === 'finished' && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-center">
                <p className="text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Atendimento finalizado
                </p>
              </div>
            )}

            {/* Secondary info */}
            <div className="space-y-2">
              {config?.client_screen_fields?.show_last_called && lastCalled && ticket.status === 'waiting' && (
                <div className="flex items-center justify-between text-xs text-gray-500 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                  <span>Última senha chamada</span>
                  <span className="font-semibold text-[#003876]">{lastCalled.ticket_number}</span>
                </div>
              )}
              {config?.client_screen_fields?.show_wait_estimate && estimatedLabel && ticket.status === 'waiting' && (
                <div className="flex items-center justify-between text-xs text-gray-500 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />Tempo estimado</span>
                  <span className="font-semibold text-[#003876]">{estimatedLabel}</span>
                </div>
              )}
            </div>

            {/* Instructions */}
            {config?.client_screen_fields?.show_instructions && config.client_screen_fields.instructions_text && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <p className="text-xs text-blue-700 leading-relaxed">
                  {config.client_screen_fields.instructions_text}
                </p>
              </div>
            )}

            {/* Feedback form (after finished) */}
            {ticket.status === 'finished' && config?.feedback?.enabled && (
              <FeedbackForm ticketId={ticket.id} config={config.feedback} />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-white/40 mt-6">
        <Ticket className="inline w-3 h-3 mr-1" />
        Sistema de Atendimento • {schoolName}
      </p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function useTimer(isoStart: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isoStart) { setLabel(null); return; }
    const calc = () => {
      const secs = Math.max(0, Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000));
      if (secs < 60) setLabel(`${secs}s`);
      else {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        setLabel(`${m}m ${s.toString().padStart(2, '0')}s`);
      }
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [isoStart]);

  return label;
}

// ── Feedback form ────────────────────────────────────────────────────────────

interface FeedbackFormProps {
  ticketId: string;
  config: NonNullable<PublicConfig['feedback']>;
}

const EMOJI_SCALE = ['😡', '😕', '😐', '🙂', '😍'];

function FeedbackForm({ ticketId, config }: FeedbackFormProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [comments, setComments] = useState('');
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = config.max || 5;
  const questions = (config.custom_questions_enabled && config.questions) || [];

  const setAnswer = (id: string, value: AnswerValue) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  async function submit() {
    if (rating === null) {
      setError('Selecione uma avaliação.');
      return;
    }
    // Exige resposta em toda pergunta personalizada (texto livre aceita vazio?
    // Melhor exigir — se o admin adicionou, é porque quer). Multi-choice precisa
    // de pelo menos 1 item selecionado.
    for (const q of questions) {
      const v = answers[q.id];
      if (q.type === 'text') {
        if (typeof v !== 'string' || v.trim().length === 0) {
          setError(`Responda: "${q.label || 'pergunta em branco'}"`);
          return;
        }
      } else if (q.type === 'multi_choice') {
        if (!Array.isArray(v) || v.length === 0) {
          setError(`Selecione ao menos uma opção em: "${q.label || 'pergunta em branco'}"`);
          return;
        }
      } else {
        if (v === undefined || v === null || v === '') {
          setError(`Responda: "${q.label || 'pergunta em branco'}"`);
          return;
        }
      }
    }
    setSubmitting(true);
    setError(null);
    const { data, error: invokeErr } = await supabase.functions.invoke('attendance-feedback', {
      body: {
        ticket_id: ticketId,
        rating,
        answers,
        comments: comments.trim() || null,
      },
    });
    setSubmitting(false);
    if (invokeErr || (data as { error?: string })?.error) {
      setError(((data as { message?: string })?.message) || 'Erro ao enviar feedback.');
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-4 text-center">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
        <p className="text-sm font-semibold text-emerald-700">Obrigado pelo seu feedback!</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 px-4 py-4 space-y-4">
      <p className="text-sm font-semibold text-gray-700 text-center">
        {config.prompt_text?.trim() || 'Como foi seu atendimento?'}
      </p>

      {/* Avaliação principal — sempre presente, estrelas */}
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: max }).map((_, i) => {
          const value = i + 1;
          const active = rating !== null && value <= rating;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setRating(value)}
              className="p-1"
            >
              <Star className={`w-7 h-7 transition-colors ${active ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
            </button>
          );
        })}
      </div>

      {/* Perguntas personalizadas */}
      {questions.map((q) => (
        <QuestionField
          key={q.id}
          question={q}
          value={answers[q.id]}
          onChange={(v) => setAnswer(q.id, v)}
        />
      ))}

      {config.allow_comments && (
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Comentário (opcional)"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
        />
      )}

      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full py-2.5 rounded-xl bg-[#003876] text-white text-sm font-semibold hover:bg-[#002255] disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Enviando…' : 'Enviar avaliação'}
      </button>
    </div>
  );
}

// ── QuestionField ────────────────────────────────────────────────────────────
// Renderer individual por tipo. Cada tipo tem sua própria UI, mas todos
// seguem o mesmo contrato: recebem value (undefined quando ainda não
// respondido) e emitem onChange com o AnswerValue apropriado ao tipo.

interface QuestionFieldProps {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
}

function QuestionField({ question, value, onChange }: QuestionFieldProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">{question.label || '—'}</p>
      {renderFieldInput(question, value, onChange)}
    </div>
  );
}

function renderFieldInput(
  q: PublicQuestion,
  value: AnswerValue | undefined,
  onChange: (v: AnswerValue) => void,
) {
  if (q.type === 'rating') {
    const max = q.max ?? 5;
    const current = typeof value === 'number' ? value : 0;
    return (
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: max }).map((_, i) => {
          const v = i + 1;
          const active = v <= current;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(v)}
              className="p-1"
            >
              <Star className={`w-6 h-6 transition-colors ${active ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'text') {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Escreva sua resposta…"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
      />
    );
  }

  if (q.type === 'single_choice') {
    const options = q.options ?? [];
    const current = typeof value === 'string' ? value : null;
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = current === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                active
                  ? 'bg-[#003876] text-white border-[#003876] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#003876] hover:text-[#003876]'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'multi_choice') {
    const options = q.options ?? [];
    const current = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = current.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next = active
                  ? current.filter((x) => x !== opt)
                  : [...current, opt];
                onChange(next);
              }}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                active
                  ? 'bg-[#003876] text-white border-[#003876] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#003876] hover:text-[#003876]'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'yes_no') {
    const current = typeof value === 'string' ? value : null;
    return (
      <div className="grid grid-cols-2 gap-2">
        {['Sim', 'Não'].map((opt) => {
          const active = current === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                active
                  ? 'bg-[#003876] text-white border-[#003876] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#003876] hover:text-[#003876]'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'scale') {
    const min = q.min ?? 0;
    const max = q.max ?? 10;
    const step = q.step ?? 1;
    const current = typeof value === 'number' ? value : min;
    const pct = ((current - min) / Math.max(1, max - min)) * 100;
    return (
      <div className="space-y-1.5">
        <div className="relative h-6 flex items-center">
          <div className="absolute w-full h-1.5 bg-gray-200 rounded-full" />
          <div
            className="absolute h-1.5 bg-[#003876] rounded-full pointer-events-none"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={current}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="absolute w-full appearance-none bg-transparent cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]
              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]"
          />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-400">{q.min_label || min}</span>
          <span className="font-semibold text-[#003876]">{current}</span>
          <span className="text-gray-400">{q.max_label || max}</span>
        </div>
      </div>
    );
  }

  if (q.type === 'emoji') {
    const current = typeof value === 'number' ? value : 0;
    return (
      <div className="flex items-center justify-between gap-1">
        {EMOJI_SCALE.map((emoji, i) => {
          const v = i + 1;
          const active = current === v;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(v)}
              className={`flex-1 py-2 rounded-xl text-2xl transition-all border ${
                active
                  ? 'bg-[#003876]/5 border-[#003876] scale-110 shadow-md'
                  : 'bg-white border-gray-200 grayscale hover:grayscale-0 hover:border-[#003876]/50'
              }`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}
