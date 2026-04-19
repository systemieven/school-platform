/**
 * TrabalheConosco — Wizard público para captação de currículos.
 *
 * Fluxo em 5 passos:
 *   1. Escolher área (pedagógica / administrativa / serviços gerais)
 *   2. Ver vagas da área OU seguir para cadastro reserva
 *   3. Formulário + upload de CV (PDF/JPG/PNG)
 *   4. Chat com o agente `pre_screening_interviewer` (4-6 turnos)
 *   5. Agradecimento
 *
 * Backend: edge functions `careers-intake` (passo 3 → envia tudo) e
 * `careers-interview-turn` (passo 4 → chat). Conteúdo editável em
 * `system_settings` (category='content', key='careers').
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap, Briefcase, Wrench, FileText, Upload, Loader2,
  Send, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle, User,
  Mail, Phone, Sparkles, MessagesSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSEO } from '../hooks/useSEO';
import { useSettings } from '../hooks/useSettings';
import { extractPdfText } from '../lib/extractPdfText';
import HeroMedia from '../components/HeroMedia';
import HeroSlideshow from '../components/HeroSlideshow';
import type { HeroScene, HeroSlideshowConfig } from '../components/HeroSlideshow';
import LegalConsent from '../components/LegalConsent';
import { InputField } from '../admin/components/FormField';

type Area = 'pedagogica' | 'administrativa' | 'servicos_gerais';

interface AreaConfig {
  label: string;
  description: string;
  icon: string;
}
interface CareersContent {
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string | null;
  areas?: Record<Area, AreaConfig>;
  reserva_copy?: string;
  thank_you_title?: string;
  thank_you_message?: string;
  lgpd_consent_text?: string;
  captcha_enabled?: boolean;
  max_upload_mb?: number;
}

interface JobOpening {
  id: string;
  title: string;
  area: Area;
  description: string | null;
  requirements: string | null;
  employment_type: string | null;
  location: string | null;
  department: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

// Fallbacks quando o settings ainda não carregou
const DEFAULT_AREAS: Record<Area, AreaConfig> = {
  pedagogica: {
    label: 'Pedagógica',
    description: 'Professores, coordenadores pedagógicos, monitores e auxiliares de sala.',
    icon: 'GraduationCap',
  },
  administrativa: {
    label: 'Administrativa',
    description: 'Secretaria, financeiro, marketing, atendimento e áreas de apoio.',
    icon: 'Briefcase',
  },
  servicos_gerais: {
    label: 'Serviços Gerais',
    description: 'Limpeza, manutenção, cozinha, portaria e demais serviços de infraestrutura.',
    icon: 'Wrench',
  },
};

const AREA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap, Briefcase, Wrench,
};

const DEFAULT_SLIDESHOW: HeroSlideshowConfig = {
  default_duration: 8,
  order: 'sequential',
  transition: 'crossfade',
  transition_duration: 1200,
};

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const out = String(reader.result ?? '');
      // Strip data URL prefix — backend aceita ambos, mas enviamos só o base64 puro
      const comma = out.indexOf(',');
      resolve(comma >= 0 ? out.slice(comma + 1) : out);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read_error'));
    reader.readAsDataURL(file);
  });
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
}

export default function TrabalheConosco() {
  useSEO('trabalhe-conosco', { title: 'Trabalhe conosco' });

  const { settings } = useSettings('content');
  const content = (settings.careers ?? {}) as CareersContent;
  const areas = (content.areas ?? DEFAULT_AREAS) as Record<Area, AreaConfig>;
  const maxUploadMb = content.max_upload_mb ?? 5;

  // Hero editável via /admin/configuracoes → Site → Aparência → Vagas
  const { settings: appearanceSettings } = useSettings('appearance');
  const vagasConfig = (appearanceSettings.vagas as Record<string, unknown> | undefined) ?? {};
  const heroBadge     = (vagasConfig.badge as string | undefined)    || '';
  const heroTitle     = (vagasConfig.title as string | undefined)    || content.hero_title || '';
  const heroHL        = (vagasConfig.highlight as string | undefined) || '';
  const heroSubtitle  = (vagasConfig.subtitle as string | undefined) || content.hero_subtitle || '';
  const heroVideoUrl  = (vagasConfig.video_url as string | undefined) || '';
  const heroScenes    = (vagasConfig.scenes as HeroScene[] | undefined) ?? [];
  const heroSlideshow = (vagasConfig.slideshow as HeroSlideshowConfig | undefined) ?? DEFAULT_SLIDESHOW;
  const hasCustomHero = heroScenes.length > 0 || !!heroVideoUrl;

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [area, setArea] = useState<Area | null>(null);
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [loadingOpenings, setLoadingOpenings] = useState(false);
  const [jobOpeningId, setJobOpeningId] = useState<string | null>(null);
  const [isReserva, setIsReserva] = useState(false);

  // Passo 3
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [lgpdOk, setLgpdOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Passo 4
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingTurn, setSendingTurn] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [finalized, setFinalized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Carrega vagas quando área muda
  useEffect(() => {
    if (!area) { setOpenings([]); return; }
    setLoadingOpenings(true);
    (async () => {
      const { data, error } = await supabase
        .from('job_openings')
        .select('id, title, area, description, requirements, employment_type, location, department')
        .eq('area', area)
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (!error && data) setOpenings(data as JobOpening[]);
      setLoadingOpenings(false);
    })();
  }, [area]);

  useEffect(() => {
    if (step === 4) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, step]);

  const canSubmit = useMemo(() => (
    form.name.trim().length >= 3
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
    && form.phone.replace(/\D/g, '').length >= 10
    && !!file
    && lgpdOk
    && termsOk
  ), [form, file, lgpdOk, termsOk]);

  const handlePickArea = (a: Area) => {
    setArea(a);
    setStep(2);
  };

  const handlePickOpening = (id: string) => {
    setJobOpeningId(id);
    setIsReserva(false);
    setStep(3);
  };

  const handleReserva = () => {
    setJobOpeningId(null);
    setIsReserva(true);
    setStep(3);
  };

  const handleFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (!ALLOWED_MIME.includes(f.type)) {
      setSubmitError(`Formato não suportado. Envie PDF, JPG ou PNG.`);
      return;
    }
    if (f.size > maxUploadMb * 1024 * 1024) {
      setSubmitError(`Arquivo maior que ${maxUploadMb}MB.`);
      return;
    }
    setSubmitError(null);
    setFile(f);
  };

  const handleSubmitIntake = useCallback(async () => {
    if (!area || !canSubmit || !file) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Extrai texto se PDF (melhora o extractor no backend)
      let extractedText: string | undefined;
      if (file.type === 'application/pdf') {
        try {
          const res = await extractPdfText(file);
          extractedText = res.text;
        } catch {
          // não bloqueia — backend lida com fallback
        }
      }

      const content_base64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke('careers-intake', {
        body: {
          area,
          job_opening_id: jobOpeningId,
          candidate: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.replace(/\D/g, ''),
          },
          resume: {
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            content_base64,
            extracted_text: extractedText,
          },
          lgpd_consent: true,
        },
      });

      if (error) throw new Error(error.message ?? 'Falha ao enviar.');
      const res = data as { session_token?: string; error?: string; detail?: string };
      if (!res?.session_token) {
        throw new Error(res?.detail ?? res?.error ?? 'Resposta inválida do servidor.');
      }
      setSessionToken(res.session_token);
      setStep(4);

      // Dispara a primeira mensagem do agente
      void runTurn(res.session_token, null, true);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [area, canSubmit, file, form, jobOpeningId]);

  const runTurn = useCallback(async (token: string, userText: string | null, isStart: boolean) => {
    setSendingTurn(true);
    setChatError(null);
    try {
      if (userText) {
        setMessages((prev) => [...prev, { role: 'user', text: userText }]);
      }
      const { data, error } = await supabase.functions.invoke('careers-interview-turn', {
        body: {
          session_token: token,
          user_message: userText ?? '',
          start: isStart,
        },
      });
      if (error) throw new Error(error.message ?? 'Falha no chat.');
      const res = data as { assistant_message?: string; should_finalize?: boolean; error?: string };
      if (res?.error) throw new Error(res.error);
      const asst = (res?.assistant_message ?? '').trim();
      if (asst) setMessages((prev) => [...prev, { role: 'assistant', text: asst }]);
      if (res?.should_finalize) {
        setFinalized(true);
        setTimeout(() => setStep(5), 1500);
      }
    } catch (e) {
      setChatError((e as Error).message);
    } finally {
      setSendingTurn(false);
    }
  }, []);

  const handleSendChat = () => {
    if (!sessionToken || !chatInput.trim() || finalized) return;
    const msg = chatInput.trim();
    setChatInput('');
    void runTurn(sessionToken, msg, false);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero — configurável em /admin/configuracoes → Site → Aparência → Vagas */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden bg-brand-primary text-white">
        {/* Fundo: slideshow (cenas) quando configurado; senão imagem legada; senão só o gradiente */}
        <div className="absolute inset-0">
          {hasCustomHero ? (
            <HeroSlideshow scenes={heroScenes} config={heroSlideshow} fallbackVideoUrl={heroVideoUrl} />
          ) : content.hero_image_url ? (
            <HeroMedia url={content.hero_image_url} alt="" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/95 via-brand-primary/80 to-brand-primary-dark/70" />
        </div>

        {/* Slice diagonal decorativo (igual aos segmentos) */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gray-50 [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        <div className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            {heroBadge && (
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
                <span className="w-2 h-2 bg-brand-secondary rounded-full animate-pulse" />
                <span className="text-white/90 text-sm font-medium tracking-wide">{heroBadge}</span>
              </div>
            )}

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              {(() => {
                const title = heroTitle || 'Trabalhe conosco';
                if (!heroHL || !title.includes(heroHL)) return title;
                const parts = title.split(heroHL);
                return <>{parts[0]}<span className="italic text-brand-secondary">{heroHL}</span>{parts[1]}</>;
              })()}
            </h1>

            <div className="h-[3px] w-24 bg-gradient-to-r from-brand-secondary to-brand-secondary-light rounded-full mb-8" />

            <p className="text-lg md:text-xl text-white/85 max-w-xl leading-relaxed">
              {heroSubtitle || 'Junte-se à nossa equipe e contribua com a formação da próxima geração.'}
            </p>
          </div>
        </div>
      </section>

      {/* Stepper — abaixo do hero */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                step >= n ? 'bg-brand-primary w-10' : 'bg-gray-300 w-6'
              }`}
            />
          ))}
          <span className="ml-3 text-xs font-medium text-gray-500">Passo {step} de 5</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* ─── Step 1 ─── */}
        {step === 1 && (
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">
              Para qual área você gostaria de se candidatar?
            </h2>
            <p className="text-gray-600 mb-8">
              Escolha a área que mais combina com seu perfil profissional.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(Object.keys(areas) as Area[]).map((key) => {
                const cfg = areas[key];
                const Icon = AREA_ICONS[cfg.icon] ?? Briefcase;
                return (
                  <button
                    key={key}
                    onClick={() => handlePickArea(key)}
                    className="text-left p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-brand-primary hover:shadow-md transition-all"
                  >
                    <Icon className="w-8 h-8 text-brand-primary mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{cfg.label}</h3>
                    <p className="text-sm text-gray-600">{cfg.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Step 2 ─── */}
        {step === 2 && area && (
          <section>
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">
              Vagas abertas — {areas[area].label}
            </h2>
            <p className="text-gray-600 mb-6">
              Escolha uma vaga abaixo ou siga para cadastro reserva.
            </p>

            {loadingOpenings && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando vagas…
              </div>
            )}

            {!loadingOpenings && openings.length > 0 && (
              <div className="space-y-3 mb-6">
                {openings.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => handlePickOpening(o.id)}
                    className="w-full text-left p-5 bg-white rounded-xl border border-gray-200 hover:border-brand-primary hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{o.title}</h3>
                        {o.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{o.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                          {o.employment_type && <span className="uppercase">{o.employment_type}</span>}
                          {o.location && <span>• {o.location}</span>}
                          {o.department && <span>• {o.department}</span>}
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-brand-primary flex-shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loadingOpenings && openings.length === 0 && (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900">
                      Nenhuma vaga publicada no momento.
                    </h3>
                    <p className="text-sm text-amber-800 mt-1">
                      Você pode deixar seu currículo em nosso cadastro reserva —
                      entraremos em contato quando surgir uma oportunidade.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-5 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
              <p className="text-sm text-gray-700 mb-3">
                {content.reserva_copy
                  ?? 'Não encontrou uma vaga na sua área? Deixe seu currículo em nossa base reserva — entraremos em contato quando surgir uma oportunidade adequada.'}
              </p>
              <button
                onClick={handleReserva}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary/90"
              >
                Seguir para cadastro reserva <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {/* ─── Step 3 ─── */}
        {step === 3 && area && (
          <section>
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">
              Seus dados e currículo
            </h2>
            <p className="text-gray-600 mb-6">
              {isReserva
                ? `Cadastro reserva para a área ${areas[area].label}.`
                : `Candidatura para a vaga selecionada na área ${areas[area].label}.`}
            </p>

            <div className="space-y-4 bg-white p-6 rounded-xl border border-gray-200">
              <InputField
                label="Nome completo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                icon={User}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="E-mail"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  icon={Mail}
                  required
                />
                <InputField
                  label="Telefone / WhatsApp"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                  icon={Phone}
                  required
                />
              </div>

              {/* Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currículo (PDF, JPG ou PNG · máx {maxUploadMb}MB) <span className="text-red-500">*</span>
                </label>
                <label className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-primary cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <div className="flex-1 text-sm">
                    {file ? (
                      <span className="text-gray-900">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>
                    ) : (
                      <span className="text-gray-500">Clique para anexar o arquivo</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {/* LGPD específico do RH + Termos/Privacidade */}
              <div className="pt-2 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lgpdOk}
                    onChange={(e) => setLgpdOk(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-sm text-gray-600 leading-relaxed">
                    {content.lgpd_consent_text
                      ?? 'Autorizo o tratamento dos meus dados pessoais (incluindo CPF, RG e demais informações do currículo) para fins de processo seletivo e cadastro em base reserva, conforme a LGPD.'}
                  </span>
                </label>
                <LegalConsent checked={termsOk} onChange={setTermsOk} />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                onClick={handleSubmitIntake}
                disabled={!canSubmit || submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Enviando…
                  </>
                ) : (
                  <>
                    Enviar e iniciar entrevista <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* ─── Step 4 — Chat ─── */}
        {step === 4 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MessagesSquare className="w-5 h-5 text-brand-primary" />
              <h2 className="text-2xl font-semibold text-gray-900">Conversa de pré-candidatura</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Uma conversa curta para conhecermos melhor seu perfil. Leva uns minutos.
            </p>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="h-96 overflow-y-auto p-5 space-y-3">
                {messages.length === 0 && sendingTurn && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analisando seu currículo…
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                        m.role === 'user'
                          ? 'bg-brand-primary text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {sendingTurn && messages.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-500 inline-flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Digitando…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {chatError && (
                <div className="px-5 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {chatError}
                </div>
              )}

              <div className="p-3 border-t border-gray-200 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                  disabled={sendingTurn || finalized}
                  placeholder={finalized ? 'Entrevista finalizada.' : 'Escreva sua resposta…'}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none disabled:bg-gray-50"
                />
                <button
                  onClick={handleSendChat}
                  disabled={sendingTurn || finalized || !chatInput.trim()}
                  className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ─── Step 5 — Obrigado ─── */}
        {step === 5 && (
          <section className="text-center py-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
              {content.thank_you_title ?? 'Obrigado pela sua inscrição!'}
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto">
              {content.thank_you_message
                ?? 'Recebemos seus dados e suas respostas. Nossa equipe de RH vai analisar seu perfil e entraremos em contato em breve.'}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500">
              <FileText className="w-4 h-4" />
              Você pode fechar esta página.
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
