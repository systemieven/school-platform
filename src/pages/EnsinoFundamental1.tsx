import { Link } from 'react-router-dom';
import { BookOpen, Target, Users, Lightbulb, Star, Award, Clock } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function EnsinoFundamental1() {
  const overviewRef = useScrollReveal();
  const diferenciaisRef = useScrollReveal();
  const horariosRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <div className="min-h-screen">

      {/* ─── Hero ─── */}
      <section className="relative h-[75vh] min-h-[520px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2070"
            alt="Alunos em sala de aula"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/95 via-[#003876]/80 to-[#003876]/50" />
          <div className="grain-overlay absolute inset-0" />
        </div>

        <div className="relative z-10 container mx-auto px-6 h-full flex items-center">
          <div className="max-w-2xl">
            <div className="hero-badge inline-flex items-center gap-2 mb-8">
              Fundamental I · 1º ao 5º ano
            </div>

            <h1 className="hero-text-1 font-display text-6xl md:text-7xl font-bold text-white leading-tight mb-6">
              Construindo as{' '}
              <em className="not-italic text-[#ffd700]">Bases</em>{' '}
              do Futuro
            </h1>

            <div className="hero-accent-line" />

            <p className="hero-text-2 text-white/85 text-lg md:text-xl leading-relaxed mb-10 max-w-xl">
              Construindo bases sólidas para o futuro através de uma educação integral e inovadora.
            </p>

            <div className="hero-text-3">
              <Link
                to="/contato"
                className="inline-flex items-center px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-bold text-base hover:bg-[#ffe44d] transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Agende uma Visita
              </Link>
            </div>
          </div>
        </div>

        {/* diagonal slice — white bg because next section is white */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-white [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />
      </section>

      {/* ─── Overview ─── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6" ref={overviewRef}>
          <div className="text-center mb-6" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Nossa proposta
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Formação Integral e Desenvolvimento Pleno
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <p
            className="text-gray-600 text-lg text-center max-w-3xl mx-auto mb-16 leading-relaxed"
            data-reveal="up"
            style={{ '--delay': '0.1s' } as React.CSSProperties}
          >
            No Ensino Fundamental I, focamos no desenvolvimento das habilidades essenciais, preparando
            os alunos para os desafios futuros com uma base acadêmica sólida e valores cristãos.
          </p>

          <div className="grid md:grid-cols-4 gap-6">
            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <BookOpen className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">Aprendizagem Ativa</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Metodologias inovadoras que estimulam o protagonismo do aluno.
                </p>
              </div>
            </div>

            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">Objetivos Claros</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Metas de aprendizagem definidas e acompanhamento personalizado.
                </p>
              </div>
            </div>

            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.25s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">Valores Cristãos</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Formação integral baseada em princípios éticos e morais.
                </p>
              </div>
            </div>

            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.35s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <Lightbulb className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">Criatividade</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Estímulo ao pensamento criativo e resolução de problemas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Diferenciais ─── */}
      <section className="py-24 bg-[var(--surface)]">
        <div className="container mx-auto px-6" ref={diferenciaisRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Por que o Batista
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Nossos Diferenciais
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div
              className="bg-white rounded-2xl p-8 shadow-lg"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-[#ffd700]/15 rounded-xl flex items-center justify-center shrink-0">
                  <Star className="h-6 w-6 text-[#ffd700]" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876]">Programa Acadêmico</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                  </span>
                  <span className="text-gray-600 text-sm">Material didático de excelência</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                  </span>
                  <span className="text-gray-600 text-sm">Projetos interdisciplinares</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                  </span>
                  <span className="text-gray-600 text-sm">Acompanhamento personalizado</span>
                </li>
              </ul>
            </div>

            <div
              className="bg-white rounded-2xl p-8 shadow-lg"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-[#ffd700]/15 rounded-xl flex items-center justify-center shrink-0">
                  <Award className="h-6 w-6 text-[#ffd700]" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876]">Atividades Complementares</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                  </span>
                  <span className="text-gray-600 text-sm">Oficinas de tecnologia</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                  </span>
                  <span className="text-gray-600 text-sm">Práticas esportivas</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-[#ffd700]/20 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#ffd700]" />
                  </span>
                  <span className="text-gray-600 text-sm">Iniciação científica</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Horários ─── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6" ref={horariosRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Organização
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Rotina Escolar
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div
              className="bg-[var(--surface)] rounded-2xl p-8 border border-gray-100"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#003876]/10 rounded-xl flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#003876]" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876]">Turno Matutino</h3>
              </div>
              <ul>
                <li className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-700 font-medium text-sm">Entrada</span>
                  <span className="text-[#003876] font-semibold text-sm">7h00</span>
                </li>
                <li className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-700 font-medium text-sm">Intervalo</span>
                  <span className="text-[#003876] font-semibold text-sm">9h30 – 9h50</span>
                </li>
                <li className="flex justify-between py-3 last:border-0">
                  <span className="text-gray-700 font-medium text-sm">Saída</span>
                  <span className="text-[#003876] font-semibold text-sm">11h30</span>
                </li>
              </ul>
            </div>

            <div
              className="bg-[var(--surface)] rounded-2xl p-8 border border-gray-100"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#003876]/10 rounded-xl flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#003876]" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876]">Turno Vespertino</h3>
              </div>
              <ul>
                <li className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-700 font-medium text-sm">Entrada</span>
                  <span className="text-[#003876] font-semibold text-sm">13h00</span>
                </li>
                <li className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-700 font-medium text-sm">Intervalo</span>
                  <span className="text-[#003876] font-semibold text-sm">15h30 – 15h50</span>
                </li>
                <li className="flex justify-between py-3 last:border-0">
                  <span className="text-gray-700 font-medium text-sm">Saída</span>
                  <span className="text-[#003876] font-semibold text-sm">17h30</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 bg-[#003876] overflow-hidden">
        {/* diagonal top slice */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-white [clip-path:polygon(0_0,100%_100%,0_100%)] z-10" />
        <div className="grain-overlay absolute inset-0" />

        <div className="relative z-20 container mx-auto px-6" ref={ctaRef}>
          <div className="text-center max-w-2xl mx-auto">
            <div data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-4">
                Próximo passo
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
                Venha conhecer nossa escola
              </h2>
              <div className="section-divider mx-auto mt-6 mb-6" />
              <p className="text-white/80 leading-relaxed mb-10">
                Agende uma visita e conheça nossa estrutura e proposta pedagógica.
              </p>
              <Link
                to="/contato"
                className="inline-flex items-center px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-bold hover:bg-[#ffe44d] transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Agende uma Visita
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
