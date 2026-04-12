import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useSettings } from '../hooks/useSettings';
import { useSEO } from '../hooks/useSEO';
import { getLucideIcon } from '../lib/lucide';

/* ── Types ── */
interface TimelineItem { year: string; title: string; desc: string; }
interface MVVItem { icon: string; title: string; desc: string; }
interface NumeroItem { value: string; label: string; }
interface DiferencialItem { icon: string; title: string; desc: string; }
interface SobreContent {
  historia_title?: string; historia_text?: string; timeline?: TimelineItem[];
  mvv?: MVVItem[]; numeros_title?: string; numeros?: NumeroItem[];
  diferenciais_title?: string; diferenciais?: DiferencialItem[];
  cta_title?: string; cta_subtitle?: string;
}

function resolveIcon(name: string): LucideIcon {
  return getLucideIcon(name) ?? Heart;
}

export default function Sobre() {
  useSEO('sobre');
  const revealRef = useScrollReveal();

  const { settings: appearanceSettings } = useSettings('appearance');
  const { settings: contentSettings } = useSettings('content');

  const sobreContent = (contentSettings.page_sobre as SobreContent | undefined) ?? {};
  const timeline       = sobreContent.timeline       ?? [];
  const mvv            = sobreContent.mvv            ?? [];
  const numeros        = sobreContent.numeros        ?? [];
  const diferenciais   = sobreContent.diferenciais   ?? [];
  const historiaTitle  = sobreContent.historia_title  ?? 'Nossa História';
  const historiaText   = sobreContent.historia_text   ?? '';
  const numerosTitle   = sobreContent.numeros_title   ?? 'Nossos Números';
  const difTitle       = sobreContent.diferenciais_title ?? 'Nossos Diferenciais';
  const ctaTitle       = sobreContent.cta_title       ?? 'Venha Conhecer Nossa Escola';
  const ctaSubtitle    = sobreContent.cta_subtitle    ?? 'Agende uma visita e conheça de perto nossa proposta pedagógica e estrutura completa.';

  const hero = (appearanceSettings.sobre as Record<string, string> | undefined) ?? {};
  const heroBadge    = hero.badge     || 'Conheça nossa história';
  const heroTitle    = hero.title     || 'Sobre Nós';
  const heroHL       = hero.highlight || 'Nós';
  const heroSubtitle = hero.subtitle  || '';
  const heroImage    = hero.image     || '';

  return (
    <div className="min-h-screen" ref={revealRef}>

      {/* ── Hero ── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          {heroImage && (
            <img src={heroImage} alt="Sobre a escola" className="w-full h-full object-cover" />
          )}
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

      {/* ── História ── */}
      {(timeline.length > 0 || historiaText) && (
        <section className="py-24 bg-[var(--surface)] grain-overlay relative overflow-hidden">
          <div className="absolute -right-40 -top-40 w-[500px] h-[500px] rounded-full bg-brand-primary/[0.02]" />
          <div className="relative container mx-auto px-4">
            <div className="text-center mb-16" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                Tradição e Excelência
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
                {(() => {
                  const words = historiaTitle.split(' ');
                  if (words.length <= 1) return <span className="italic">{historiaTitle}</span>;
                  const last = words.pop()!;
                  return <>{words.join(' ')} <span className="italic">{last}</span></>;
                })()}
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            {historiaText && (
              <p
                className="max-w-3xl mx-auto text-gray-600 text-base leading-relaxed text-center mb-16"
                data-reveal="up"
              >
                {historiaText}
              </p>
            )}

            {timeline.length > 0 && (
              <div className="relative max-w-4xl mx-auto">
                {/* Central line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-brand-primary/15 -translate-x-1/2 hidden md:block" />

                <div className="space-y-12 md:space-y-0">
                  {timeline.map((item, i) => {
                    const isLeft = i % 2 === 0;
                    return (
                      <div
                        key={i}
                        className="relative md:flex items-start md:mb-16 last:mb-0"
                        data-reveal="up"
                        style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
                      >
                        {/* Year marker (center on desktop) */}
                        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-10 w-14 h-14 bg-brand-secondary rounded-full items-center justify-center shadow-lg shadow-brand-secondary/25">
                          <span className="text-brand-primary font-bold text-xs">{item.year}</span>
                        </div>

                        {/* Content card */}
                        <div className={`md:w-[calc(50%-2.5rem)] ${isLeft ? 'md:mr-auto md:pr-8 md:text-right' : 'md:ml-auto md:pl-8'}`}>
                          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                            <span className="inline-block md:hidden text-xs font-bold text-white bg-brand-secondary rounded-full px-3 py-1 mb-3">
                              {item.year}
                            </span>
                            <h3 className="font-display text-lg font-bold text-brand-primary mb-2">{item.title}</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Missão, Visão e Valores ── */}
      {mvv.length > 0 && (
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                Nossos Princípios
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
                Missão, Visão e <span className="italic">Valores</span>
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            <div className={`grid gap-8 max-w-5xl mx-auto ${mvv.length >= 3 ? 'md:grid-cols-3' : mvv.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'max-w-lg'}`}>
              {mvv.map((item, i) => {
                const Icon = resolveIcon(item.icon);
                return (
                  <div
                    key={i}
                    className="group relative bg-white rounded-2xl p-8 border border-gray-100 transition-all duration-500 hover:bg-brand-primary hover:shadow-[0_20px_60px_-15px_rgba(0,56,118,0.3)]"
                    data-reveal="up"
                    style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
                  >
                    <div className="w-14 h-14 bg-brand-primary group-hover:bg-brand-secondary rounded-xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                      <Icon className="w-7 h-7 text-white group-hover:text-brand-primary transition-colors duration-500" />
                    </div>
                    <h3 className="text-xl font-bold text-brand-primary group-hover:text-white mb-3 transition-colors duration-500">
                      {item.title}
                    </h3>
                    <p className="text-gray-500 group-hover:text-white/70 text-sm leading-relaxed transition-colors duration-500">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Números ── */}
      {numeros.length > 0 && (
        <section className="relative py-24 bg-brand-primary grain-overlay overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]">
            <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-brand-secondary" />
            <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-white" />
          </div>
          <div className="relative z-10 container mx-auto px-4">
            <div className="text-center mb-16" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                {(() => {
                  const words = numerosTitle.split(' ');
                  return words.length > 1 ? words.slice(0, -1).join(' ') : numerosTitle;
                })()}
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
                {(() => {
                  const words = numerosTitle.split(' ');
                  if (words.length <= 1) return <span className="italic">{numerosTitle}</span>;
                  const last = words.pop()!;
                  return <>{words.join(' ')} <span className="italic">{last}</span></>;
                })()}
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            <div className={`grid sm:grid-cols-2 ${numeros.length >= 4 ? 'lg:grid-cols-4' : `lg:grid-cols-${numeros.length}`} gap-8`}>
              {numeros.map(({ value, label }, i) => (
                <div
                  key={i}
                  className="text-center"
                  data-reveal="scale"
                  style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
                >
                  <p className="font-display text-6xl font-bold mb-2 text-brand-secondary">{value}</p>
                  <p className="text-white/60 text-sm tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Diferenciais ── */}
      {diferenciais.length > 0 && (
        <section className="py-24 bg-[var(--surface)]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                Excelência
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
                {(() => {
                  const words = difTitle.split(' ');
                  if (words.length <= 1) return <span className="italic">{difTitle}</span>;
                  const last = words.pop()!;
                  return <>{words.join(' ')} <span className="italic">{last}</span></>;
                })()}
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            <div className={`grid md:grid-cols-2 ${diferenciais.length >= 4 ? 'lg:grid-cols-4' : ''} gap-6`}>
              {diferenciais.map((item, i) => {
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
    </div>
  );
}
