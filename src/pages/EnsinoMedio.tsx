import { Link } from 'react-router-dom';
import { Target, Users, Star, Award, Clock, Brain, Rocket, Trophy, ArrowRight } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const PILLARS = [
  {
    icon: Trophy,
    title: 'Excelência',
    desc: 'Alto índice de aprovação em vestibulares das universidades mais concorridas do Brasil.',
    stat: '90%+',
    statLabel: 'aprovação vestibulares',
  },
  {
    icon: Brain,
    title: 'Metodologia',
    desc: 'Aprendizagem ativa e personalizada que respeita o ritmo de cada estudante.',
    stat: '920+',
    statLabel: 'média ENEM',
  },
  {
    icon: Target,
    title: 'Foco',
    desc: 'Preparação específica e estruturada para o ENEM com simulados e análise de desempenho.',
    stat: '100+',
    statLabel: 'aprovações em federais',
  },
  {
    icon: Users,
    title: 'Mentoria',
    desc: 'Orientação vocacional e acadêmica para ajudar cada aluno a encontrar seu caminho.',
    stat: '20+',
    statLabel: 'anos de tradição',
  },
];

const PROGRAMA = [
  {
    icon: Star,
    title: 'Base Curricular',
    items: ['Linguagens e suas Tecnologias', 'Matemática e suas Tecnologias', 'Ciências da Natureza', 'Ciências Humanas'],
  },
  {
    icon: Award,
    title: 'Preparação ENEM',
    items: ['Simulados periódicos', 'Resolução de questões', 'Redação semanal', 'Monitorias extras'],
  },
  {
    icon: Rocket,
    title: 'Diferenciais',
    items: ['Orientação vocacional', 'Mentoria acadêmica', 'Projetos de pesquisa', 'Laboratórios avançados'],
  },
];

export default function EnsinoMedio() {
  const pillarsRef    = useScrollReveal();
  const programaRef   = useScrollReveal();
  const resultadosRef = useScrollReveal();
  const horariosRef   = useScrollReveal();
  const ctaRef        = useScrollReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070"
            alt="Estudantes em laboratório avançado"
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
                Ensino Médio · 1º a 3º ano
              </span>
            </div>

            <h1 className="hero-text-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              Sua rota para
              <br />o{' '}
              <span className="italic text-[#ffd700]">Sucesso</span>
            </h1>

            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-[#ffd700] to-[#ffe44d] rounded-full mb-8" />

            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed mb-10">
              Excelência acadêmica e preparação completa para o sucesso no ENEM e
              vestibulares das melhores universidades do país.
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
                { value: '90%+', label: 'Aprovação vestibulares' },
                { value: '920+', label: 'Média ENEM' },
                { value: '100+', label: 'Aprovações em federais' },
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
              Nossos diferenciais
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Preparação Completa para{' '}
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
      <section id="programa" className="py-24 bg-white">
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

      {/* ── Resultados ── */}
      <section className="relative py-24 bg-[#003876] grain-overlay overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-[#ffd700]" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-white" />
        </div>
        <div className="relative z-10 container mx-auto px-4" ref={resultadosRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Nosso histórico
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
              Resultados que <span className="italic">Impressionam</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: '90%+', label: 'Aprovação em vestibulares' },
              { value: '920+', label: 'Média no ENEM' },
              { value: '100+', label: 'Aprovações em federais' },
              { value: '20+',  label: 'Anos de tradição' },
            ].map(({ value, label }, i) => (
              <div
                key={label}
                className="text-center"
                data-reveal="scale"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                <p className="font-display text-6xl font-bold mb-2 text-[#ffd700]">{value}</p>
                <p className="text-white/60 text-sm tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Horários ── */}
      <section className="py-24 bg-[var(--surface)]">
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
              { label: 'Turno Regular',       times: [{ l: 'Entrada', t: '7h00' }, { l: 'Intervalo', t: '9h30 – 9h50' }, { l: 'Saída', t: '13h00' }] },
              { label: 'Atividades Extras',   times: [{ l: 'Monitorias', t: '14h00 – 16h00' }, { l: 'Laboratórios', t: '14h00 – 17h00' }, { l: 'Simulados', t: 'Sábados' }] },
            ].map((turno, i) => (
              <div
                key={turno.label}
                className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm"
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
