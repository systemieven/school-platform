import React from 'react';
import { BookOpen, Target, Users, Star, CheckCircle, Award, Lightbulb, Clock } from 'lucide-react';

const EnsinoFundamental1 = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[60vh]">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2070"
            alt="Alunos em sala de aula" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/90 to-[#003876]/70"></div>
        </div>
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-2xl text-white">
            <h1 className="text-5xl font-bold mb-6">Ensino Fundamental I</h1>
            <p className="text-xl mb-8">
              Construindo bases sólidas para o futuro através de uma educação integral e inovadora.
            </p>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold text-[#003876] mb-6">
              Formação Integral e Desenvolvimento Pleno
            </h2>
            <p className="text-gray-600 text-lg">
              No Ensino Fundamental I, focamos no desenvolvimento das habilidades 
              essenciais, preparando os alunos para os desafios futuros com uma 
              base acadêmica sólida e valores cristãos.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 mt-12">
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Aprendizagem Ativa</h3>
              <p className="text-gray-600">
                Metodologias inovadoras que estimulam o protagonismo do aluno.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Objetivos Claros</h3>
              <p className="text-gray-600">
                Metas de aprendizagem definidas e acompanhamento personalizado.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Valores Cristãos</h3>
              <p className="text-gray-600">
                Formação integral baseada em princípios éticos e morais.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#003876] rounded-full flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Criatividade</h3>
              <p className="text-gray-600">
                Estímulo ao pensamento criativo e resolução de problemas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Nossos Diferenciais
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <Star className="h-10 w-10 text-[#ffd700] mb-4" />
              <h3 className="text-xl font-semibold mb-4">Programa Acadêmico</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Material didático de excelência</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Projetos interdisciplinares</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Acompanhamento personalizado</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <Award className="h-10 w-10 text-[#ffd700] mb-4" />
              <h3 className="text-xl font-semibold mb-4">Atividades Complementares</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Oficinas de tecnologia</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Práticas esportivas</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-2" />
                  <span>Iniciação científica</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-[#003876] mb-12">
            Rotina Escolar
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-50 rounded-xl p-8">
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
                  <span>11h30</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-8">
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
                  <span>17h30</span>
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
            Venha conhecer nossa escola
          </h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Agende uma visita e conheça nossa estrutura e proposta pedagógica.
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

export default EnsinoFundamental1;