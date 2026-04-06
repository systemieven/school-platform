import React from 'react';
import { BookOpen, Target, Users, Star, CheckCircle, Award, Lightbulb, Clock, Brain, Rocket, Trophy } from 'lucide-react';

const EnsinoMedio = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[60vh]">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070"
            alt="Estudantes em laboratório avançado" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/90 to-[#003876]/70"></div>
        </div>
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-2xl text-white">
            <h1 className="text-5xl font-bold mb-6">Ensino Médio</h1>
            <p className="text-xl mb-8">
              Excelência acadêmica e preparação completa para o sucesso no ENEM e vestibulares.
            </p>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold text-[#003876] mb-6">
              Preparação Completa para o Futuro
            </h2>
            <p className="text-gray-600 text-lg">
              No Ensino Médio, oferecemos uma formação completa que alia excelência 
              acadêmica, preparação para vestibulares e desenvolvimento de habilidades 
              essenciais para a vida universitária e profissional.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 mt-12">
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Excelência</h3>
              <p className="text-gray-600">
                Alto índice de aprovação em vestibulares.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Metodologia</h3>
              <p className="text-gray-600">
                Aprendizagem ativa e personalizada.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Foco</h3>
              <p className="text-gray-600">
                Preparação específica para ENEM.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Mentoria</h3>
              <p className="text-gray-600">
                Orientação vocacional e acadêmica.
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
                  <span>Linguagens e suas Tecnologias</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Matemática e suas Tecnologias</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Ciências da Natureza</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Ciências Humanas</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <Award className="h-10 w-10 text-[#ffd700] mb-4" />
              <h3 className="text-xl font-semibold mb-4">Preparação ENEM</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Simulados periódicos</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Resolução de questões</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Redação semanal</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Monitorias extras</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <Rocket className="h-10 w-10 text-[#ffd700] mb-4" />
              <h3 className="text-xl font-semibold mb-4">Diferenciais</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Orientação vocacional</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Mentoria acadêmica</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Projetos de pesquisa</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Laboratórios avançados</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Resultados que Impressionam
          </h2>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <div className="text-4xl font-bold text-[#003876] mb-2">95%</div>
              <p className="text-gray-600">Aprovação em vestibulares</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <div className="text-4xl font-bold text-[#003876] mb-2">750+</div>
              <p className="text-gray-600">Média no ENEM</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <div className="text-4xl font-bold text-[#003876] mb-2">100+</div>
              <p className="text-gray-600">Aprovações em federais</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <div className="text-4xl font-bold text-[#003876] mb-2">50+</div>
              <p className="text-gray-600">Anos de tradição</p>
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
                <h3 className="text-xl font-semibold">Turno Regular</h3>
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
                  <span>13h00</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <Clock className="h-8 w-8 text-[#003876] mr-3" />
                <h3 className="text-xl font-semibold">Atividades Extras</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-center justify-between">
                  <span className="font-medium">Monitorias</span>
                  <span>14h00 - 16h00</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-medium">Laboratórios</span>
                  <span>14h00 - 17h00</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-medium">Simulados</span>
                  <span>Sábados</span>
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
            Construa seu futuro conosco
          </h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Prepare-se para o sucesso com uma educação de excelência.
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

export default EnsinoMedio;