import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Expand } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useSettings } from '../hooks/useSettings';
import { useSEO } from '../hooks/useSEO';
import { getLucideIcon } from '../lib/lucide';
import Lightbox from '../components/Lightbox';
import HeroMedia from '../components/HeroMedia';

/* ── Types ── */
interface EstruturaCategoryItem { image: string; title: string; desc: string; }
interface EstruturaCategory { name: string; icon: string; items: EstruturaCategoryItem[]; }
interface EstruturaHighlight { icon: string; title: string; desc: string; }
interface EstruturaContent {
  categories?: EstruturaCategory[]; destaques_title?: string; destaques?: EstruturaHighlight[];
  cta_title?: string; cta_subtitle?: string;
}

function resolveIcon(name: string): LucideIcon {
  return getLucideIcon(name) ?? Heart;
}

export default function Estrutura() {
  useSEO('estrutura');
  const revealRef = useScrollReveal();

  const { settings: appearanceSettings } = useSettings('appearance');
  const { settings: contentSettings } = useSettings('content');

  const estruturaContent = (contentSettings.page_estrutura as EstruturaContent | undefined) ?? {};
  const categories    = estruturaContent.categories    ?? [];
  const destaques     = estruturaContent.destaques     ?? [];
  const destaquesTitle = estruturaContent.destaques_title ?? 'Destaques da Estrutura';
  const ctaTitle      = estruturaContent.cta_title      ?? 'Venha Conhecer Nossa Estrutura';
  const ctaSubtitle   = estruturaContent.cta_subtitle   ?? 'Agende uma visita e conheça de perto nossos espaços, laboratórios e áreas esportivas.';

  const hero = (appearanceSettings.estrutura as Record<string, string> | undefined) ?? {};
  const heroBadge    = hero.badge     || 'Conheça nossos espaços';
  const heroTitle    = hero.title     || 'Nossa Estrutura';
  const heroHL       = hero.highlight || 'Estrutura';
  const heroSubtitle = hero.subtitle  || 'Ambientes modernos e acolhedores projetados para o melhor aprendizado.';
  const heroImage    = hero.image     || '';

  // ── Filter state ──
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredCategories = useMemo(
    () => activeFilter ? categories.filter((c) => c.name === activeFilter) : categories,
    [categories, activeFilter],
  );

  const allImages = useMemo(
    () => filteredCategories.flatMap((c) => c.items.map((item) => ({ src: item.image, alt: item.title }))),
    [filteredCategories],
  );

  // ── Lightbox state ──
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  function openLightbox(globalIndex: number) {
    setLightboxIndex(globalIndex);
    setLightboxOpen(true);
  }

  return (
    <div className="min-h-screen" ref={revealRef}>

      {/* ── Hero ── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          <HeroMedia url={heroImage} alt="Estrutura da escola" />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/95 via-brand-primary/80 to-brand-primary-dark/70" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        <div className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            <div className="hero-badge inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-brand-secondary rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-medium tracking-wide">{heroBadge}</span>
            </div>

            <h1 className="hero-text-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              {(() => {
                if (!heroHL || !heroTitle.includes(heroHL)) return heroTitle;
                const parts = heroTitle.split(heroHL);
                return <>{parts[0]}<span className="italic text-brand-secondary">{heroHL}</span>{parts[1]}</>;
              })()}
            </h1>

            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-brand-secondary to-brand-secondary-light rounded-full mb-8" />

            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed mb-10">
              {heroSubtitle}
            </p>

            <div className="hero-text-3 flex flex-wrap gap-4">
              <Link
                to="/agendar-visita"
                className="group inline-flex items-center gap-3 bg-brand-secondary text-brand-primary px-8 py-4 rounded-full font-semibold transition-all duration-500 hover:bg-white hover:shadow-[0_0_40px_rgba(255,215,0,0.4)] active:scale-95"
              >
                Agende uma Visita
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/matricula"
                className="group inline-flex items-center gap-3 border-2 border-white/60 text-white px-8 py-4 rounded-full font-semibold transition-all duration-500 hover:bg-white hover:text-brand-primary hover:border-white hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-95"
              >
                Fazer Matrícula
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Gallery with category filters ── */}
      {categories.length > 0 && (
        <section className="py-24 bg-[var(--surface)] grain-overlay relative overflow-hidden">
          <div className="absolute -right-40 -top-40 w-[500px] h-[500px] rounded-full bg-brand-primary/[0.02]" />
          <div className="relative container mx-auto px-4">
            <div className="text-center mb-12" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                Tour Virtual
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
                Nossos <span className="italic">Espaços</span>
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap justify-center gap-2 mb-12" data-reveal="up" style={{ '--delay': '0.1s' } as React.CSSProperties}>
              <button
                onClick={() => setActiveFilter(null)}
                className={[
                  'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-300',
                  activeFilter === null
                    ? 'bg-brand-secondary text-brand-primary shadow-md shadow-brand-secondary/20'
                    : 'bg-white text-brand-primary border border-gray-200 hover:border-brand-secondary/40 hover:shadow-sm',
                ].join(' ')}
              >
                Todos
              </button>
              {categories.map((cat) => {
                const CatIcon = resolveIcon(cat.icon);
                return (
                  <button
                    key={cat.name}
                    onClick={() => setActiveFilter(cat.name === activeFilter ? null : cat.name)}
                    className={[
                      'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-300',
                      activeFilter === cat.name
                        ? 'bg-brand-secondary text-brand-primary shadow-md shadow-brand-secondary/20'
                        : 'bg-white text-brand-primary border border-gray-200 hover:border-brand-secondary/40 hover:shadow-sm',
                    ].join(' ')}
                  >
                    <CatIcon className="w-4 h-4" />
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Image grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(() => {
                let globalIndex = 0;
                return filteredCategories.flatMap((cat) =>
                  cat.items.map((item, itemIdx) => {
                    const idx = globalIndex++;
                    const CatIcon = resolveIcon(cat.icon);
                    return (
                      <div
                        key={`${cat.name}-${itemIdx}`}
                        className="group img-zoom rounded-2xl overflow-hidden relative h-80 cursor-pointer"
                        data-reveal="up"
                        style={{ '--delay': `${(idx % 6) * 0.08}s` } as React.CSSProperties}
                        onClick={() => openLightbox(idx)}
                      >
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/90 via-brand-primary/30 to-transparent" />

                        {/* Category badge */}
                        <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
                          <CatIcon className="w-3 h-3 text-brand-secondary" />
                          <span className="text-white/90 text-[11px] font-medium">{cat.name}</span>
                        </div>

                        {/* Expand icon on hover */}
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-full p-2">
                            <Expand className="w-4 h-4 text-white" />
                          </div>
                        </div>

                        {/* Title + desc */}
                        <div className="absolute bottom-0 p-6 text-white">
                          <h3 className="font-display text-xl font-bold mb-1">{item.title}</h3>
                          {item.desc && <p className="text-sm text-white/85 leading-relaxed">{item.desc}</p>}
                        </div>
                      </div>
                    );
                  }),
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* ── Destaques ── */}
      {destaques.length > 0 && (
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                Infraestrutura
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
                {(() => {
                  const words = destaquesTitle.split(' ');
                  if (words.length <= 1) return <span className="italic">{destaquesTitle}</span>;
                  const last = words.pop()!;
                  return <>{words.join(' ')} <span className="italic">{last}</span></>;
                })()}
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            <div className={`grid md:grid-cols-2 ${destaques.length >= 4 ? 'lg:grid-cols-4' : destaques.length === 3 ? 'lg:grid-cols-3' : ''} gap-6`}>
              {destaques.map((item, i) => {
                const Icon = resolveIcon(item.icon);
                return (
                  <div
                    key={i}
                    className="group bg-white rounded-2xl p-7 border border-gray-100 hover:border-brand-secondary/40 hover:shadow-lg transition-all duration-300 gold-line-hover"
                    data-reveal="up"
                    style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
                  >
                    <div className="w-12 h-12 bg-brand-primary/10 group-hover:bg-brand-primary rounded-xl flex items-center justify-center mb-5 transition-colors duration-300">
                      <Icon className="w-6 h-6 text-brand-primary group-hover:text-white transition-colors duration-300" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-brand-primary mb-2">{item.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="relative py-20 bg-brand-primary overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-brand-secondary" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-white" />
        </div>
        <div className="relative container mx-auto px-4 text-center" data-reveal="scale">
          <p className="text-brand-secondary text-sm font-semibold tracking-[0.2em] uppercase mb-4">
            Próximo passo
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            {(() => {
              const words = ctaTitle.split(' ');
              if (words.length <= 1) return <span className="italic">{ctaTitle}</span>;
              const last = words.pop()!;
              return <>{words.join(' ')} <span className="italic">{last}</span></>;
            })()}
          </h2>
          {ctaSubtitle && (
            <p className="text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
              {ctaSubtitle}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/agendar-visita"
              className="group inline-flex items-center gap-3 bg-brand-secondary text-brand-primary px-10 py-5 rounded-full font-bold text-lg transition-all duration-500 hover:bg-white hover:shadow-[0_0_60px_rgba(255,215,0,0.4)] active:scale-95"
            >
              Agende uma Visita
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/matricula"
              className="inline-flex items-center gap-3 border-2 border-white/60 text-white px-10 py-5 rounded-full font-bold text-lg transition-all duration-500 hover:bg-white hover:text-brand-primary active:scale-95"
            >
              Fazer Matrícula
            </Link>
          </div>
        </div>
      </section>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <Lightbox
          images={allImages}
          index={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
