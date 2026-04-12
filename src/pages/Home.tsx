import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Heart,
  Lightbulb,
  Trophy,
  Building,
  Palette,
  HeartHandshake,
  ChevronRight,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useSettings } from '../hooks/useSettings';
import { useSEO } from '../hooks/useSEO';
import { getLucideIcon } from '../lib/lucide';
import Testimonials from '../components/Testimonials';
import HeroSlideshow from '../components/HeroSlideshow';
import type { HeroScene, HeroSlideshowConfig } from '../components/HeroSlideshow';

/* ── Icon map for default features/infrastructure ── */
const ICON_MAP: Record<string, LucideIcon> = {
  GraduationCap, Heart, Lightbulb, Trophy, Building, Palette, HeartHandshake,
};

interface SegmentData {
  to: string;
  image: string;
  title: string;
  description: string;
  ages: string;
}

interface FeatureData {
  icon: string;
  title: string;
  desc: string;
  stat: string;
  statLabel: string;
}

interface InfraData {
  icon: string;
  title: string;
  items: string[];
}

interface StatData {
  value: string;
  label: string;
}

const DEFAULT_FEATURES: FeatureData[] = [
  {
    icon: 'GraduationCap',
    title: 'Excelência Acadêmica',
    desc: 'Educação de qualidade com resultados comprovados',
    stat: '',
    statLabel: '',
  },
  {
    icon: 'Heart',
    title: 'Formação em Valores',
    desc: 'Formação integral baseada em princípios éticos e morais',
    stat: '',
    statLabel: '',
  },
  {
    icon: 'Lightbulb',
    title: 'Metodologia Inovadora',
    desc: 'Aprendizagem ativa com tecnologia integrada ao ensino',
    stat: '',
    statLabel: '',
  },
  {
    icon: 'Trophy',
    title: 'Tradição e Qualidade',
    desc: 'Anos de história e compromisso com a educação',
    stat: '',
    statLabel: '',
  },
];

const DEFAULT_INFRASTRUCTURE: InfraData[] = [
  {
    icon: 'Building',
    title: 'Infraestrutura Completa',
    items: ['Salas climatizadas', 'Quadra poliesportiva', 'Biblioteca moderna'],
  },
  {
    icon: 'Palette',
    title: 'Atividades Extras',
    items: ['Robótica educacional', 'Práticas esportivas', 'Clube de ciências'],
  },
  {
    icon: 'HeartHandshake',
    title: 'Acompanhamento Individual',
    items: ['Orientação pedagógica', 'Suporte psicológico', 'Reforço escolar'],
  },
];

const DEFAULT_STATS: StatData[] = [];

function resolveIcon(name: string): LucideIcon {
  return getLucideIcon(name) ?? ICON_MAP[name] ?? GraduationCap;
}

