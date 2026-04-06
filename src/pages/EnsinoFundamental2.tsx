import { Link } from 'react-router-dom';
import { Target, Users, Star, Award, Lightbulb, Clock, Brain, Rocket, ArrowRight } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const PILLARS = [
  {
    icon: Brain,
    title: 'Pensamento Crítico',
    desc: 'Desenvolvimento do raciocínio lógico e análise crítica para resolver problemas reais.',
    stat: '95%',
    statLabel: 'aprovação vestibulares',
  },
  {
    icon: Rocket,
    title: 'Inovação',
    desc: 'Tecnologia integrada ao processo de aprendizagem de forma natural e criativa.',
    stat: '100%',
    statLabel: 'laboratórios modernos',
  },
  {
    icon: Users,
    title: 'Protagonismo',
    desc: 'Desenvolvimento da autonomia e liderança com projetos que estimulam o protagonismo juvenil.',
    stat: '15',
    statLabel: 'alunos por turma',
  },
  {
    icon: Target,
    title: 'Preparação',
    desc: 'Base sólida para o Ensino Médio e os grandes desafios que estão por vir.',
    stat: '50+',
    statLabel: 'anos de tradição',
  },
];

const PROGRAMA = [
  {
    icon: Star,
    title: 'Base Curricular',
    items: ['Português e Literatura', 'Matemática', 'Ciências', 'História e Geografia'],
  },
  {
    icon: Award,
    title: 'Disciplinas Complementares',
    items: ['Inglês Avançado', 'Educação Tecnológica', 'Iniciação Científica', 'Educação Física'],
  },
  {
    icon: Lightbulb,
    title: 'Projetos Especiais',
    items: ['Feira de Ciências', 'Olimpíadas do Conhecimento', 'Projetos Interdisciplinares', 'Clube de Robótica'],
  },
];

const ATIVIDADES = [
  {
    img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1000',
    title: 'Laboratório de Ciências',
    desc: 'Experimentos práticos e descobertas científicas',
  },
  {
    img: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000',
    title: 'Práticas Esportivas',
    desc: 'Desenvolvimento físico e trabalho em equipe',
  },
  {
    img: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=1000',
    title: 'Tecnologia e Inovação',
    desc: 'Programação, robótica e pensamento computacional',
  },
];

