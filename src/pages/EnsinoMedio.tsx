import { Link } from 'react-router-dom';
import { Target, Users, Star, Award, Clock, Brain, Rocket, Trophy, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useSettings } from '../hooks/useSettings';
import { getLucideIcon } from '../lib/lucide';

/* ── Types ── */
interface PillarData { icon: string; title: string; desc: string; stat: string; statLabel: string; }
interface ProgData { icon: string; title: string; items: string[]; }
interface CampoData { img: string; title: string; desc: string; }
interface ResultadoData { value: string; label: string; }
interface HorarioTime { label: string; time: string; }
interface HorarioTurno { title: string; times: HorarioTime[]; }
interface SegmentContent { pillars?: PillarData[]; programa?: ProgData[]; campos?: CampoData[]; campos_title?: string; resultados?: ResultadoData[]; resultados_title?: string; horarios?: HorarioTurno[]; horarios_title?: string; }

const ICON_MAP: Record<string, LucideIcon> = { Target, Users, Star, Award, Brain, Rocket, Trophy };

const DEFAULT_PILLARS: PillarData[] = [
  { icon: 'Trophy', title: 'Excelência',  desc: 'Alto índice de aprovação em vestibulares das universidades mais concorridas do Brasil.', stat: '90%+', statLabel: 'aprovação vestibulares' },
  { icon: 'Brain',  title: 'Metodologia', desc: 'Aprendizagem ativa e personalizada que respeita o ritmo de cada estudante.',             stat: '920+', statLabel: 'média ENEM' },
  { icon: 'Target', title: 'Foco',        desc: 'Preparação específica e estruturada para o ENEM com simulados e análise de desempenho.', stat: '100+', statLabel: 'aprovações em federais' },
  { icon: 'Users',  title: 'Mentoria',    desc: 'Orientação vocacional e acadêmica para ajudar cada aluno a encontrar seu caminho.',      stat: '20+',  statLabel: 'anos de tradição' },
];

const DEFAULT_PROGRAMA: ProgData[] = [
  { icon: 'Star',   title: 'Base Curricular',   items: ['Linguagens e suas Tecnologias', 'Matemática e suas Tecnologias', 'Ciências da Natureza', 'Ciências Humanas'] },
  { icon: 'Award',  title: 'Preparação ENEM',   items: ['Simulados periódicos', 'Resolução de questões', 'Redação semanal', 'Monitorias extras'] },
  { icon: 'Rocket', title: 'Diferenciais',      items: ['Orientação vocacional', 'Mentoria acadêmica', 'Projetos de pesquisa', 'Laboratórios avançados'] },
];

const DEFAULT_RESULTADOS: ResultadoData[] = [
  { value: '90%+', label: 'Aprovação em vestibulares' },
  { value: '920+', label: 'Média no ENEM' },
  { value: '100+', label: 'Aprovações em federais' },
  { value: '20+',  label: 'Anos de tradição' },
];

const DEFAULT_HORARIOS: HorarioTurno[] = [
  { title: 'Turno Regular',     times: [{ label: 'Entrada', time: '7h00' }, { label: 'Intervalo', time: '9h30 – 9h50' }, { label: 'Saída', time: '13h00' }] },
  { title: 'Atividades Extras', times: [{ label: 'Monitorias', time: '14h00 – 16h00' }, { label: 'Laboratórios', time: '14h00 – 17h00' }, { label: 'Simulados', time: 'Sábados' }] },
];

