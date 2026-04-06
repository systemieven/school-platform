import React, { useState, useEffect } from 'react';
import { Menu, Phone, MapPin, Clock, Instagram } from 'lucide-react';
import BibliotecaVirtual from './pages/BibliotecaVirtual';
import Matricula from './pages/Matricula';
import EducacaoInfantil from './pages/EducacaoInfantil';
import EnsinoFundamental1 from './pages/EnsinoFundamental1';
import EnsinoFundamental2 from './pages/EnsinoFundamental2';
import EnsinoMedio from './pages/EnsinoMedio';

function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSegmentsOpen, setIsSegmentsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigation = (page: string) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false);
    setIsSegmentsOpen(false);
    window.scrollTo(0, 0);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'biblioteca':
        return <BibliotecaVirtual />;
      case 'matricula':
        return <Matricula />;
      case 'educacao-infantil':
        return <EducacaoInfantil />;
      case 'fundamental-1':
        return <EnsinoFundamental1 />;
      case 'fundamental-2':
        return <EnsinoFundamental2 />;
      case 'ensino-medio':
        return <EnsinoMedio />;
      default:
        return (
          <>
            {/* Hero Section */}
            <section className="relative h-[80vh]">
              <div className="absolute inset-0">
                <img 
                  src="https://s3.ibotcloud.com.br/colegiobatista/imagens/colegio-cima.jpeg" 
                  alt="Colégio Batista em Caruaru" 
                  className="w-full h-full object-cover filter blur-[2px]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#003876]/90 to-[#003876]/70"></div>
              </div>
              <div className="relative container mx-auto px-4 h-full flex items-center">
                <div className="max-w-2xl text-white">
                  <h1 className="text-6xl font-bold mb-6 animate-fade-in">
                    Educação que<br />Transforma Vidas
                  </h1>
                  <p className="text-xl mb-8 animate-fade-in-delay">
                    Há mais de 50 anos formando cidadãos com excelência acadêmica e valores cristãos.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button 
                      onClick={() => handleNavigation('sobre')}
                      className="btn-hero"
                    >
                      Conheça Nossa Escola
                      <i data-lucide="chevron-right" className="ml-2"></i>
                    </button>
                    <button 
                      onClick={() => handleNavigation('contato')}
                      className="btn-hero-outline"
                    >
                      Agende uma Visita
                      <i data-lucide="calendar" className="ml-2"></i>
                    </button>
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
                <div className="grid md:grid-cols-4 gap-8">
                  <div 
                    className="segment-card cursor-pointer"
                    onClick={() => handleNavigation('educacao-infantil')}
                  >
                    <img 
                      src="https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=1000"
                      alt="Educação Infantil"
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2">Educação Infantil</h3>
                      <p className="text-gray-600">Desenvolvimento integral da criança</p>
                    </div>
                  </div>

                  <div 
                    className="segment-card cursor-pointer"
                    onClick={() => handleNavigation('fundamental-1')}
                  >
                    <img 
                      src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000"
                      alt="Fundamental I"
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2">Fundamental I</h3>
                      <p className="text-gray-600">Base sólida para o futuro</p>
                    </div>
                  </div>

                  <div 
                    className="segment-card cursor-pointer"
                    onClick={() => handleNavigation('fundamental-2')}
                  >
                    <img 
                      src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=1000"
                      alt="Fundamental II"
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2">Fundamental II</h3>
                      <p className="text-gray-600">Desenvolvimento do pensamento crítico</p>
                    </div>
                  </div>

                  <div 
                    className="segment-card cursor-pointer"
                    onClick={() => handleNavigation('ensino-medio')}
                  >
                    <img 
                      src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1000"
                      alt="Ensino Médio"
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2">Ensino Médio</h3>
                      <p className="text-gray-600">Preparação para o futuro</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-gray-50">
              <div className="container mx-auto px-4">
                <h2 className="text-4xl font-bold text-center mb-16 text-[#003876] scroll-animate scale-up">
                  Por que escolher o Colégio Batista?
                </h2>
                
                {/* Main Features Grid */}
                <div className="grid md:grid-cols-4 gap-8 mb-16">
                  <div className="scroll-animate slide-left feature-card group">
                    <div className="feature-icon group-hover:bg-[#ffd700] group-hover:rotate-12 transition-all duration-500">
                      <i data-lucide="graduation-cap" className="h-8 w-8 text-white group-hover:text-[#003876]"></i>
                    </div>
                    <h3 className="text-xl font-semibold mb-4">Excelência Acadêmica</h3>
                    <p className="text-gray-600 mb-4">Educação de qualidade com resultados comprovados em vestibulares e ENEM</p>
                    <div className="text-sm text-[#003876] font-medium">
                      <p className="flex items-center justify-center">
                        <i data-lucide="check" className="w-4 h-4 mr-2"></i>
                        95% de aprovação em vestibulares
                      </p>
                    </div>
                  </div>

                  <div className="scroll-animate slide-left feature-card group">
                    <div className="feature-icon group-hover:bg-[#ffd700] group-hover:rotate-12 transition-all duration-500">
                      <i data-lucide="users" className="h-8 w-8 text-white group-hover:text-[#003876]"></i>
                    </div>
                    <h3 className="text-xl font-semibold mb-4">Valores Cristãos</h3>
                    <p className="text-gray-600 mb-4">Formação integral baseada em princípios éticos e morais</p>
                    <div className="text-sm text-[#003876] font-medium">
                      <p className="flex items-center justify-center">
                        <i data-lucide="check" className="w-4 h-4 mr-2"></i>
                        Desenvolvimento do caráter
                      </p>
                    </div>
                  </div>

                  <div className="scroll-animate slide-right feature-card group">
                    <div className="feature-icon group-hover:bg-[#ffd700] group-hover:rotate-12 transition-all duration-500">
                      <i data-lucide="book-open" className="h-8 w-8 text-white group-hover:text-[#003876]"></i>
                    </div>
                    <h3 className="text-xl font-semibold mb-4">Metodologia Inovadora</h3>
                    <p className="text-gray-600 mb-4">Aprendizagem ativa com tecnologia integrada ao ensino</p>
                    <div className="text-sm text-[#003876] font-medium">
                      <p className="flex items-center justify-center">
                        <i data-lucide="check" className="w-4 h-4 mr-2"></i>
                        Laboratórios modernos
                      </p>
                    </div>
                  </div>

                  <div className="scroll-animate slide-right feature-card group">
                    <div className="feature-icon group-hover:bg-[#ffd700] group-hover:rotate-12 transition-all duration-500">
                      <i data-lucide="award" className="h-8 w-8 text-white group-hover:text-[#003876]"></i>
                    </div>
                    <h3 className="text-xl font-semibold mb-4">Tradição e Qualidade</h3>
                    <p className="text-gray-600 mb-4">Mais de 50 anos de história na educação de Caruaru</p>
                    <div className="text-sm text-[#003876] font-medium">
                      <p className="flex items-center justify-center">
                        <i data-lucide="check" className="w-4 h-4 mr-2"></i>
                        Referência em educação
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Features Grid */}
                <div className="grid md:grid-cols-3 gap-8">
                  {/* Infraestrutura */}
                  <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-start space-x-4">
                      <div className="bg-[#003876] rounded-full p-3">
                        <i data-lucide="building" className="h-6 w-6 text-white"></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Infraestrutura Completa</h3>
                        <ul className="space-y-2">
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Salas climatizadas
                          </li>
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Quadra poliesportiva
                          </li>
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Biblioteca moderna
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Atividades Extracurriculares */}
                  <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-start space-x-4">
                      <div className="bg-[#003876] rounded-full p-3">
                        <i data-lucide="palette" className="h-6 w-6 text-white"></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Atividades Extras</h3>
                        <ul className="space-y-2">
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Robótica educacional
                          </li>
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Práticas esportivas
                          </li>
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Clube de ciências
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Acompanhamento */}
                  <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="flex items-start space-x-4">
                      <div className="bg-[#003876] rounded-full p-3">
                        <i data-lucide="heart-handshake" className="h-6 w-6 text-white"></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Acompanhamento Individual</h3>
                        <ul className="space-y-2">
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Orientação pedagógica
                          </li>
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Suporte psicológico
                          </li>
                          <li className="flex items-center text-gray-600">
                            <i data-lucide="check-circle" className="w-4 h-4 mr-2 text-green-500"></i>
                            Reforço escolar
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="mt-16 text-center">
                  <button 
                    onClick={() => handleNavigation('matricula')}
                    className="inline-flex items-center px-8 py-4 bg-[#003876] text-white rounded-full font-semibold hover:bg-[#002855] transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                  >
                    <span>Faça sua matrícula</span>
                    <i data-lucide="arrow-right" className="ml-2 w-5 h-5"></i>
                  </button>
                </div>
              </div>
            </section>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Bar */}
      <div className="bg-[#ffd700] text-[#003876] py-1">
        <div className="container mx-auto px-4">
          <div className="flex justify-end items-center space-x-4 text-sm">
            <a href="#" className="hover:text-[#003876]/80 transition-colors">Portal do Aluno</a>
            <button 
              onClick={() => handleNavigation('biblioteca')}
              className="hover:text-[#003876]/80 transition-colors"
            >
              Biblioteca Virtual
            </button>
            <a href="#" className="hover:text-[#003876]/80 transition-colors">Área do Professor</a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-[#003876] text-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-2 text-sm">
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <Phone size={16} className="mr-2" />
                <span>(81) 3721-4787</span>
              </div>
              <div className="flex items-center">
                <MapPin size={16} className="mr-2" />
                <span>Rua Marcílio Dias, 99 - São Francisco, Caruaru/PE</span>
              </div>
              <div className="flex items-center">
                <Clock size={16} className="mr-2" />
                <span>Seg - Sex: 7h às 17h</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a 
                href="https://instagram.com/colegiobatistacaruarupe" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-[#ffd700] transition-colors"
              >
                <Instagram size={20} />
                <span className="sr-only">Instagram</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Navigation */}
      <nav className={`bg-white sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'shadow-lg' : ''}`}>
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img 
                src="https://s3.ibotcloud.com.br/colegiobatista/imagens/Logo-Nova.jpeg" 
                alt="Colégio Batista em Caruaru" 
                className="h-16 w-auto cursor-pointer"
                onClick={() => handleNavigation('home')}
              />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => handleNavigation('home')} className="nav-link">Início</button>
              <div className="relative group">
                <button 
                  className="nav-link flex items-center"
                  onMouseEnter={() => setIsSegmentsOpen(true)}
                  onMouseLeave={() => setIsSegmentsOpen(false)}
                >
                  Segmentos
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div 
                  className={`absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-xl py-2 ${isSegmentsOpen ? 'block' : 'hidden'}`}
                  onMouseEnter={() => setIsSegmentsOpen(true)}
                  onMouseLeave={() => setIsSegmentsOpen(false)}
                >
                  <button 
                    onClick={() => handleNavigation('educacao-infantil')} 
                    className="block w-full text-left px-4 py-2 text-[#003876] hover:bg-gray-50"
                  >
                    Educação Infantil
                  </button>
                  <button 
                    onClick={() => handleNavigation('fundamental-1')} 
                    className="block w-full text-left px-4 py-2 text-[#003876] hover:bg-gray-50"
                  >
                    Ensino Fundamental I
                  </button>
                  <button 
                    onClick={() => handleNavigation('fundamental-2')} 
                    className="block w-full text-left px-4 py-2 text-[#003876] hover:bg-gray-50"
                  >
                    Ensino Fundamental II
                  </button>
                  <button 
                    onClick={() => handleNavigation('ensino-medio')} 
                    className="block w-full text-left px-4 py-2 text-[#003876] hover:bg-gray-50"
                  >
                    Ensino Médio
                  </button>
                </div>
              </div>
              <button onClick={() => handleNavigation('sobre')} className="nav-link">Sobre</button>
              <button onClick={() => handleNavigation('estrutura')} className="nav-link">Estrutura</button>
              <button onClick={() => handleNavigation('contato')} className="nav-link">Contato</button>
              <button 
                onClick={() => handleNavigation('matricula')}
                className="bg-[#ffd700] text-[#003876] px-6 py-2 rounded-full font-semibold transition-all duration-300 hover:bg-[#003876] hover:text-[#ffd700] hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transform hover:scale-105"
              >
                Matrícula 2025
              </button>
            </div>
            <button 
              className="md:hidden"
              onClick={toggleMobileMenu}
              aria-label="Menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-6 w-6 text-[#003876]" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden bg-white ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col space-y-4">
              <button onClick={() => handleNavigation('home')} className="text-[#003876] hover:text-[#ffd700] transition-colors">Início</button>
              <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                <button onClick={() => handleNavigation('educacao-infantil')} className="block text-[#003876] hover:text-[#ffd700] transition-colors">Educação Infantil</button>
                <button onClick={() => handleNavigation('fundamental-1')} className="block text-[#003876] hover:text-[#ffd700] transition-colors">Ensino Fundamental I</button>
                <button onClick={() => handleNavigation('fundamental-2')} className="block text-[#003876] hover:text-[#ffd700] transition-colors">Ensino Fundamental II</button>
                <button onClick={() => handleNavigation('ensino-medio')} className="block text-[#003876] hover:text-[#ffd700] transition-colors">Ensino Médio</button>
              </div>
              <button onClick={() => handleNavigation('sobre')} className="text-[#003876] hover:text-[#ffd700] transition-colors">Sobre</button>
              <button onClick={() => handleNavigation('estrutura')} className="text-[#003876] hover:text-[#ffd700] transition-colors">Estrutura</button>
              <button onClick={() => handleNavigation('contato')} className="text-[#003876] hover:text-[#ffd700] transition-colors">Contato</button>
              <button 
                onClick={() => handleNavigation('matricula')}
                className="bg-[#ffd700] text-[#003876] px-6 py-2 rounded-full font-semibold w-full text-center"
              >
                Matrícula 2025
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {renderPage()}

      {/* Footer */}
      <footer className="bg-[#003876] text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <h3 className="text-xl font-semibold mb-4">Contato</h3>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <Phone size={16} className="mr-2" />
                  (81) 3721-4787
                </li>
                <li className="flex items-center">
                  <MapPin size={16} className="mr-2" />
                  Rua Marcílio Dias, 99<br />São Francisco, Caruaru/PE
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Links Rápidos</h3>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-[#ffd700] transition-colors">Portal do Aluno</a></li>
                <li><a href="#" className="hover:text-[#ffd700] transition-colors">Biblioteca Virtual</a></li>
                <li><a href="#" className="hover:text-[#ffd700] transition-colors">Área do Professor</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Segmentos</h3>
              <ul className="space-y-2">
                <li><button onClick={() => handleNavigation('educacao-infantil')} className="hover:text-[#ffd700] transition-colors">Educação Infantil</button></li>
                <li><button onClick={() => handleNavigation('fundamental-1')} className="hover:text-[#ffd700] transition-colors">Ensino Fundamental I</button></li>
                <li><button onClick={() => handleNavigation('fundamental-2')} className="hover:text-[#ffd700] transition-colors">Ensino Fundamental II</button></li>
                <li><button onClick={() => handleNavigation('ensino-medio')} className="hover:text-[#ffd700] transition-colors">Ensino Médio</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Redes Sociais</h3>
              <div className="flex space-x-4">
                <a 
                  href="https://instagram.com/colegiobatistacaruarupe" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-[#ffd700] transition-colors"
                >
                  <Instagram size={24} />
                  <span className="sr-only">Instagram</span>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm opacity-80">
            <p>&copy; 2024 Colégio Batista em Caruaru. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;