import React from 'react';
import { Heart, Brain, Users, Star, CheckCircle, Award, Lightbulb, Palette, Music, Book, Puzzle, Plane as Plant } from 'lucide-react';

const EducacaoInfantil = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[70vh]">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=2070"
            alt="Crianças brincando e aprendendo" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/90 to-[#003876]/70"></div>
        </div>
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-2xl text-white">
            <h1 className="text-5xl font-bold mb-6">Educação Infantil</h1>
            <p className="text-xl mb-8">
              Um ambiente acolhedor e estimulante para o desenvolvimento integral do seu filho.
              Aqui, cada criança é única e especial.
            </p>
            <a 
              href="/matricula" 
              className="inline-flex items-center px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-semibold hover:bg-white transition-all duration-300 transform hover:scale-105"
            >
              Agende uma Visita
              <i data-lucide="chevron-right" className="ml-2 w-5 h-5"></i>
            </a>
          </div>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#003876] mb-6">
              Educação que Encanta e Transforma
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Na Educação Infantil do Colégio Batista, acreditamos que os primeiros anos são fundamentais 
              para o desenvolvimento integral da criança. Nossa proposta pedagógica combina aprendizagem, 
              afetividade e valores cristãos, criando um ambiente onde cada criança pode desenvolver 
              seu potencial único.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-[#003876] mb-2">25+</div>
                <p className="text-gray-600">Anos de experiência</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#003876] mb-2">15</div>
                <p className="text-gray-600">Alunos por turma</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#003876] mb-2">100%</div>
                <p className="text-gray-600">Professores especializados</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Pilares da Nossa Educação Infantil
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-4">Afetividade</h3>
              <p className="text-gray-600 text-center">
                Construímos vínculos afetivos que proporcionam segurança e confiança para o desenvolvimento.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-4">Cognição</h3>
              <p className="text-gray-600 text-center">
                Estimulamos a curiosidade e o pensamento crítico através de experiências significativas.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-4">Socialização</h3>
              <p className="text-gray-600 text-center">
                Desenvolvemos habilidades sociais e emocionais através da interação e cooperação.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-6">
                <Plant className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-4">Valores</h3>
              <p className="text-gray-600 text-center">
                Cultivamos valores cristãos e éticos que formam o caráter e a cidadania.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Learning Areas */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Campos de Experiências
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative group overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000"
                alt="Linguagem e expressão" 
                className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876] to-transparent opacity-90">
                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="text-xl font-semibold mb-2">O Eu, o Outro e o Nós</h3>
                  <p className="text-sm opacity-90">
                    Desenvolvimento da identidade e das relações sociais
                  </p>
                </div>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&q=80&w=1000"
                alt="Corpo e movimento" 
                className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876] to-transparent opacity-90">
                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="text-xl font-semibold mb-2">Corpo, Gestos e Movimentos</h3>
                  <p className="text-sm opacity-90">
                    Expressão corporal e desenvolvimento motor
                  </p>
                </div>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1555619662-99b91fcec542?auto=format&fit=crop&q=80&w=1000"
                alt="Traços, sons e cores" 
                className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876] to-transparent opacity-90">
                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="text-xl font-semibold mb-2">Traços, Sons, Cores e Formas</h3>
                  <p className="text-sm opacity-90">
                    Desenvolvimento artístico e sensorial
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Activities */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Atividades Diárias
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-[#003876] mb-4">
                <Music className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Musicalização</h3>
              <p className="text-gray-600 text-sm">
                Desenvolvimento da sensibilidade musical e expressão corporal
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-[#003876] mb-4">
                <Book className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Contação de Histórias</h3>
              <p className="text-gray-600 text-sm">
                Estímulo à imaginação e desenvolvimento da linguagem
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-[#003876] mb-4">
                <Palette className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Artes</h3>
              <p className="text-gray-600 text-sm">
                Exploração de diferentes materiais e técnicas artísticas
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="text-[#003876] mb-4">
                <Puzzle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Jogos Pedagógicos</h3>
              <p className="text-gray-600 text-sm">
                Desenvolvimento do raciocínio lógico e coordenação motora
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            O que Dizem os Pais
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="flex items-center mb-4">
                <img 
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100"
                  alt="Foto do depoimento"
                  className="w-12 h-12 rounded-full object-cover mr-4"
                />
                <div>
                  <h4 className="font-semibold">Ana Paula Silva</h4>
                  <p className="text-sm text-gray-600">Mãe da Maria Clara</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "Ver o desenvolvimento da minha filha no Colégio Batista é gratificante. 
                A dedicação dos professores e o ambiente acolhedor fazem toda diferença."
              </p>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="flex items-center mb-4">
                <img 
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100"
                  alt="Foto do depoimento"
                  className="w-12 h-12 rounded-full object-cover mr-4"
                />
                <div>
                  <h4 className="font-semibold">Carlos Eduardo</h4>
                  <p className="text-sm text-gray-600">Pai do Pedro</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "A metodologia de ensino é excelente. Meu filho desenvolveu autonomia 
                e amor pelo aprendizado de uma forma natural e divertida."
              </p>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="flex items-center mb-4">
                <img 
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100"
                  alt="Foto do depoimento"
                  className="w-12 h-12 rounded-full object-cover mr-4"
                />
                <div>
                  <h4 className="font-semibold">Juliana Santos</h4>
                  <p className="text-sm text-gray-600">Mãe do Lucas</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "Os valores cristãos aliados à educação de qualidade foram decisivos 
                na nossa escolha. Hoje vemos que fizemos a escolha certa."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#003876]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-8">
            Venha Conhecer Nossa Escola
          </h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Agende uma visita e conheça de perto nossa proposta pedagógica e estrutura completa.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/matricula" 
              className="inline-flex items-center px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-semibold hover:bg-white transition-all duration-300 transform hover:scale-105"
            >
              Agende uma Visita
              <i data-lucide="chevron-right" className="ml-2 w-5 h-5"></i>
            </a>
            <a 
              href="tel:+558137214787"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-white rounded-full font-semibold hover:bg-white hover:text-[#003876] transition-all duration-300"
            >
              Fale Conosco
              <i data-lucide="phone" className="ml-2 w-5 h-5"></i>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EducacaoInfantil;