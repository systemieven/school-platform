import { Link } from 'react-router-dom';
import { Heart, Brain, Users, Plane as Plant, Music, Book, Palette, Puzzle, Clock, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useSettings } from '../hooks/useSettings';
import { useSEO } from '../hooks/useSEO';
import { getLucideIcon } from '../lib/lucide';

/* ── Types ── */
interface PillarData { icon: string; title: string; desc: string; stat: string; statLabel: string; }
interface ActivityData { icon: string; title: string; desc: string; }
interface CampoData { img: string; title: string; desc: string; }
interface ResultadoData { value: string; label: string; }
interface HorarioTime { label: string; time: string; }
interface HorarioTurno { title: string; times: HorarioTime[]; }
interface SegmentContent { pillars?: PillarData[]; activities?: ActivityData[]; campos?: CampoData[]; campos_title?: string; resultados?: ResultadoData[]; resultados_title?: string; horarios?: HorarioTurno[]; horarios_title?: string; }

const ICON_MAP: Record<string, LucideIcon> = { Heart, Brain, Users, Plane: Plant, Music, Book, Palette, Puzzle };

function resolveIcon(name: string): LucideIcon {
  return getLucideIcon(name) ?? ICON_MAP[name] ?? Heart;
}

export default function EducacaoInfantil() {
  useSEO('educacao_infantil');
  const revealRef = useScrollReveal();

  const { settings: appearanceSettings } = useSettings('appearance');
  const { settings: contentSettings } = useSettings('content');
  const segContent = (contentSettings.segment_educacao_infantil as SegmentContent | undefined) ?? {};
  const pillars         = segContent.pillars       ?? [];
  const atividades      = segContent.activities    ?? [];
  const campos          = segContent.campos        ?? [];
  const camposTitle     = segContent.campos_title  ?? '';
  const resultados      = segContent.resultados    ?? [];
  const resultadosTitle = segContent.resultados_title ?? '';
  const horariosList    = segContent.horarios      ?? [];
  const horariosTitle   = segContent.horarios_title ?? '';
  const hero = (appearanceSettings.educacao_infantil as Record<string, string> | undefined) ?? {};
  const heroBadge    = hero.badge     || 'Educação Infantil · 2 a 5 anos';
  const heroTitle    = hero.title     || 'Educação que Encanta e Transforma';
  const heroHL       = hero.highlight || 'Encanta';
  const heroSubtitle = hero.subtitle  || 'Um ambiente acolhedor e estimulante para o desenvolvimento integral do seu filho. Aqui, cada criança é única e especial.';
  const heroImage    = hero.image     || '';

  return (
    <div className="min-h-screen" ref={revealRef}>

      {/* ── Hero ── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          {heroImage && (
            <img
              src={heroImage}
              alt="Crianças brincando e aprendendo"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/95 via-brand-primary/80 to-brand-primary-dark/70" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        <div className="relative z-[5] container mx-auto px-4 h-full flex items-center">
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

            <div className="hero-text-4 flex flex-wrap gap-8 mt-14 pt-8 border-t border-white/15">
              {[
                { value: '20+',  label: 'Anos de experiência' },
                { value: '~20',  label: 'Alunos por turma' },
                { value: '100%', label: 'Prof. qualificados' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-3xl md:text-4xl font-display font-bold text-brand-secondary">{s.value}</p>
                  <p className="text-sm text-white/60 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pilares ── */}
      {pillars.length > 0 && (
      <section className="py-24 bg-[var(--surface)] grain-overlay relative overflow-hidden">
        <div className="absolute -right-40 -top-40 w-[500px] h-[500px] rounded-full bg-brand-primary/[0.02]" />
        <div className="relative container mx-auto px-4">
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
              Nossa proposta
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
              Pilares da{' '}
              <span className="italic">Educação Infantil</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pillars.map((p, i) => {
              const Icon = resolveIcon(p.icon);
              return (
                <div
                  key={p.title}
                  className="group relative bg-white rounded-2xl p-8 transition-all duration-500 hover:bg-brand-primary hover:shadow-[0_20px_60px_-15px_rgba(0,56,118,0.3)]"
                  data-reveal="up"
                  style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
                >
                  <p className="font-display text-5xl font-bold text-brand-primary/10 group-hover:text-white/15 transition-colors duration-500 absolute top-4 right-6">
                    {p.stat}
                  </p>
                  <div className="w-14 h-14 bg-brand-primary group-hover:bg-brand-secondary rounded-xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                    <Icon className="w-7 h-7 text-white group-hover:text-brand-primary transition-colors duration-500" />
                  </div>
                  <h3 className="text-lg font-bold text-brand-primary group-hover:text-white mb-3 transition-colors duration-500">
                    {p.title}
                  </h3>
                  <p className="text-gray-500 group-hover:text-white/70 text-sm leading-relaxed mb-4 transition-colors duration-500">
                    {p.desc}
                  </p>
                  <p className="text-xs font-semibold text-brand-secondary tracking-wide uppercase">
                    {p.statLabel}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ── Campos de Experiências ── */}
      {campos.length > 0 && (
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
              Currículo
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
              {(() => {
                const words = camposTitle.split(' ');
                if (words.length <= 1) return <span className="italic">{camposTitle}</span>;
                const last = words.pop()!;
                return <>{words.join(' ')} <span className="italic">{last}</span></>;
              })()}
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {campos.map((c, i) => (
              <div
                key={c.title}
                className="img-zoom rounded-2xl overflow-hidden relative h-80"
                data-reveal="up"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                <img src={c.img} alt={c.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/90 via-brand-primary/40 to-transparent" />
                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="font-display text-xl font-bold mb-2">{c.title}</h3>
                  <p className="text-sm text-white/85 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── Atividades Diárias ── */}
      {atividades.length > 0 && (
      <section className="py-24 bg-[var(--surface)]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
              Rotina
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
              Atividades <span className="italic">Diárias</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {atividades.map((a, i) => {
              const Icon = resolveIcon(a.icon);
              return (
                <div
                  key={a.title}
                  className="group bg-white rounded-2xl p-7 border border-gray-100 hover:border-brand-secondary/40 hover:shadow-lg transition-all duration-300 gold-line-hover"
                  data-reveal="up"
                  style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
                >
                  <div className="w-12 h-12 bg-brand-primary/10 group-hover:bg-brand-primary rounded-xl flex items-center justify-center mb-5 transition-colors duration-300">
                    <Icon className="w-6 h-6 text-brand-primary group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-brand-primary mb-2">{a.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{a.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ── Resultados ── */}
      {resultados.length > 0 && (
        <section className="relative py-24 bg-brand-primary grain-overlay overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]">
            <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-brand-secondary" />
            <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-white" />
          </div>
          <div className="relative z-10 container mx-auto px-4">
            <div className="text-center mb-16" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                {(() => {
                  const words = resultadosTitle.split(' ');
                  return words.length > 1 ? words.slice(0, -1).join(' ') : resultadosTitle;
                })()}
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
                {(() => {
                  const words = resultadosTitle.split(' ');
                  if (words.length <= 1) return <span className="italic">{resultadosTitle}</span>;
                  const last = words.pop()!;
                  return <>{words.join(' ')} <span className="italic">{last}</span></>;
                })()}
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            <div className={`grid sm:grid-cols-2 ${resultados.length >= 4 ? 'lg:grid-cols-4' : `lg:grid-cols-${resultados.length}`} gap-8`}>
              {resultados.map(({ value, label }, i) => (
                <div
                  key={label}
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

      {/* ── Horários ── */}
      {horariosList.length > 0 && (
        <section className="py-24 bg-[var(--surface)]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16" data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
                Organização
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
                {(() => {
                  const words = horariosTitle.split(' ');
                  if (words.length <= 1) return <span className="italic">{horariosTitle}</span>;
                  const last = words.pop()!;
                  return <>{words.join(' ')} <span className="italic">{last}</span></>;
                })()}
              </h2>
              <div className="section-divider mx-auto mt-6" />
            </div>

            <div className={`grid ${horariosList.length >= 2 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-lg mx-auto'} gap-8 max-w-3xl mx-auto`}>
              {horariosList.map((turno, i) => (
                <div
                  key={turno.title}
                  className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm"
                  data-reveal="up"
                  style={{ '--delay': `${i * 0.12}s` } as React.CSSProperties}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-display text-xl font-bold text-brand-primary">{turno.title}</h3>
                  </div>
                  <ul>
                    {turno.times.map(({ label, time }) => (
                      <li key={label} className="flex justify-between items-center py-3.5 border-b border-gray-100 last:border-0">
                        <span className="text-gray-600 text-sm">{label}</span>
                        <span className="text-brand-primary font-bold text-sm">{time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
            Venha Conhecer <span className="italic">Nossa Escola</span>
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
            Agende uma visita e conheça de perto nossa proposta pedagógica e estrutura completa.
          </p>
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