export default function Home() {
  useSEO('home');
  const revealRef = useScrollReveal();

  const { settings: appearanceSettings } = useSettings('appearance');
  const { settings: contentSettings } = useSettings('content');
  const homeConfig = (appearanceSettings.home as Record<string, unknown> | undefined) ?? {};

  const features = (contentSettings.home_features as FeatureData[] | undefined) ?? DEFAULT_FEATURES;
  const infrastructure = (contentSettings.home_infrastructure as InfraData[] | undefined) ?? DEFAULT_INFRASTRUCTURE;
  const heroStats = (contentSettings.home_stats as StatData[] | undefined) ?? DEFAULT_STATS;
  const heroBadge    = (homeConfig.badge as string)     || 'Matrículas 2026 abertas';
  const heroTitle    = (homeConfig.title as string)     || 'Educação que Transforma Vidas';
  const heroHL       = (homeConfig.highlight as string) || 'Transforma';
  const heroSubtitle = (homeConfig.subtitle as string)  || '';
  const heroVideoUrl = (homeConfig.video_url as string) || '';
  const heroScenes   = (homeConfig.scenes as HeroScene[] | undefined) ?? [];
  const heroSlideshow = (homeConfig.slideshow as HeroSlideshowConfig | undefined) ?? { default_duration: 8, order: 'sequential' as const, transition: 'crossfade' as const, transition_duration: 1200 };
  const segments = (contentSettings.home_segments as SegmentData[] | undefined) ?? [];

  return (
    <div className="min-h-screen" ref={revealRef}>
      {/* ── Hero ── */}
      <section className="relative h-screen min-h-[600px] overflow-hidden">
        {/* Slideshow / Video Background */}
        <HeroSlideshow scenes={heroScenes} config={heroSlideshow} fallbackVideoUrl={heroVideoUrl} />

        {/* Decorative diagonal slice */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        {/* Content */}
        <div className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            {/* Badge */}
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

            {/* Gold accent line */}
            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-brand-secondary to-brand-secondary-light rounded-full mb-8" />

            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed mb-10">
              {heroSubtitle}
            </p>

            <div className="hero-text-3 flex flex-wrap gap-4">
              <Link
                to="/sobre"
                className="group inline-flex items-center gap-3 bg-brand-secondary text-brand-primary px-8 py-4 rounded-full font-semibold transition-all duration-500 hover:bg-white hover:shadow-[0_0_40px_rgba(255,215,0,0.4)] active:scale-95"
              >
                Conheça Nossa Escola
                <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/agendar-visita"
                className="group inline-flex items-center gap-3 border-2 border-white/60 text-white px-8 py-4 rounded-full font-semibold transition-all duration-500 hover:bg-white hover:text-brand-primary hover:border-white hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-95"
              >
                Agende uma Visita
              </Link>
            </div>

            {/* Stats row */}
            <div className="hero-text-4 flex flex-wrap gap-8 mt-14 pt-8 border-t border-white/15">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <p className="text-3xl md:text-4xl font-display font-bold text-brand-secondary">
                    {s.value}
                  </p>
                  <p className="text-sm text-white/60 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Segments ── */}
      {segments.length > 0 && (
        <section className="relative py-24 bg-[var(--surface)] grain-overlay">
          <div className="relative z-[2] container mx-auto px-4">
            <div className="text-center mb-16" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                Nossos Segmentos
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
                Uma jornada completa
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {segments.map((seg, i) => (
                <Link
                  key={seg.to}
                  to={seg.to}
                  className="card-3d group"
                  data-reveal="up"
                  style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
                >
                  <div className="card-3d-inner bg-white rounded-2xl overflow-hidden">
                    <div className="img-zoom relative h-52">
                      {seg.image && (
                        <img
                          src={seg.image}
                          alt={seg.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {/* Gold overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      {/* Age badge */}
                      {seg.ages && (
                        <span className="absolute top-4 right-4 bg-brand-secondary text-brand-primary text-xs font-bold px-3 py-1 rounded-full shadow-md">
                          {seg.ages}
                        </span>
                      )}
                    </div>
                    <div className="p-6 gold-line-hover">
                      <h3 className="text-lg font-bold text-brand-primary mb-1 group-hover:text-brand-primary-dark transition-colors">
                        {seg.title}
                      </h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        {seg.description}
                      </p>
                      <span className="inline-flex items-center gap-1 text-brand-secondary text-sm font-semibold mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-8px] group-hover:translate-x-0">
                        Saiba mais <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Features / Por que escolher ── */}
      <section className="py-24 bg-white relative overflow-hidden">
        {/* Decorative background circle */}
        <div className="absolute -right-40 -top-40 w-[500px] h-[500px] rounded-full bg-brand-primary/[0.02]" />

        <div className="relative container mx-auto px-4">
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
              Diferenciais
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
              Por que nos escolher<span className="italic">?</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {features.map((feat, i) => {
              const Icon = resolveIcon(feat.icon);
              return (
                <div
                  key={feat.title}
                  className="group relative bg-[var(--surface)] rounded-2xl p-8 transition-all duration-500 hover:bg-brand-primary hover:shadow-[0_20px_60px_-15px_rgba(0,56,118,0.3)]"
                  data-reveal="up"
                  style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
                >
                  {/* Stat */}
                  <p className="font-display text-5xl font-bold text-brand-primary/10 group-hover:text-white/15 transition-colors duration-500 absolute top-4 right-6">
                    {feat.stat}
                  </p>

                  {/* Icon */}
                  <div className="w-14 h-14 bg-brand-primary group-hover:bg-brand-secondary rounded-xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                    <Icon className="w-7 h-7 text-white group-hover:text-brand-primary transition-colors duration-500" />
                  </div>

                  <h3 className="text-lg font-bold text-brand-primary group-hover:text-white mb-3 transition-colors duration-500">
                    {feat.title}
                  </h3>
                  <p className="text-gray-500 group-hover:text-white/70 text-sm leading-relaxed mb-4 transition-colors duration-500">
                    {feat.desc}
                  </p>
                  <p className="text-xs font-semibold text-brand-secondary tracking-wide uppercase">
                    {feat.statLabel}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ── Infrastructure Grid ── */}
          <div className="grid md:grid-cols-3 gap-8">
            {infrastructure.map((box, i) => {
              const Icon = resolveIcon(box.icon);
              return (
                <div
                  key={box.title}
                  className="group relative bg-[var(--surface)] rounded-2xl p-8 border border-transparent hover:border-brand-secondary/30 transition-all duration-500 hover:shadow-lg"
                  data-reveal="up"
                  style={{ '--delay': `${i * 0.12}s` } as React.CSSProperties}
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center group-hover:rotate-3 transition-transform duration-500">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-brand-primary">
                      {box.title}
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {box.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-3 text-gray-600 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-brand-secondary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <Testimonials />

      {/* ── CTA Band ── */}
      <section className="relative py-20 bg-brand-primary overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-brand-secondary" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-white" />
        </div>

        <div className="relative container mx-auto px-4 text-center" data-reveal="scale">
          <p className="text-brand-secondary text-sm font-semibold tracking-[0.2em] uppercase mb-4">
            {(contentSettings.cta_band_badge as string) || 'Matrícula'}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            {(contentSettings.cta_band_title as string) || 'Comece a transformação'} <span className="italic">agora</span>
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
            {(contentSettings.cta_band_subtitle as string) || 'Garanta a vaga do seu filho. Venha conhecer nossa estrutura e metodologia.'}
          </p>
          <Link
            to="/matricula"
            className="group inline-flex items-center gap-3 bg-brand-secondary text-brand-primary px-10 py-5 rounded-full font-bold text-lg transition-all duration-500 hover:bg-white hover:shadow-[0_0_60px_rgba(255,215,0,0.4)] active:scale-95"
          >
            Faça sua matrícula
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </div>
  );
}
