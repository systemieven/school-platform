import { Link } from 'react-router-dom';
import { Target, Users, Star, Award, Lightbulb, Clock, Brain, Rocket } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function EnsinoFundamental2() {
  const overviewRef = useScrollReveal();
  const programaRef = useScrollReveal();
  const atividadesRef = useScrollReveal();
  const horariosRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative h-[75vh] min-h-[500px] overflow-hidden grain-overlay">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=2070"
            alt="Estudantes em laboratório"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/92 via-[#003876]/75 to-[#003876]/50" />
        </div>

        <div className="relative z-10 container mx-auto px-6 h-full flex items-center">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="hero-badge inline-flex items-center gap-2 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-white/90">
                Fundamental II · 6º ao 9º ano
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-display text-6xl md:text-7xl font-bold text-white leading-[1.05] mb-6">
              Construindo o{' '}
              <em className="not-italic text-[#ffd700]">Futuro</em>
              <br />
              de cada jovem
            </h1>

            <div className="hero-accent-line mb-6" />

            <p className="hero-text-3 text-white/80 text-lg leading-relaxed mb-10 max-w-lg">
              Preparando jovens para os desafios do futuro com excelência acadêmica
              e valores sólidos que duram para toda a vida.
            </p>

            <Link
              to="/matricula"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-semibold text-sm tracking-wide hover:bg-[#ffe44d] transition-all duration-300 hover:scale-105 shadow-lg shadow-black/20"
            >
              Fazer Matrícula
            </Link>
          </div>
        </div>

        {/* Diagonal slice */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-white [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />
      </section>

      {/* ── Overview ────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6" ref={overviewRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Por que escolher
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Formação Completa para o Futuro
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
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">
                  Pensamento Crítico
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Desenvolvimento do raciocínio lógico e análise crítica para resolver
                  problemas reais.
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
                  <Rocket className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">
                  Inovação
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Tecnologia integrada ao processo de aprendizagem de forma natural
                  e criativa.
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
                  <Users className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">
                  Protagonismo
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Desenvolvimento da autonomia e liderança com projetos que estimulam
                  o protagonismo juvenil.
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
                  <Target className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">
                  Preparação
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Base sólida para o Ensino Médio e os grandes desafios que estão
                  por vir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Programa Acadêmico ──────────────────────────────────── */}
      <section className="py-24 bg-[var(--surface)] grain-overlay">
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
              <ul className="space-y-0">
                {[
                  'Português e Literatura',
                  'Matemática',
                  'Ciências',
                  'História e Geografia',
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

            {/* Programa 2 — Disciplinas Complementares */}
            <div
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 h-full"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <Award className="h-10 w-10 text-[#ffd700] mb-6" />
              <h3 className="font-display text-xl font-bold text-[#003876] mb-5">
                Disciplinas Complementares
              </h3>
              <ul className="space-y-0">
                {[
                  'Inglês Avançado',
                  'Educação Tecnológica',
                  'Iniciação Científica',
                  'Educação Física',
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

            {/* Programa 3 — Projetos Especiais */}
            <div
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 h-full"
              data-reveal="up"
              style={{ '--delay': '0.25s' } as React.CSSProperties}
            >
              <Lightbulb className="h-10 w-10 text-[#ffd700] mb-6" />
              <h3 className="font-display text-xl font-bold text-[#003876] mb-5">
                Projetos Especiais
              </h3>
              <ul className="space-y-0">
                {[
                  'Feira de Ciências',
                  'Olimpíadas do Conhecimento',
                  'Projetos Interdisciplinares',
                  'Clube de Robótica',
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

      {/* ── Atividades Extracurriculares ─────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6" ref={atividadesRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Além da sala de aula
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Atividades Extracurriculares
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Activity 1 */}
            <div
              className="img-zoom rounded-2xl overflow-hidden relative h-72"
              data-reveal="scale"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1000"
                alt="Atividade de laboratório"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/90 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="font-display text-xl font-bold mb-1">
                  Laboratório de Ciências
                </h3>
                <p className="text-sm text-white/80">
                  Experimentos práticos e descobertas científicas
                </p>
              </div>
            </div>

            {/* Activity 2 */}
            <div
              className="img-zoom rounded-2xl overflow-hidden relative h-72"
              data-reveal="scale"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <img
                src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000"
                alt="Atividade esportiva"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/90 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="font-display text-xl font-bold mb-1">
                  Práticas Esportivas
                </h3>
                <p className="text-sm text-white/80">
                  Desenvolvimento físico e trabalho em equipe
                </p>
              </div>
            </div>

            {/* Activity 3 */}
            <div
              className="img-zoom rounded-2xl overflow-hidden relative h-72"
              data-reveal="scale"
              style={{ '--delay': '0.25s' } as React.CSSProperties}
            >
              <img
                src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=1000"
                alt="Atividade tecnológica"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/90 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="font-display text-xl font-bold mb-1">
                  Tecnologia e Inovação
                </h3>
                <p className="text-sm text-white/80">
                  Programação, robótica e pensamento computacional
                </p>
              </div>
            </div>
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
            {/* Matutino */}
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
                  Turno Matutino
                </h3>
              </div>
              <ul>
                {[
                  { label: 'Entrada', time: '7h00' },
                  { label: 'Intervalo', time: '9h30 – 9h50' },
                  { label: 'Saída', time: '12h30' },
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

            {/* Vespertino */}
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
                  Turno Vespertino
                </h3>
              </div>
              <ul>
                {[
                  { label: 'Entrada', time: '13h00' },
                  { label: 'Intervalo', time: '15h30 – 15h50' },
                  { label: 'Saída', time: '18h30' },
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
      <section className="relative py-24 bg-[#003876] grain-overlay overflow-hidden">
        {/* Top diagonal */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-[var(--surface)] [clip-path:polygon(0_0,100%_0,100%_100%)] z-10" />

        <div className="relative z-20 container mx-auto px-6" ref={ctaRef}>
          <div className="text-center max-w-2xl mx-auto" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-4">
              Vagas Limitadas
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Faça parte do nosso time de vencedores
            </h2>
            <div className="section-divider mx-auto mt-0 mb-8" />
            <p className="text-white/75 text-lg mb-10 leading-relaxed">
              Prepare seu filho para os desafios do futuro com uma educação de qualidade.
            </p>
            <Link
              to="/contato"
              className="inline-flex items-center gap-2 px-10 py-4 bg-[#ffd700] text-[#003876] rounded-full font-semibold text-sm tracking-wide hover:bg-[#ffe44d] transition-all duration-300 hover:scale-105 shadow-xl shadow-black/30"
            >
              Agende uma Visita
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
