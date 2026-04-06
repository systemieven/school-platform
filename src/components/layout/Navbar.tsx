import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSegmentsOpen, setIsSegmentsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className={`bg-white sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'shadow-lg' : ''}`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center" onClick={closeMobileMenu}>
            <img
              src="https://s3.ibotcloud.com.br/colegiobatista/imagens/Logo-Nova.jpeg"
              alt="Colégio Batista em Caruaru"
              className="h-16 w-auto"
            />
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="nav-link">Início</Link>
            <div
              className="relative group"
              onMouseEnter={() => setIsSegmentsOpen(true)}
              onMouseLeave={() => setIsSegmentsOpen(false)}
            >
              <button className="nav-link flex items-center">
                Segmentos
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-xl py-2 ${isSegmentsOpen ? 'block' : 'hidden'}`}>
                <Link to="/educacao-infantil" className="block px-4 py-2 text-[#003876] hover:bg-gray-50">
                  Educação Infantil
                </Link>
                <Link to="/ensino-fundamental-1" className="block px-4 py-2 text-[#003876] hover:bg-gray-50">
                  Ensino Fundamental I
                </Link>
                <Link to="/ensino-fundamental-2" className="block px-4 py-2 text-[#003876] hover:bg-gray-50">
                  Ensino Fundamental II
                </Link>
                <Link to="/ensino-medio" className="block px-4 py-2 text-[#003876] hover:bg-gray-50">
                  Ensino Médio
                </Link>
              </div>
            </div>
            <a href="#sobre" className="nav-link">Sobre</a>
            <a href="#estrutura" className="nav-link">Estrutura</a>
            <a href="#contato" className="nav-link">Contato</a>
            <Link
              to="/matricula"
              className="bg-[#ffd700] text-[#003876] px-6 py-2 rounded-full font-semibold transition-all duration-300 hover:bg-[#003876] hover:text-[#ffd700] hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transform hover:scale-105"
            >
              Matrícula 2025
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-[#003876]" />
            ) : (
              <Menu className="h-6 w-6 text-[#003876]" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden bg-white ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col space-y-4">
            <Link to="/" onClick={closeMobileMenu} className="text-[#003876] hover:text-[#ffd700] transition-colors">
              Início
            </Link>
            <div className="space-y-2 pl-4 border-l-2 border-gray-200">
              <Link to="/educacao-infantil" onClick={closeMobileMenu} className="block text-[#003876] hover:text-[#ffd700] transition-colors">
                Educação Infantil
              </Link>
              <Link to="/ensino-fundamental-1" onClick={closeMobileMenu} className="block text-[#003876] hover:text-[#ffd700] transition-colors">
                Ensino Fundamental I
              </Link>
              <Link to="/ensino-fundamental-2" onClick={closeMobileMenu} className="block text-[#003876] hover:text-[#ffd700] transition-colors">
                Ensino Fundamental II
              </Link>
              <Link to="/ensino-medio" onClick={closeMobileMenu} className="block text-[#003876] hover:text-[#ffd700] transition-colors">
                Ensino Médio
              </Link>
            </div>
            <a href="#sobre" onClick={closeMobileMenu} className="text-[#003876] hover:text-[#ffd700] transition-colors">
              Sobre
            </a>
            <a href="#estrutura" onClick={closeMobileMenu} className="text-[#003876] hover:text-[#ffd700] transition-colors">
              Estrutura
            </a>
            <a href="#contato" onClick={closeMobileMenu} className="text-[#003876] hover:text-[#ffd700] transition-colors">
              Contato
            </a>
            <Link
              to="/matricula"
              onClick={closeMobileMenu}
              className="bg-[#ffd700] text-[#003876] px-6 py-2 rounded-full font-semibold w-full text-center"
            >
              Matrícula 2025
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