const DEFAULT_CAMPOS: CampoData[] = [
  { img: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1000', title: 'Laboratório de Ciências', desc: 'Experimentos avançados em Física, Química e Biologia' },
  { img: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=1000', title: 'Projeto de Pesquisa',     desc: 'Iniciação científica com orientação acadêmica personalizada' },
  { img: 'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?auto=format&fit=crop&q=80&w=1000', title: 'Simulados e Aulões',       desc: 'Preparação intensiva para ENEM e vestibulares com análise de desempenho' },
];

function resolveIcon(name: string): LucideIcon {
  return getLucideIcon(name) ?? ICON_MAP[name] ?? Trophy;
}

export default function EnsinoMedio() {
  const pillarsRef    = useScrollReveal();
  const programaRef   = useScrollReveal();
  const camposRef     = useScrollReveal();
  const resultadosRef = useScrollReveal();
  const horariosRef   = useScrollReveal();
  const ctaRef        = useScrollReveal();

  const { settings: appearanceSettings } = useSettings('appearance');
  const { settings: contentSettings } = useSettings('content');
  const segContent = (contentSettings.segment_ensino_medio as SegmentContent | undefined) ?? {};
  const pillars    = segContent.pillars     ?? DEFAULT_PILLARS;
  const programa   = segContent.programa    ?? DEFAULT_PROGRAMA;
  const campos     = segContent.campos      ?? DEFAULT_CAMPOS;
  const camposTitle = segContent.campos_title ?? 'Projetos e Laboratórios';
  const resultados      = segContent.resultados       ?? DEFAULT_RESULTADOS;
  const resultadosTitle = segContent.resultados_title  ?? 'Nosso Histórico';
  const horariosList     = segContent.horarios         ?? DEFAULT_HORARIOS;
  const horariosTitle    = segContent.horarios_title   ?? 'Horários Escolares';
  const hero = (appearanceSettings.ensino_medio as Record<string, string> | undefined) ?? {};
  const heroBadge    = hero.badge     || 'Ensino Médio · 1º a 3º ano';
  const heroTitle    = hero.title     || 'Sua rota para o Sucesso';
  const heroHL       = hero.highlight || 'Sucesso';
  const heroSubtitle = hero.subtitle  || 'Excelência acadêmica e preparação completa para o sucesso no ENEM e vestibulares das melhores universidades do país.';
  const heroImage    = hero.image     || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070';

  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Estudantes em laboratório avançado"
            className="w-full h-full object-cover"
          />
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
                { value: '90%+', label: 'Aprovação vestibulares' },
                { value: '920+', label: 'Média ENEM' },
                { value: '100+', label: 'Aprovações em federais' },
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
      <section className="py-24 bg-[var(--surface)] relative overflow-hidden">
        <div className="absolute -right-40 -top-40 w-[500px] h-[500px] rounded-full bg-brand-primary/[0.02]" />
        <div className="relative container mx-auto px-4" ref={pillarsRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
              Nossos diferenciais
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
              Preparação Completa para{' '}
              <span className="italic">o Futuro</span>
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

      {/* ── Programa Acadêmico ── */}
      <section id="programa" className="py-24 bg-white">
        <div className="container mx-auto px-4" ref={programaRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
              Currículo
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-primary">
              Programa <span className="italic">Acadêmico</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {programa.map((prog, i) => {
              const Icon = resolveIcon(prog.icon);
              return (
                <div
                  key={prog.title}
                  className="group bg-[var(--surface)] rounded-2xl p-8 border border-transparent hover:border-brand-secondary/30 transition-all duration-500 hover:shadow-lg"
                  data-reveal="up"
                  style={{ '--delay': `${i * 0.12}s` } as React.CSSProperties}
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center group-hover:rotate-3 transition-transform duration-500">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-brand-primary">{prog.title}</h3>
                  </div>
                  <ul className="space-y-3">
                    {prog.items.map((item) => (
                      <li key={item} className="flex items-center gap-3 text-gray-600 text-sm">
                        <span className="w-5 h-5 rounded-full bg-brand-secondary/20 flex items-center justify-center shrink-0">
                          <span className="w-2 h-2 rounded-full bg-brand-secondary" />
                        </span>
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

      {/* ── Campos / Image-Cards ── */}
      <section className="py-24 bg-[var(--surface)] grain-overlay relative">
        <div className="container mx-auto px-4" ref={camposRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-brand-secondary mb-3">
              Vivências
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

      {/* ── Resultados ── */}
      {resultados.length > 0 && (
        <section className="relative py-24 bg-brand-primary grain-overlay overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]">
            <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-brand-secondary" />
            <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-white" />
          </div>
          <div className="relative z-10 container mx-auto px-4" ref={resultadosRef}>
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
          <div className="container mx-auto px-4" ref={horariosRef}>
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
                  <div className="flex items-center gap-3 mb-8">
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
        <div ref={ctaRef} className="relative container mx-auto px-4 text-center" data-reveal="scale">
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