export default function EnsinoFundamental2() {
  const pillarsRef    = useScrollReveal();
  const programaRef   = useScrollReveal();
  const atividadesRef = useScrollReveal();
  const horariosRef   = useScrollReveal();
  const ctaRef        = useScrollReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=2070"
            alt="Estudantes em laboratório"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#003876]/95 via-[#003876]/80 to-[#002855]/70" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        <div className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            <div className="hero-badge inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-[#ffd700] rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-medium tracking-wide">
                Fundamental II · 6º ao 9º ano
              </span>
            </div>

            <h1 className="hero-text-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              Construindo o{' '}
              <span className="italic text-[#ffd700]">Futuro</span>
              <br />de cada jovem
            </h1>

            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-[#ffd700] to-[#ffe44d] rounded-full mb-8" />

            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed mb-10">
              Preparando jovens para os desafios do futuro com excelência acadêmica
              e valores sólidos que duram para toda a vida.
            </p>

            <div className="hero-text-3 flex flex-wrap gap-4">
              <Link
                to="/contato"
                className="group inline-flex items-center gap-3 bg-[#ffd700] text-[#003876] px-8 py-4 rounded-full font-semibold transition-all duration-500 hover:bg-white hover:shadow-[0_0_40px_rgba(255,215,0,0.4)] active:scale-95"
              >
                Agende uma Visita
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/matricula"
                className="group inline-flex items-center gap-3 border-2 border-white/60 text-white px-8 py-4 rounded-full font-semibold transition-all duration-500 hover:bg-white hover:text-[#003876] hover:border-white hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-95"
              >
                Fazer Matrícula
              </Link>
            </div>

            <div className="hero-text-4 flex flex-wrap gap-8 mt-14 pt-8 border-t border-white/15">
              {[
                { value: '50+', label: 'Anos de história' },
                { value: '15',  label: 'Alunos por turma' },
                { value: '95%', label: 'Aprovação vestibular' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-3xl md:text-4xl font-display font-bold text-[#ffd700]">{s.value}</p>
                  <p className="text-sm text-white/60 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pilares ── */}
      <section className="py-24 bg-[var(--surface)] relative overflow-hidden">
        <div className="absolute -right-40 -top-40 w-[500px] h-[500px] rounded-full bg-[#003876]/[0.02]" />
        <div className="relative container mx-auto px-4" ref={pillarsRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Por que escolher
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Formação Completa para{' '}
              <span className="italic">o Futuro</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {PILLARS.map((p, i) => (
              <div
                key={p.title}
                className="group relative bg-white rounded-2xl p-8 transition-all duration-500 hover:bg-[#003876] hover:shadow-[0_20px_60px_-15px_rgba(0,56,118,0.3)]"
                data-reveal="up"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                <p className="font-display text-5xl font-bold text-[#003876]/10 group-hover:text-white/15 transition-colors duration-500 absolute top-4 right-6">
                  {p.stat}
                </p>
                <div className="w-14 h-14 bg-[#003876] group-hover:bg-[#ffd700] rounded-xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                  <p.icon className="w-7 h-7 text-white group-hover:text-[#003876] transition-colors duration-500" />
                </div>
                <h3 className="text-lg font-bold text-[#003876] group-hover:text-white mb-3 transition-colors duration-500">
                  {p.title}
                </h3>
                <p className="text-gray-500 group-hover:text-white/70 text-sm leading-relaxed mb-4 transition-colors duration-500">
                  {p.desc}
                </p>
                <p className="text-xs font-semibold text-[#ffd700] tracking-wide uppercase">
                  {p.statLabel}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Programa Acadêmico ── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4" ref={programaRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Currículo
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Programa <span className="italic">Acadêmico</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {PROGRAMA.map((prog, i) => (
              <div
                key={prog.title}
                className="group bg-[var(--surface)] rounded-2xl p-8 border border-transparent hover:border-[#ffd700]/30 transition-all duration-500 hover:shadow-lg"
                data-reveal="up"
                style={{ '--delay': `${i * 0.12}s` } as React.CSSProperties}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#003876] rounded-xl flex items-center justify-center group-hover:rotate-3 transition-transform duration-500">
                    <prog.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-[#003876]">{prog.title}</h3>
                </div>
                <ul className="space-y-3">
                  {prog.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-gray-600 text-sm">
                      <span className="w-5 h-5 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                        <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Atividades Extracurriculares ── */}
      <section className="py-24 bg-[var(--surface)] grain-overlay relative">
        <div className="container mx-auto px-4" ref={atividadesRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Além da sala de aula
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Atividades <span className="italic">Extracurriculares</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {ATIVIDADES.map((a, i) => (
              <div
                key={a.title}
                className="img-zoom rounded-2xl overflow-hidden relative h-72"
                data-reveal="scale"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                <img src={a.img} alt={a.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/90 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="font-display text-xl font-bold mb-1">{a.title}</h3>
                  <p className="text-sm text-white/80">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Horários ── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4" ref={horariosRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Organização
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Horários <span className="italic">Escolares</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              { label: 'Turno Matutino',   times: [{ l: 'Entrada', t: '7h00' }, { l: 'Intervalo', t: '9h30 – 9h50' }, { l: 'Saída', t: '12h30' }] },
              { label: 'Turno Vespertino', times: [{ l: 'Entrada', t: '13h00' }, { l: 'Intervalo', t: '15h30 – 15h50' }, { l: 'Saída', t: '18h30' }] },
            ].map((turno, i) => (
              <div
                key={turno.label}
                className="bg-[var(--surface)] rounded-2xl p-8 border border-gray-100 shadow-sm"
                data-reveal="up"
                style={{ '--delay': `${i * 0.12}s` } as React.CSSProperties}
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-[#003876] rounded-xl flex items-center justify-center">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#003876]">{turno.label}</h3>
                </div>
                <ul>
                  {turno.times.map(({ l, t }) => (
                    <li key={l} className="flex justify-between items-center py-3.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-600 text-sm">{l}</span>
                      <span className="text-[#003876] font-bold text-sm">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-20 bg-[#003876] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[#ffd700]" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-white" />
        </div>
        <div ref={ctaRef} className="relative container mx-auto px-4 text-center" data-reveal="scale">
          <p className="text-[#ffd700] text-sm font-semibold tracking-[0.2em] uppercase mb-4">
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
              to="/contato"
              className="group inline-flex items-center gap-3 bg-[#ffd700] text-[#003876] px-10 py-5 rounded-full font-bold text-lg transition-all duration-500 hover:bg-white hover:shadow-[0_0_60px_rgba(255,215,0,0.4)] active:scale-95"
            >
              Agende uma Visita
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/matricula"
              className="inline-flex items-center gap-3 border-2 border-white/60 text-white px-10 py-5 rounded-full font-bold text-lg transition-all duration-500 hover:bg-white hover:text-[#003876] active:scale-95"
            >
              Fazer Matrícula
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
