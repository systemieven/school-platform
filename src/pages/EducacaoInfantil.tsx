import { Link } from 'react-router-dom';
import { Heart, Brain, Users, Plane as Plant, Music, Book, Palette, Puzzle, ArrowRight } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const PILLARS = [
  {
    icon: Heart,
    title: 'Afetividade',
    desc: 'Construímos vínculos afetivos que proporcionam segurança e confiança para o desenvolvimento.',
    stat: '100%',
    statLabel: 'ambiente acolhedor',
  },
  {
    icon: Brain,
    title: 'Cognição',
    desc: 'Estimulamos a curiosidade e o pensamento crítico através de experiências significativas.',
    stat: '~20',
    statLabel: 'alunos por turma',
  },
  {
    icon: Users,
    title: 'Socialização',
    desc: 'Desenvolvemos habilidades sociais e emocionais através da interação e cooperação.',
    stat: '20+',
    statLabel: 'anos de experiência',
  },
  {
    icon: Plant,
    title: 'Valores',
    desc: 'Cultivamos valores cristãos e éticos que formam o caráter e a cidadania.',
    stat: '100%',
    statLabel: 'professores qualificados',
  },
];

const ATIVIDADES = [
  { icon: Music,   title: 'Musicalização',       desc: 'Desenvolvimento da sensibilidade musical e expressão corporal' },
  { icon: Book,    title: 'Contação de Histórias', desc: 'Estímulo à imaginação e desenvolvimento da linguagem' },
  { icon: Palette, title: 'Artes',               desc: 'Exploração de diferentes materiais e técnicas artísticas' },
  { icon: Puzzle,  title: 'Jogos Pedagógicos',   desc: 'Desenvolvimento do raciocínio lógico e coordenação motora' },
];

const CAMPOS = [
  {
    img: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000',
    title: 'O Eu, o Outro e o Nós',
    desc: 'Desenvolvimento da identidade e das relações sociais',
  },
  {
    img: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&q=80&w=1000',
    title: 'Corpo, Gestos e Movimentos',
    desc: 'Expressão corporal e desenvolvimento motor',
  },
  {
    img: 'https://images.unsplash.com/photo-1555619662-99b91fcec542?auto=format&fit=crop&q=80&w=1000',
    title: 'Traços, Sons, Cores e Formas',
    desc: 'Desenvolvimento artístico e sensorial',
  },
];

export default function EducacaoInfantil() {
  const pillarsRef    = useScrollReveal();
  const camposRef     = useScrollReveal();
  const atividadesRef = useScrollReveal();
  const depoimentosRef = useScrollReveal();
  const ctaRef        = useScrollReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative h-[80vh] min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=2070"
            alt="Crianças brincando e aprendendo"
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
                Educação Infantil · 2 a 5 anos
              </span>
            </div>

            <h1 className="hero-text-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              Educação que{' '}
              <span className="italic text-[#ffd700]">Encanta</span>
              <br />e Transforma
            </h1>

            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-[#ffd700] to-[#ffe44d] rounded-full mb-8" />

            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed mb-10">
              Um ambiente acolhedor e estimulante para o desenvolvimento integral
              do seu filho. Aqui, cada criança é única e especial.
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
                { value: '20+',  label: 'Anos de experiência' },
                { value: '~20',  label: 'Alunos por turma' },
                { value: '100%', label: 'Prof. qualificados' },
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
      <section className="py-24 bg-[var(--surface)] grain-overlay relative overflow-hidden">
        <div className="absolute -right-40 -top-40 w-[500px] h-[500px] rounded-full bg-[#003876]/[0.02]" />
        <div className="relative container mx-auto px-4" ref={pillarsRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Nossa proposta
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Pilares da{' '}
              <span className="italic">Educação Infantil</span>
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

      {/* ── Campos de Experiências ── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4" ref={camposRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Currículo
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Campos de <span className="italic">Experiências</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {CAMPOS.map((c, i) => (
              <div
                key={c.title}
                className="img-zoom rounded-2xl overflow-hidden relative h-80"
                data-reveal="up"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                <img src={c.img} alt={c.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/90 via-[#003876]/40 to-transparent" />
                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="font-display text-xl font-bold mb-2">{c.title}</h3>
                  <p className="text-sm text-white/85 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Atividades Diárias ── */}
      <section className="py-24 bg-[var(--surface)]">
        <div className="container mx-auto px-4" ref={atividadesRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Rotina
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Atividades <span className="italic">Diárias</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ATIVIDADES.map((a, i) => (
              <div
                key={a.title}
                className="group bg-white rounded-2xl p-7 border border-gray-100 hover:border-[#ffd700]/40 hover:shadow-lg transition-all duration-300 gold-line-hover"
                data-reveal="up"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                <div className="w-12 h-12 bg-[#003876]/10 group-hover:bg-[#003876] rounded-xl flex items-center justify-center mb-5 transition-colors duration-300">
                  <a.icon className="w-6 h-6 text-[#003876] group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="font-display text-lg font-bold text-[#003876] mb-2">{a.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Depoimentos ── */}
      <section className="py-24 bg-[#003876] grain-overlay relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-[#ffd700]" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-white" />
        </div>
        <div className="relative container mx-auto px-4" ref={depoimentosRef}>
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Comunidade
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
              O que Dizem <span className="italic">os Pais</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: 'Ver o desenvolvimento da minha filha no Colégio Batista é gratificante. A dedicação dos professores e o ambiente acolhedor fazem toda diferença.', name: 'Ana Paula Silva', role: 'Mãe da Maria Clara', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100' },
              { quote: 'A metodologia de ensino é excelente. Meu filho desenvolveu autonomia e amor pelo aprendizado de uma forma natural e divertida.', name: 'Carlos Eduardo', role: 'Pai do Pedro', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100' },
              { quote: 'Os valores cristãos aliados à educação de qualidade foram decisivos na nossa escolha. Hoje vemos que fizemos a escolha certa.', name: 'Juliana Santos', role: 'Mãe do Lucas', img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100' },
            ].map((t, i) => (
              <div
                key={t.name}
                className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-8"
                data-reveal="up"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                <p className="text-[#ffd700] text-5xl font-display font-bold leading-none mb-4">"</p>
                <p className="text-white/75 italic text-sm leading-relaxed mb-6">{t.quote}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <img src={t.img} alt={t.name} className="rounded-full w-12 h-12 object-cover" />
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-white/50 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-20 bg-[var(--surface)] overflow-hidden">
        <div ref={ctaRef} className="relative container mx-auto px-4 text-center" data-reveal="scale">
          <p className="text-[#ffd700] text-sm font-semibold tracking-[0.2em] uppercase mb-4">
            Próximo passo
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876] mb-6">
            Venha Conhecer <span className="italic">Nossa Escola</span>
          </h2>
          <div className="section-divider mx-auto mb-8" />
          <p className="text-gray-600 max-w-xl mx-auto mb-10 leading-relaxed">
            Agende uma visita e conheça de perto nossa proposta pedagógica e estrutura completa.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/contato"
              className="group inline-flex items-center gap-3 bg-[#ffd700] text-[#003876] px-10 py-5 rounded-full font-bold text-lg transition-all duration-500 hover:bg-[#003876] hover:text-white hover:shadow-[0_0_60px_rgba(0,56,118,0.3)] active:scale-95"
            >
              Agende uma Visita
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/matricula"
              className="inline-flex items-center gap-3 border-2 border-[#003876] text-[#003876] px-10 py-5 rounded-full font-bold text-lg transition-all duration-500 hover:bg-[#003876] hover:text-white active:scale-95"
            >
              Fazer Matrícula
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
