import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative h-[80vh]">
        <div className="absolute inset-0 overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover scale-105 blur-sm"
          >
            <source src="https://s3.ibotcloud.com.br/colegiobatista/imagens/site/video-inicio.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/90 to-[#003876]/70"></div>
        </div>
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-2xl text-white">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in">
              Educação que<br />Transforma Vidas
            </h1>
            <p className="text-lg md:text-xl mb-8 animate-fade-in-delay">
              Há mais de 50 anos formando cidadãos com excelência acadêmica e valores cristãos.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#sobre" className="btn-hero">
                Conheça Nossa Escola
              </a>
              <a href="#contato" className="btn-hero-outline">
                Agende uma Visita
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Educational Segments */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-[#003876] mb-12">
            Nossos Segmentos
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                to: '/educacao-infantil',
                img: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=1000',
                title: 'Educação Infantil',
                desc: 'Desenvolvimento integral da criança',
              },
              {
                to: '/ensino-fundamental-1',
                img: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000',
                title: 'Fundamental I',
                desc: 'Base sólida para o futuro',
              },
              {
                to: '/ensino-fundamental-2',
                img: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=1000',
                title: 'Fundamental II',
                desc: 'Desenvolvimento do pensamento crítico',
              },
              {
                to: '/ensino-medio',
                img: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1000',
                title: 'Ensino Médio',
                desc: 'Preparação para o futuro',
              },
            ].map((seg) => (
              <Link key={seg.to} to={seg.to} className="segment-card">
                <img src={seg.img} alt={seg.title} className="w-full h-48 object-cover" />
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{seg.title}</h3>
                  <p className="text-gray-600">{seg.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16 text-[#003876]">
            Por que escolher o Colégio Batista?
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {[
              { title: 'Excelência Acadêmica', desc: 'Educação de qualidade com resultados comprovados em vestibulares e ENEM', stat: '95% de aprovação em vestibulares' },
              { title: 'Valores Cristãos', desc: 'Formação integral baseada em princípios éticos e morais', stat: 'Desenvolvimento do caráter' },
              { title: 'Metodologia Inovadora', desc: 'Aprendizagem ativa com tecnologia integrada ao ensino', stat: 'Laboratórios modernos' },
              { title: 'Tradição e Qualidade', desc: 'Mais de 50 anos de história na educação de Caruaru', stat: 'Referência em educação' },
            ].map((feat) => (
              <div key={feat.title} className="feature-card group">
                <div className="feature-icon group-hover:bg-[#ffd700] group-hover:rotate-12 transition-all duration-500">
                  <span className="h-8 w-8 text-white group-hover:text-[#003876]" />
                </div>
                <h3 className="text-xl font-semibold mb-4">{feat.title}</h3>
                <p className="text-gray-600 mb-4">{feat.desc}</p>
                <p className="text-sm text-[#003876] font-medium">{feat.stat}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Infraestrutura Completa',
                items: ['Salas climatizadas', 'Quadra poliesportiva', 'Biblioteca moderna'],
              },
              {
                title: 'Atividades Extras',
                items: ['Robótica educacional', 'Práticas esportivas', 'Clube de ciências'],
              },
              {
                title: 'Acompanhamento Individual',
                items: ['Orientação pedagógica', 'Suporte psicológico', 'Reforço escolar'],
              },
            ].map((box) => (
              <div key={box.title} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <h3 className="text-lg font-semibold mb-4">{box.title}</h3>
                <ul className="space-y-2">
                  {box.items.map((item) => (
                    <li key={item} className="flex items-center text-gray-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link
              to="/matricula"
              className="inline-flex items-center px-8 py-4 bg-[#003876] text-white rounded-full font-semibold hover:bg-[#002855] transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
            >
              Faça sua matrícula
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
