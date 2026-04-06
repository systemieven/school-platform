import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Heart,
  Lightbulb,
  Trophy,
  Building,
  Palette,
  HeartHandshake,
  ChevronRight,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const SEGMENTS = [
  {
    to: '/educacao-infantil',
    img: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=1000',
    title: 'Educação Infantil',
    desc: 'Desenvolvimento integral da criança',
    ages: '2 a 5 anos',
  },
  {
    to: '/ensino-fundamental-1',
    img: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000',
    title: 'Fundamental I',
    desc: 'Base sólida para o futuro',
    ages: '1º ao 5º ano',
  },
  {
    to: '/ensino-fundamental-2',
    img: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=1000',
    title: 'Fundamental II',
    desc: 'Desenvolvimento do pensamento crítico',
    ages: '6º ao 9º ano',
  },
  {
    to: '/ensino-medio',
    img: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1000',
    title: 'Ensino Médio',
    desc: 'Preparação para o futuro',
    ages: '1ª a 3ª série',
  },
];

const FEATURES = [
  {
    icon: GraduationCap,
    title: 'Excelência Acadêmica',
    desc: 'Educação de qualidade com resultados comprovados em vestibulares e ENEM',
    stat: '95%',
    statLabel: 'aprovação em vestibulares',
  },
  {
    icon: Heart,
    title: 'Valores Cristãos',
    desc: 'Formação integral baseada em princípios éticos e morais',
    stat: '50+',
    statLabel: 'anos de tradição',
  },
  {
    icon: Lightbulb,
    title: 'Metodologia Inovadora',
    desc: 'Aprendizagem ativa com tecnologia integrada ao ensino',
    stat: '100%',
    statLabel: 'laboratórios modernos',
  },
  {
    icon: Trophy,
    title: 'Tradição e Qualidade',
    desc: 'Mais de 50 anos de história na educação de Caruaru',
    stat: '750+',
    statLabel: 'média ENEM',
  },
];

const INFRASTRUCTURE = [
  {
    icon: Building,
    title: 'Infraestrutura Completa',
    items: ['Salas climatizadas', 'Quadra poliesportiva', 'Biblioteca moderna'],
  },
  {
    icon: Palette,
    title: 'Atividades Extras',
    items: ['Robótica educacional', 'Práticas esportivas', 'Clube de ciências'],
  },
  {
    icon: HeartHandshake,
    title: 'Acompanhamento Individual',
    items: ['Orientação pedagógica', 'Suporte psicológico', 'Reforço escolar'],
  },
];

