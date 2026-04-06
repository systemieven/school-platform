import { Link } from 'react-router-dom';
import { Target, Users, Star, Award, Clock, Brain, Rocket, Trophy } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function EnsinoMedio() {
  const overviewRef = useScrollReveal();
  const programaRef = useScrollReveal();
  const resultadosRef = useScrollReveal();
  const horariosRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden grain-overlay">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070"
            alt="Estudantes em laboratório avançado"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/95 via-[#003876]/75 to-[#003876]/40" />
        </div>

        <div className="relative z-10 container mx-auto px-6 h-full flex flex-col justify-center">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="hero-badge inline-flex items-center gap-2 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-white/90">
                Ensino Médio · 1ª a 3ª série
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-display text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.02] mb-6">
              Sua rota para
              <br />
              o{' '}
              <em className="not-italic text-[#ffd700]">Sucesso</em>
            </h1>

            <div className="hero-accent-line mb-6" />

            <p className="hero-text-3 text-white/80 text-lg leading-relaxed mb-10 max-w-xl">
              Excelência acadêmica e preparação completa para o sucesso no ENEM e
              vestibulares das melhores universidades do país.
            </p>

            {/* Dual CTA */}
            <div className="flex flex-wrap gap-4 mb-16">
              <Link
                to="/matricula"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-semibold text-sm tracking-wide hover:bg-[#ffe44d] transition-all duration-300 hover:scale-105 shadow-lg shadow-black/25"
              >
                Fazer Matrícula
              </Link>
              <a
                href="#programa"
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/50 text-white rounded-full font-semibold text-sm tracking-wide hover:border-white hover:bg-white/10 transition-all duration-300"
              >
                Conheça o Programa
              </a>
            </div>

            {/* Stats row */}
            <div className="hero-text-4 flex flex-wrap gap-8">
              {[
                { value: '95%', label: 'Aprovação vestibulares' },
                { value: '750+', label: 'Média ENEM' },
                { value: '100+', label: 'Aprovações em federais' },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col">
                  <span className="font-display text-3xl font-bold text-[#ffd700]">
                    {value}
                  </span>
                  <span className="text-white/60 text-xs tracking-wide mt-0.5">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Diagonal slice */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />
      </section>

      {/* ── Overview ────────────────────────────────────────────── */}
      <section className="py-24 bg-[var(--surface)] grain-overlay">
        <div className="container mx-auto px-6" ref={overviewRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Nossos diferenciais
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Preparação Completa para o Futuro
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <Trophy className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">
                  Excelência
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Alto índice de aprovação em vestibulares das universidades mais
                  concorridas do Brasil.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">
                  Metodologia
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Aprendizagem ativa e personalizada que respeita o ritmo de cada
                  estudante.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.25s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">
                  Foco
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Preparação específica e estruturada para o ENEM com simulados e
                  análise de desempenho.
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.35s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">
                  Mentoria
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Orientação vocacional e acadêmica para ajudar cada aluno a
                  encontrar seu caminho.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Programa Acadêmico ──────────────────────────────────── */}
      <section id="programa" className="py-24 bg-white">
        <div className="container mx-auto px-6" ref={programaRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Currículo
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Programa Acadêmico
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Programa 1 — Base Curricular */}
            <div
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 h-full"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <Star className="h-10 w-10 text-[#ffd700] mb-6" />
              <h3 className="font-display text-xl font-bold text-[#003876] mb-5">
                Base Curricular
              </h3>
              <ul>
                {[
                  'Linguagens e suas Tecnologias',
                  'Matemática e suas Tecnologias',
                  'Ciências da Natureza',
                  'Ciências Humanas',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="mt-1 w-4 h-4 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
                    </span>
                    <span className="text-gray-600 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Programa 2 — Preparação ENEM */}
            <div
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 h-full"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <Award className="h-10 w-10 text-[#ffd700] mb-6" />
              <h3 className="font-display text-xl font-bold text-[#003876] mb-5">
                Preparação ENEM
              </h3>
              <ul>
                {[
                  'Simulados periódicos',
                  'Resolução de questões',
                  'Redação semanal',
                  'Monitorias extras',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="mt-1 w-4 h-4 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
                    </span>
                    <span className="text-gray-600 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Programa 3 — Diferenciais */}
            <div
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 h-full"
              data-reveal="up"
              style={{ '--delay': '0.25s' } as React.CSSProperties}
            >
              <Rocket className="h-10 w-10 text-[#ffd700] mb-6" />
              <h3 className="font-display text-xl font-bold text-[#003876] mb-5">
                Diferenciais
              </h3>
              <ul>
                {[
                  'Orientação vocacional',
                  'Mentoria acadêmica',
                  'Projetos de pesquisa',
                  'Laboratórios avançados',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="mt-1 w-4 h-4 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
                    </span>
                    <span className="text-gray-600 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Resultados ──────────────────────────────────────────── */}
      <section className="relative py-24 bg-[#003876] grain-overlay overflow-hidden">
        {/* Top diagonal */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-white [clip-path:polygon(0_0,100%_0,100%_100%)] z-10" />

        <div className="relative z-20 container mx-auto px-6 pt-8" ref={resultadosRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Nosso histórico
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
              Resultados que Impressionam
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: '95%', label: 'Aprovação em vestibulares' },
              { value: '750+', label: 'Média no ENEM' },
              { value: '100+', label: 'Aprovações em federais' },
              { value: '50+', label: 'Anos de tradição' },
            ].map(({ value, label }, i) => (
              <div
                key={label}
                className="text-center"
                data-reveal="scale"
                style={{ '--delay': `${0.05 + i * 0.1}s` } as React.CSSProperties}
              >
                <p className="stat-number font-display text-6xl font-bold mb-2 !text-[#ffd700]">
                  {value}
                </p>
                <p className="text-white/60 text-sm tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Horários ────────────────────────────────────────────── */}
      <section className="py-24 bg-[var(--surface)]">
        <div className="container mx-auto px-6" ref={horariosRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Organização
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Horários
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Turno Regular */}
            <div
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#003876] rounded-xl flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876]">
                  Turno Regular
                </h3>
              </div>
              <ul>
                {[
                  { label: 'Entrada', time: '7h00' },
                  { label: 'Intervalo', time: '9h30 – 9h50' },
                  { label: 'Saída', time: '13h00' },
                ].map(({ label, time }) => (
                  <li
                    key={label}
                    className="flex justify-between items-center py-3.5 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-gray-600 text-sm">{label}</span>
                    <span className="text-[#003876] font-bold text-sm">{time}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Atividades Extras */}
            <div
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#003876] rounded-xl flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876]">
                  Atividades Extras
                </h3>
              </div>
              <ul>
                {[
                  { label: 'Monitorias', time: '14h00 – 16h00' },
                  { label: 'Laboratórios', time: '14h00 – 17h00' },
                  { label: 'Simulados', time: 'Sábados' },
                ].map(({ label, time }) => (
                  <li
                    key={label}
                    className="flex justify-between items-center py-3.5 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-gray-600 text-sm">{label}</span>
                    <span className="text-[#003876] font-bold text-sm">{time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6" ref={ctaRef}>
          <div className="text-center max-w-2xl mx-auto" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-4">
              Próximo passo
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876] leading-tight mb-4">
              Construa seu futuro conosco
            </h2>
            <div className="section-divider mx-auto mt-0 mb-8" />
            <p className="text-gray-600 text-lg leading-relaxed mb-10">
              Prepare-se para o sucesso com uma educação de excelência que abre as
              portas das melhores universidades do Brasil.
            </p>
            <Link
              to="/matricula"
              className="inline-flex items-center gap-2 px-10 py-4 bg-[#ffd700] text-[#003876] rounded-full font-semibold text-sm tracking-wide hover:bg-[#ffe44d] transition-all duration-300 hover:scale-105 shadow-lg shadow-yellow-200/60"
            >
              Agende uma Visita
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
