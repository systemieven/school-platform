/**
 * Testimonials — Depoimentos de pais / responsáveis
 *
 * Fluxo completo:
 *  1. Busca depoimentos aprovados no Supabase (status = 'approved') em tempo real
 *  2. Enquanto não há registros reais, exibe depoimentos hardcoded de fallback
 *  3. Se houver mais de 3 aprovados, rotaciona automaticamente a cada 5 s
 *  4. Pai faz login via Google ou Facebook (OAuth via Supabase)
 *     → nome e avatar são preenchidos automaticamente da conta social
 *  5. Formulário pede: nome (editável), e-mail, série do aluno, comentário e avaliação
 *  6. Todos os envios ficam com status = 'pending' até aprovação manual no backend
 *
 * Pré-requisito no Supabase Dashboard:
 *  Authentication › Providers → ativar Google e Facebook com credenciais OAuth
 *  Authentication › URL Configuration → adicionar domínio do site em "Redirect URLs"
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Star,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle,
  Quote,
  Info,
  LogIn,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useScrollReveal } from '../hooks/useScrollReveal';
import type { User } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Testimonial = {
  id: string;
  parent_name: string;
  avatar_url: string | null;
  content: string;
  rating: number;
  student_grade: string | null;
  created_at: string;
};

// ─── Séries disponíveis ───────────────────────────────────────────────────────

const GRADES = [
  'Educação Infantil – Maternal I',
  'Educação Infantil – Maternal II',
  'Educação Infantil – Pré I',
  'Educação Infantil – Pré II',
  'Fundamental I – 1º ano',
  'Fundamental I – 2º ano',
  'Fundamental I – 3º ano',
  'Fundamental I – 4º ano',
  'Fundamental I – 5º ano',
  'Fundamental II – 6º ano',
  'Fundamental II – 7º ano',
  'Fundamental II – 8º ano',
  'Fundamental II – 9º ano',
  'Ensino Médio – 1º ano',
  'Ensino Médio – 2º ano',
  'Ensino Médio – 3º ano',
];

// ─── Fallback hardcoded ───────────────────────────────────────────────────────

const FALLBACK: Testimonial[] = [
  {
    id: 'f1',
    parent_name: 'Maria Fernanda Oliveira',
    avatar_url: null,
    student_grade: 'Fundamental I – 3º ano',
    content:
      'Meu filho está no Batista desde o 1º ano e a evolução dele é visível a cada semestre. Os professores são dedicados, o ambiente é acolhedor e os valores transmitidos fazem diferença na vida dele.',
    rating: 5,
    created_at: '',
  },
  {
    id: 'f2',
    parent_name: 'Carlos Eduardo Silva',
    avatar_url: null,
    student_grade: 'Ensino Médio – 3º ano',
    content:
      'Minha filha entrou no ensino médio e já foi aprovada em duas universidades federais. O preparo acadêmico do Batista é realmente de excelência. Muito orgulhoso da escolha que fizemos.',
    rating: 5,
    created_at: '',
  },
  {
    id: 'f3',
    parent_name: 'Ana Paula Santos',
    avatar_url: null,
    student_grade: 'Fundamental II – 7º ano',
    content:
      'A equipe pedagógica é incrível. Sempre que preciso conversar sobre o desempenho do meu filho, sou recebida com atenção e cuidado genuíno. Escola de verdade!',
    rating: 5,
    created_at: '',
  },
];

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating ? 'fill-[#ffd700] text-[#ffd700]' : 'text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="w-12 h-12 rounded-full object-cover ring-2 ring-[#ffd700]/40 shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-[#003876] flex items-center justify-center ring-2 ring-[#ffd700]/40 shrink-0">
      <span className="text-white font-bold text-sm">{initials}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/60 text-xs font-semibold uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#ffd700]/60 focus:bg-white/15 transition-all duration-200';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Testimonials() {
  const sectionRef = useScrollReveal();
  const formRef    = useScrollReveal();

  // Carousel
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [activeIndex, setActiveIndex]   = useState(0);
  const [isPaused, setIsPaused]         = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Auth
  const [user, setUser] = useState<User | null>(null);

  // Form (pré-preenchido com dados do social após login)
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [content, setContent]         = useState('');
  const [rating, setRating]           = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [formError, setFormError]     = useState('');

  const displayed    = testimonials.length > 0 ? testimonials : FALLBACK;
  const total        = displayed.length;
  const visibleCount = Math.min(3, total);

  // ── Busca + realtime ────────────────────────────────────────────────────
  const fetchApproved = useCallback(async () => {
    const { data } = await supabase
      .from('testimonials')
      .select('id, parent_name, avatar_url, content, rating, student_grade, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) setTestimonials(data as Testimonial[]);
  }, []);

  useEffect(() => { fetchApproved(); }, [fetchApproved]);

  useEffect(() => {
    const channel = supabase
      .channel('testimonials-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'testimonials' },
        () => fetchApproved(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchApproved]);

  // ── Sessão do usuário ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) prefillFromUser(u);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) prefillFromUser(u);
      },
    );
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefillFromUser = (u: User) => {
    setName(
      u.user_metadata?.full_name ??
      u.user_metadata?.name ??
      '',
    );
    setEmail(u.email ?? u.user_metadata?.email ?? '');
  };

  // ── Auto-rotate ─────────────────────────────────────────────────────────
  const goNext = useCallback(() => setActiveIndex((i) => (i + 1) % total), [total]);
  const goPrev = useCallback(() => setActiveIndex((i) => (i - 1 + total) % total), [total]);

  useEffect(() => {
    if (total <= 3 || isPaused) return;
    timerRef.current = setInterval(goNext, 5000);
    return () => clearInterval(timerRef.current);
  }, [total, isPaused, goNext]);

  const visibleItems = Array.from(
    { length: visibleCount },
    (_, i) => displayed[(activeIndex + i) % total],
  );

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleLogin = async (provider: 'google' | 'facebook') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href },
    });
  };

  const isValid =
    name.trim().length >= 3 &&
    email.includes('@') &&
    studentGrade !== '' &&
    content.trim().length >= 20;

  const handleSubmit = async () => {
    if (!user || !isValid) return;
    setSubmitting(true);
    setFormError('');

    const avatarUrl =
      user.user_metadata?.avatar_url ??
      user.user_metadata?.picture ??
      null;

    const { error } = await supabase.from('testimonials').insert({
      parent_name:   name.trim(),
      email:         email.trim().toLowerCase(),
      avatar_url:    avatarUrl,
      student_grade: studentGrade,
      content:       content.trim(),
      rating,
      status:        'pending',
      provider:      user.app_metadata?.provider ?? 'unknown',
      social_id:     user.id,
    });

    setSubmitting(false);

    if (error) {
      setFormError('Não foi possível enviar. Por favor, tente novamente.');
    } else {
      setSubmitted(true);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <section className="py-24 bg-[#003876] relative overflow-hidden">
      {/* Decoração de fundo */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#ffd700]" />
        <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-white" />
      </div>

      <div ref={sectionRef} className="relative container mx-auto px-4">

        {/* ── Cabeçalho ── */}
        <div className="text-center mb-16" data-reveal="up">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
            O que dizem os pais
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
            Histórias que nos{' '}
            <span className="italic">Inspiram</span>
          </h2>
          <div className="h-[3px] w-16 bg-gradient-to-r from-[#ffd700] to-[#ffe44d] rounded-full mx-auto mt-6" />
        </div>

        {/* ── Carousel ── */}
        <div
          className="relative px-2"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="grid md:grid-cols-3 gap-6">
            {visibleItems.map((t, i) => (
              <div
                key={`${t.id}-${i}`}
                className={`bg-white rounded-2xl p-8 flex flex-col transition-all duration-500 ${
                  visibleCount === 3 && i === 1
                    ? 'md:scale-[1.04] md:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.35)]'
                    : 'md:opacity-90'
                }`}
              >
                <Quote className="w-8 h-8 text-[#003876]/10 mb-4 shrink-0" />
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-6 line-clamp-5">
                  {t.content}
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <Avatar name={t.parent_name} url={t.avatar_url} />
                  <div className="min-w-0">
                    <p className="font-bold text-[#003876] text-sm leading-snug truncate">
                      {t.parent_name}
                    </p>
                    {t.student_grade && (
                      <p className="text-[10px] text-gray-400 truncate mb-0.5">
                        {t.student_grade}
                      </p>
                    )}
                    <StarRow rating={t.rating} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Setas — só com mais de 3 depoimentos */}
          {total > 3 && (
            <>
              <button
                onClick={goPrev}
                aria-label="Depoimento anterior"
                className="absolute -left-5 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-[#ffd700] text-white hover:text-[#003876] rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                aria-label="Próximo depoimento"
                className="absolute -right-5 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-[#ffd700] text-white hover:text-[#003876] rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {total > 3 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                aria-label={`Ir para depoimento ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? 'w-6 h-2 bg-[#ffd700]'
                    : 'w-2 h-2 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Separador ── */}
        <div className="my-16 border-t border-white/10" />

        {/* ── Área de envio ── */}
        <div ref={formRef} className="max-w-2xl mx-auto" data-reveal="up">

          {submitted ? (
            /* ── Sucesso ── */
            <div className="text-center">
              <div className="w-20 h-20 bg-[#ffd700]/15 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-[#ffd700]" />
              </div>
              <h3 className="font-display text-2xl font-bold text-white mb-3">
                Depoimento enviado!
              </h3>
              <p className="text-white/60 text-sm leading-relaxed max-w-md mx-auto">
                Obrigado por compartilhar sua experiência,{' '}
                <strong className="text-white">{name.split(' ')[0]}</strong>.
                Nossa equipe vai revisar seu depoimento e ele será publicado em breve.
              </p>
            </div>

          ) : !user ? (
            /* ── Login social ── */
            <div className="text-center">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
                Compartilhe sua experiência
              </p>
              <h3 className="font-display text-3xl font-bold text-white mb-4">
                Seu relato <span className="italic">importa</span>
              </h3>
              <p className="text-white/60 mb-10 text-sm leading-relaxed max-w-md mx-auto">
                Faça login com sua conta social para deixar seu depoimento.
                Usamos apenas seu nome e foto para identificação.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => handleLogin('google')}
                  className="inline-flex items-center justify-center gap-3 bg-white text-gray-700 px-8 py-4 rounded-full font-semibold transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-[1.03] active:scale-95"
                >
                  <GoogleIcon />
                  Entrar com Google
                </button>
                <button
                  onClick={() => handleLogin('facebook')}
                  className="inline-flex items-center justify-center gap-3 bg-[#1877F2] text-white px-8 py-4 rounded-full font-semibold transition-all duration-300 hover:bg-[#166fe5] hover:shadow-[0_0_30px_rgba(24,119,242,0.35)] hover:scale-[1.03] active:scale-95"
                >
                  <FacebookIcon />
                  Entrar com Facebook
                </button>
              </div>
              <p className="text-white/30 text-xs mt-6 flex items-center justify-center gap-1.5">
                <LogIn className="w-3 h-3" />
                Seu e-mail não será exibido publicamente
              </p>
            </div>

          ) : (
            /* ── Formulário pós-login ── */
            <>
              <div className="text-center mb-10">
                <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
                  Compartilhe sua experiência
                </p>
                <h3 className="font-display text-3xl font-bold text-white mb-4">
                  Seu relato <span className="italic">importa</span>
                </h3>
              </div>

              {/* Aviso de revisão */}
              <div className="flex items-start gap-3 bg-white/[0.06] border border-white/10 rounded-xl px-5 py-4 mb-8">
                <Info className="w-4 h-4 text-[#ffd700] shrink-0 mt-0.5" />
                <p className="text-white/60 text-sm leading-relaxed">
                  Seu depoimento será revisado pela nossa equipe antes de ser publicado.
                  Seu e-mail não será exibido publicamente.
                </p>
              </div>

              <div className="bg-white/[0.06] backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-5">

                {/* Usuário logado */}
                <div className="flex items-center gap-3 pb-6 border-b border-white/10">
                  <Avatar
                    name={name || 'Você'}
                    url={
                      user.user_metadata?.avatar_url ??
                      user.user_metadata?.picture ??
                      null
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">
                      {name || user.email}
                    </p>
                    <p className="text-white/40 text-xs">
                      {user.app_metadata?.provider === 'google' ? 'Google' : 'Facebook'}
                    </p>
                  </div>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors whitespace-nowrap"
                  >
                    Trocar conta
                  </button>
                </div>

                {/* Nome + E-mail */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Seu nome *">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 80))}
                      placeholder="Como você quer ser identificado"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Seu e-mail *">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className={inputCls}
                    />
                  </Field>
                </div>

                {/* Série */}
                <Field label="Série do aluno matriculado *">
                  <select
                    value={studentGrade}
                    onChange={(e) => setStudentGrade(e.target.value)}
                    className={`${inputCls} appearance-none cursor-pointer`}
                  >
                    <option value="" disabled className="bg-[#003876]">
                      Selecione a série…
                    </option>
                    {GRADES.map((g) => (
                      <option key={g} value={g} className="bg-[#003876]">
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Avaliação em estrelas */}
                <Field label="Sua avaliação *">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseEnter={() => setHoverRating(i + 1)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(i + 1)}
                        aria-label={`${i + 1} estrela${i > 0 ? 's' : ''}`}
                        className="transition-transform hover:scale-125 focus:outline-none"
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            i < (hoverRating || rating)
                              ? 'fill-[#ffd700] text-[#ffd700]'
                              : 'text-white/20'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Comentário */}
                <Field label="Seu depoimento *">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value.slice(0, 500))}
                    placeholder="Conte sua experiência com o Colégio Batista… (mínimo 20 caracteres)"
                    rows={4}
                    className={`${inputCls} resize-none`}
                  />
                  <p className="text-right text-xs text-white/30 -mt-1">
                    {content.length}/500
                  </p>
                </Field>

                {formError && (
                  <p className="text-red-400 text-sm">{formError}</p>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !isValid}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#ffd700] text-[#003876] px-8 py-4 rounded-full font-bold transition-all duration-300 hover:bg-white hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#ffd700] disabled:hover:shadow-none"
                >
                  {submitting ? (
                    'Enviando…'
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar depoimento
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
