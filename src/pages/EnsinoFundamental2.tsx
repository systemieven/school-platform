import React from 'react';
import { BookOpen, Target, Users, Star, CheckCircle, Award, Lightbulb, Clock, Brain, Rocket } from 'lucide-react';

const EnsinoFundamental2 = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[60vh]">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=2070"
            alt="Estudantes em laboratório" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/90 to-[#003876]/70"></div>
        </div>
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-2xl text-white">
            <h1 className="text-5xl font-bold mb-6">Ensino Fundamental II</h1>
            <p className="text-xl mb-8">
              Preparando jovens para os desafios do futuro com excelência acadêmica e valores sólidos.
            </p>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold text-[#003876] mb-6">
              Formação Completa para o Futuro
            </h2>
            <p className="text-gray-600 text-lg">
              No Ensino Fundamental II, desenvolvemos competências essenciais 
              através de uma metodologia inovadora que prepara os alunos para 
              os desafios do Ensino Médio e da vida.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 mt-12">
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Pensamento Crítico</h3>
              <p className="text-gray-600">
                Desenvolvimento do raciocínio lógico e análise crítica.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Rocket className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Inovação</h3>
              <p className="text-gray-600">
                Tecnologia integrada ao processo de aprendizagem.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Protagonismo</h3>
              <p className="text-gray-600">
                Desenvolvimento da autonomia e liderança.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Preparação</h3>
              <p className="text-gray-600">
                Base sólida para o Ensino Médio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Program */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Programa Acadêmico
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <Star className="h-10 w-10 text-[#ffd700] mb-4" />
              <h3 className="text-xl font-semibold mb-4">Base Curricular</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Português e Literatura</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Matemática</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Ciências</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>História e Geografia</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <Award className="h-10 w-10 text-[#ffd700] mb-4" />
              <h3 className="text-xl font-semibold mb-4">Disciplinas Complementares</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Inglês Avançado</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Educação Tecnológica</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Iniciação Científica</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Educação Física</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <Lightbulb className="h-10 w-10 text-[#ffd700] mb-4" />
              <h3 className="text-xl font-semibold mb-4">Projetos Especiais</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Feira de Ciências</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Olimp iadas do Conhecimento</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Projetos Interdisciplinares</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Clube de Robótica</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Activities Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Atividades Extracurriculares
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative group overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1000"
                alt="Atividade de laboratório" 
                className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876] to-transparent opacity-90 transition-opacity duration-300">
                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="text-xl font-semibold mb-2">Laboratório de Ciências</h3>
                  <p className="text-sm opacity-90">
                    Experimentos práticos e descobertas científicas
                  </p>
                </div>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000"
                alt="Atividade esportiva" 
                className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876] to-transparent opacity-90 transition-opacity duration-300">
                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="text-xl font-semibold mb-2">Práticas Esportivas</h3>
                  <p className="text-sm opacity-90">
                    Desenvolvimento físico e trabalho em equipe
                  </p>
                </div>
              </div>
            </div>

            <div className="relative group overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=1000"
                alt="Atividade tecnológica" 
                className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003876] to-transparent opacity-90 transition-opacity duration-300">
                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="text-xl font-semibold mb-2">Tecnologia e Inovação</h3>
                  <p className="text-sm opacity-90">
                    Programação, robótica e pensamento computacional
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Horários
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <Clock className="h-8 w-8 text-[#003876] mr-3" />
                <h3 className="text-xl font-semibold">Turno Matutino</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-center justify-between">
                  <span className="font-medium">Entrada</span>
                  <span>7h00</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-medium">Intervalo</span>
                  <span>9h30 - 9h50</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-medium">Saída</span>
                  <span>12h30</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <Clock className="h-8 w-8 text-[#003876] mr-3" />
                <h3 className="text-xl font-semibold">Turno Vespertino</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-center justify-between">
                  <span className="font-medium">Entrada</span>
                  <span>13h00</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-medium">Intervalo</span>
                  <span>15h30 - 15h50</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-medium">Saída</span>
                  <span>18h30</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#003876]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-8">
            Faça parte do nosso time de vencedores
          </h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Prepare seu filho para os desafios do futuro com uma educação de qualidade.
          </p>
          <a 
            href="/matricula" 
            className="inline-flex items-center px-8 py-4 bg-[#ffd700] text-[#003876] rounded-full font-semibold hover:bg-white transition-all duration-300 transform hover:scale-105"
          >
            Agende uma Visita
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
};

export default EnsinoFundamental2;