export default function Home() {
  const segmentsRef = useScrollReveal();
  const featuresRef = useScrollReveal();
  const infraRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative h-screen min-h-[600px] overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="hero-video w-full h-full object-cover"
          >
            <source
              src="https://s3.ibotcloud.com.br/colegiobatista/imagens/site/video-inicio.mp4"
              type="video/mp4"
            />
          </video>
          <div className="absolute inset-0 bg-gradient-to-br from-[#003876]/95 via-[#003876]/80 to-[#002855]/70" />
        </div>

        {/* Decorative diagonal slice */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[var(--surface)] [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

        {/* Content */}
        <div className="relative z-[5] container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="hero-badge inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-[#ffd700] rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-medium tracking-wide">
                Matrículas 2026 abertas
              </span>
            </div>

            <h1 className="hero-text-1 font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] mb-6 tracking-tight">
              Educação que{' '}
              <span className="italic text-[#ffd700]">Transforma</span>
              <br />
              Vidas
            </h1>

            {/* Gold accent line */}
            <div className="hero-accent-line h-[3px] bg-gradient-to-r from-[#ffd700] to-[#ffe44d] rounded-full mb-8" />

            <p className="hero-text-2 text-lg md:text-xl text-white/85 max-w-xl leading-relaxed mb-10">
              Há mais de 50 anos formando cidadãos com excelência acadêmica
              e valores cristãos em Caruaru.
            </p>

            <div className="hero-text-3 flex flex-wrap gap-4">
              <Link
                to="/sobre"
                className="group inline-flex items-center gap-3 bg-[#ffd700] text-[#003876] px-8 py-4 rounded-full font-semibold transition-all duration-500 hover:bg-white hover:shadow-[0_0_40px_rgba(255,215,0,0.4)] active:scale-95"
              >
                Conheça Nossa Escola
                <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/sobre"
                className="group inline-flex items-center gap-3 border-2 border-white/60 text-white px-8 py-4 rounded-full font-semibold transition-all duration-500 hover:bg-white hover:text-[#003876] hover:border-white hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-95"
              >
                Agende uma Visita
              </Link>
            </div>

            {/* Stats row */}
            <div className="hero-text-4 flex flex-wrap gap-8 mt-14 pt-8 border-t border-white/15">
              {[
                { value: '50+', label: 'Anos de história' },
                { value: '95%', label: 'Aprovação vestibular' },
                { value: '750+', label: 'Média ENEM' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-3xl md:text-4xl font-display font-bold text-[#ffd700]">
                    {s.value}
                  </p>
                  <p className="text-sm text-white/60 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Segments ── */}
      <section className="relative py-24 bg-[var(--surface)] grain-overlay">
        <div ref={segmentsRef} className="relative z-[2] container mx-auto px-4">
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Nossos Segmentos
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Uma jornada completa
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SEGMENTS.map((seg, i) => (
              <Link
                key={seg.to}
                to={seg.to}
                className="card-3d group"
                data-reveal="up"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                <div className="card-3d-inner bg-white rounded-2xl overflow-hidden">
                  <div className="img-zoom relative h-52">
                    <img
                      src={seg.img}
                      alt={seg.title}
                      className="w-full h-full object-cover"
                    />
                    {/* Gold overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#003876]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    {/* Age badge */}
                    <span className="absolute top-4 right-4 bg-[#ffd700] text-[#003876] text-xs font-bold px-3 py-1 rounded-full shadow-md">
                      {seg.ages}
                    </span>
                  </div>
                  <div className="p-6 gold-line-hover">
                    <h3 className="text-lg font-bold text-[#003876] mb-1 group-hover:text-[#002855] transition-colors">
                      {seg.title}
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {seg.desc}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[#ffd700] text-sm font-semibold mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-8px] group-hover:translate-x-0">
                      Saiba mais <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features / Por que escolher ── */}
      <section className="py-24 bg-white relative overflow-hidden">
        {/* Decorative background circle */}
        <div className="absolute -right-40 -top-40 w-[500px] h-[500px] rounded-full bg-[#003876]/[0.02]" />

        <div ref={featuresRef} className="relative container mx-auto px-4">
          <div className="text-center mb-16" data-reveal="up">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#ffd700] mb-3">
              Diferenciais
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#003876]">
              Por que escolher o{' '}
              <span className="italic">Colégio Batista?</span>
            </h2>
            <div className="section-divider mx-auto mt-6" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {FEATURES.map((feat, i) => (
              <div
                key={feat.title}
                className="group relative bg-[var(--surface)] rounded-2xl p-8 transition-all duration-500 hover:bg-[#003876] hover:shadow-[0_20px_60px_-15px_rgba(0,56,118,0.3)]"
                data-reveal="up"
                style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
              >
                {/* Stat */}
                <p className="font-display text-5xl font-bold text-[#003876]/10 group-hover:text-white/15 transition-colors duration-500 absolute top-4 right-6">
                  {feat.stat}
                </p>

                {/* Icon */}
                <div className="w-14 h-14 bg-[#003876] group-hover:bg-[#ffd700] rounded-xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                  <feat.icon className="w-7 h-7 text-white group-hover:text-[#003876] transition-colors duration-500" />
                </div>

                <h3 className="text-lg font-bold text-[#003876] group-hover:text-white mb-3 transition-colors duration-500">
                  {feat.title}
                </h3>
                <p className="text-gray-500 group-hover:text-white/70 text-sm leading-relaxed mb-4 transition-colors duration-500">
                  {feat.desc}
                </p>
                <p className="text-xs font-semibold text-[#ffd700] tracking-wide uppercase">
                  {feat.statLabel}
                </p>
              </div>
            ))}
          </div>

          {/* ── Infrastructure Grid ── */}
          <div ref={infraRef} className="grid md:grid-cols-3 gap-8">
            {INFRASTRUCTURE.map((box, i) => (
              <div
                key={box.title}
                className="group relative bg-[var(--surface)] rounded-2xl p-8 border border-transparent hover:border-[#ffd700]/30 transition-all duration-500 hover:shadow-lg"
                data-reveal="up"
                style={{ '--delay': `${i * 0.12}s` } as React.CSSProperties}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#003876] rounded-xl flex items-center justify-center group-hover:rotate-3 transition-transform duration-500">
                    <box.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-[#003876]">
                    {box.title}
                  </h3>
                </div>
                <ul className="space-y-3">
                  {box.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-gray-600 text-sm"
                    >
                      <CheckCircle className="w-4 h-4 text-[#ffd700] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Band ── */}
      <section className="relative py-20 bg-[#003876] overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[#ffd700]" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-white" />
        </div>

        <div ref={ctaRef} className="relative container mx-auto px-4 text-center" data-reveal="scale">
          <p className="text-[#ffd700] text-sm font-semibold tracking-[0.2em] uppercase mb-4">
            Matrícula 2026
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Comece a transformação <span className="italic">agora</span>
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
            Garanta a vaga do seu filho em uma das melhores escolas de Caruaru.
            Venha conhecer nossa estrutura e metodologia.
          </p>
          <Link
            to="/matricula"
            className="group inline-flex items-center gap-3 bg-[#ffd700] text-[#003876] px-10 py-5 rounded-full font-bold text-lg transition-all duration-500 hover:bg-white hover:shadow-[0_0_60px_rgba(255,215,0,0.4)] active:scale-95"
          >
            Faça sua matrícula
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </>
  );
}
