import { Link } from 'react-router-dom';
import { Heart, Brain, Users, Plane as Plant, Music, Book, Palette, Puzzle } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function EducacaoInfantil() {
  const statsRef = useScrollReveal();
  const pillarsRef = useScrollReveal();
  const camposRef = useScrollReveal();
  const atividadesRef = useScrollReveal();
  const depoimentosRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <div className="min-h-screen">

      {/* ─── Hero ─── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=2070"
            alt="Crianças brincando e aprendendo"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/95 via-[#003876]/80 to-[#003876]/50" />
          <div className="grain-overlay absolute inset-0" />
        </div>

        <div className="relative z-10 container mx-auto px-6 h-full flex items-center">
          <div className="max-w-2xl">
            <div className="hero-badge inline-flex items-center gap-2 mb-8">
              Educação Infantil · 2 a 5 anos
            </div>

            <h1 className="hero-text-1 font-display text-6xl md:text-7xl font-bold text-white leading-tight mb-6">
              Educação que{' '}
              <em className="not-italic text-[#ffd700]">Encanta</em>{' '}
              e Transforma
            </h1>

            <div className="hero-accent-line" />

            <p className="hero-text-2 text-white/85 text-lg md:text-xl leading-relaxed mb-10 max-w-xl">
              Um ambiente acolhedor e estimulante para o desenvolvimento integral do seu filho.
              Aqui, cada criança é única e especial.
            </p>

            <div className="hero-text-3 flex flex-wrap gap-4">
              <Link
                to="/contato"
                className="inline-flex items-center px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-bold text-base hover:bg-[#ffe44d] transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Agende uma Visita
              </Link>
              <Link
                to="/matricula"
                className="inline-flex items-center px-8 py-4 border-2 border-white/60 text-white rounded-full font-semibold text-base hover:bg-white hover:text-[#003876] transition-all duration-300"
              >
                Fazer Matrícula
              </Link>
            </div>
          </div>
        </div>

        {/* diagonal slice */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />
      </section>

      {/* ─── Stats ─── */}
      <section className="py-20 bg-[var(--surface)]">
        <div className="container mx-auto px-6" ref={statsRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Nossa trajetória
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Educação que Transforma
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-10 max-w-3xl mx-auto">
            <div
              className="text-center"
              data-reveal="scale"
              style={{ '--delay': '0.0s' } as React.CSSProperties}
            >
              <p className="stat-number font-display text-5xl font-bold mb-2">25+</p>
              <p className="text-gray-600 font-medium">Anos de experiência</p>
            </div>
            <div
              className="text-center"
              data-reveal="scale"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <p className="stat-number font-display text-5xl font-bold mb-2">15</p>
              <p className="text-gray-600 font-medium">Alunos por turma</p>
            </div>
            <div
              className="text-center"
              data-reveal="scale"
              style={{ '--delay': '0.3s' } as React.CSSProperties}
            >
              <p className="stat-number font-display text-5xl font-bold mb-2">100%</p>
              <p className="text-gray-600 font-medium">Prof. especializados</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pillars ─── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6" ref={pillarsRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Nossa proposta
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Pilares da Nossa Educação Infantil
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div
              className="card-3d"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <div className="card-3d-inner bg-white rounded-2xl p-8 shadow-lg h-full">
                <div className="w-14 h-14 bg-[#003876] rounded-xl flex items-center justify-center mb-6">
                  <Heart className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">Afetividade</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Construímos vínculos afetivos que proporcionam segurança e confiança para o desenvolvimento.
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
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">Cognição</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Estimulamos a curiosidade e o pensamento crítico através de experiências significativas.
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
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">Socialização</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Desenvolvemos habilidades sociais e emocionais através da interação e cooperação.
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
                  <Plant className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#003876] mb-3">Valores</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Cultivamos valores cristãos e éticos que formam o caráter e a cidadania.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Campos de Experiências ─── */}
      <section className="py-24 bg-[var(--surface)] grain-overlay">
        <div className="container mx-auto px-6" ref={camposRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Currículo
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Campos de Experiências
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div
              className="img-zoom rounded-2xl overflow-hidden relative h-80"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <img
                src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000"
                alt="O Eu, o Outro e o Nós"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/90 via-[#003876]/40 to-transparent" />
              <div className="absolute bottom-0 p-6 text-white">
                <h3 className="font-display text-xl font-bold mb-2">O Eu, o Outro e o Nós</h3>
                <p className="text-sm text-white/85 leading-relaxed">
                  Desenvolvimento da identidade e das relações sociais
                </p>
              </div>
            </div>

            <div
              className="img-zoom rounded-2xl overflow-hidden relative h-80"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <img
                src="https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&q=80&w=1000"
                alt="Corpo, Gestos e Movimentos"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/90 via-[#003876]/40 to-transparent" />
              <div className="absolute bottom-0 p-6 text-white">
                <h3 className="font-display text-xl font-bold mb-2">Corpo, Gestos e Movimentos</h3>
                <p className="text-sm text-white/85 leading-relaxed">
                  Expressão corporal e desenvolvimento motor
                </p>
              </div>
            </div>

            <div
              className="img-zoom rounded-2xl overflow-hidden relative h-80"
              data-reveal="up"
              style={{ '--delay': '0.25s' } as React.CSSProperties}
            >
              <img
                src="https://images.unsplash.com/photo-1555619662-99b91fcec542?auto=format&fit=crop&q=80&w=1000"
                alt="Traços, Sons, Cores e Formas"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/90 via-[#003876]/40 to-transparent" />
              <div className="absolute bottom-0 p-6 text-white">
                <h3 className="font-display text-xl font-bold mb-2">Traços, Sons, Cores e Formas</h3>
                <p className="text-sm text-white/85 leading-relaxed">
                  Desenvolvimento artístico e sensorial
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Atividades Diárias ─── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6" ref={atividadesRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Rotina
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Atividades Diárias
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div
              className="bg-[var(--surface)] rounded-2xl p-7 border border-gray-100 hover:border-[#ffd700]/40 hover:shadow-lg transition-all duration-300 gold-line-hover"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <div className="w-12 h-12 bg-[#003876]/10 rounded-xl flex items-center justify-center mb-5">
                <Music className="w-6 h-6 text-[#003876]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[#003876] mb-2">Musicalização</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Desenvolvimento da sensibilidade musical e expressão corporal
              </p>
            </div>

            <div
              className="bg-[var(--surface)] rounded-2xl p-7 border border-gray-100 hover:border-[#ffd700]/40 hover:shadow-lg transition-all duration-300 gold-line-hover"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <div className="w-12 h-12 bg-[#003876]/10 rounded-xl flex items-center justify-center mb-5">
                <Book className="w-6 h-6 text-[#003876]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[#003876] mb-2">Contação de Histórias</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Estímulo à imaginação e desenvolvimento da linguagem
              </p>
            </div>

            <div
              className="bg-[var(--surface)] rounded-2xl p-7 border border-gray-100 hover:border-[#ffd700]/40 hover:shadow-lg transition-all duration-300 gold-line-hover"
              data-reveal="up"
              style={{ '--delay': '0.25s' } as React.CSSProperties}
            >
              <div className="w-12 h-12 bg-[#003876]/10 rounded-xl flex items-center justify-center mb-5">
                <Palette className="w-6 h-6 text-[#003876]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[#003876] mb-2">Artes</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Exploração de diferentes materiais e técnicas artísticas
              </p>
            </div>

            <div
              className="bg-[var(--surface)] rounded-2xl p-7 border border-gray-100 hover:border-[#ffd700]/40 hover:shadow-lg transition-all duration-300 gold-line-hover"
              data-reveal="up"
              style={{ '--delay': '0.35s' } as React.CSSProperties}
            >
              <div className="w-12 h-12 bg-[#003876]/10 rounded-xl flex items-center justify-center mb-5">
                <Puzzle className="w-6 h-6 text-[#003876]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[#003876] mb-2">Jogos Pedagógicos</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Desenvolvimento do raciocínio lógico e coordenação motora
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Depoimentos ─── */}
      <section className="py-24 bg-[#003876] grain-overlay relative">
        <div className="container mx-auto px-6" ref={depoimentosRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Comunidade
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
              O que Dizem os Pais
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div
              className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-8"
              data-reveal="up"
              style={{ '--delay': '0.05s' } as React.CSSProperties}
            >
              <p className="text-[#ffd700] text-5xl font-display font-bold leading-none mb-4">"</p>
              <p className="text-white/75 italic text-sm leading-relaxed mb-6">
                Ver o desenvolvimento da minha filha no Colégio Batista é gratificante.
                A dedicação dos professores e o ambiente acolhedor fazem toda diferença.
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <img
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100"
                  alt="Ana Paula Silva"
                  className="rounded-full w-12 h-12 object-cover"
                />
                <div>
                  <p className="text-white font-semibold text-sm">Ana Paula Silva</p>
                  <p className="text-white/50 text-xs">Mãe da Maria Clara</p>
                </div>
              </div>
            </div>

            <div
              className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-8"
              data-reveal="up"
              style={{ '--delay': '0.15s' } as React.CSSProperties}
            >
              <p className="text-[#ffd700] text-5xl font-display font-bold leading-none mb-4">"</p>
              <p className="text-white/75 italic text-sm leading-relaxed mb-6">
                A metodologia de ensino é excelente. Meu filho desenvolveu autonomia
                e amor pelo aprendizado de uma forma natural e divertida.
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100"
                  alt="Carlos Eduardo"
                  className="rounded-full w-12 h-12 object-cover"
                />
                <div>
                  <p className="text-white font-semibold text-sm">Carlos Eduardo</p>
                  <p className="text-white/50 text-xs">Pai do Pedro</p>
                </div>
              </div>
            </div>

            <div
              className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-8"
              data-reveal="up"
              style={{ '--delay': '0.25s' } as React.CSSProperties}
            >
              <p className="text-[#ffd700] text-5xl font-display font-bold leading-none mb-4">"</p>
              <p className="text-white/75 italic text-sm leading-relaxed mb-6">
                Os valores cristãos aliados à educação de qualidade foram decisivos
                na nossa escolha. Hoje vemos que fizemos a escolha certa.
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <img
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100"
                  alt="Juliana Santos"
                  className="rounded-full w-12 h-12 object-cover"
                />
                <div>
                  <p className="text-white font-semibold text-sm">Juliana Santos</p>
                  <p className="text-white/50 text-xs">Mãe do Lucas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 bg-[var(--surface)]">
        <div className="container mx-auto px-6" ref={ctaRef}>
          <div className="text-center max-w-2xl mx-auto">
            <div data-reveal="up">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
                Próximo passo
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876] mb-4">
                Venha Conhecer Nossa Escola
              </h2>
              <div className="section-divider mx-auto mt-6 mb-6" />
              <p className="text-gray-600 leading-relaxed mb-10">
                Agende uma visita e conheça de perto nossa proposta pedagógica e estrutura completa.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  to="/contato"
                  className="inline-flex items-center px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-bold hover:bg-[#ffe44d] transition-all duration-300 transform hover:scale-105 shadow-md"
                >
                  Agende uma Visita
                </Link>
                <Link
                  to="/matricula"
                  className="inline-flex items-center px-8 py-4 border-2 border-[#003876] text-[#003876] rounded-full font-semibold hover:bg-[#003876] hover:text-white transition-all duration-300"
                >
                  Fazer Matrícula
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
