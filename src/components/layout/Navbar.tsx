import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSegmentsOpen, setIsSegmentsOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openDropdown = () => {
    clearTimeout(closeTimerRef.current);
    setIsSegmentsOpen(true);
  };

  const closeDropdown = () => {
    closeTimerRef.current = setTimeout(() => setIsSegmentsOpen(false), 200);
  };

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

            {/* Segmentos dropdown — hover com delay para evitar fechamento prematuro */}
            <div
              className="relative"
              onMouseEnter={openDropdown}
              onMouseLeave={closeDropdown}
            >
              <button className="nav-link flex items-center">
                Segmentos
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Ponte transparente para cobrir o gap entre botão e menu */}
              {isSegmentsOpen && (
                <div className="absolute top-full left-0 w-full h-2" />
              )}

              <div
                className={`absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl py-2 transition-all duration-150 ${
                  isSegmentsOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
                }`}
                onMouseEnter={openDropdown}
                onMouseLeave={closeDropdown}
              >
                <Link to="/educacao-infantil" className="block px-4 py-2.5 text-[#003876] hover:bg-gray-50 hover:text-[#ffd700] transition-colors">
                  Educação Infantil
                </Link>
                <Link to="/ensino-fundamental-1" className="block px-4 py-2.5 text-[#003876] hover:bg-gray-50 hover:text-[#ffd700] transition-colors">
                  Ensino Fundamental I
                </Link>
                <Link to="/ensino-fundamental-2" className="block px-4 py-2.5 text-[#003876] hover:bg-gray-50 hover:text-[#ffd700] transition-colors">
                  Ensino Fundamental II
                </Link>
                <Link to="/ensino-medio" className="block px-4 py-2.5 text-[#003876] hover:bg-gray-50 hover:text-[#ffd700] transition-colors">
                  Ensino Médio
                </Link>
              </div>
            </div>

            <Link to="/sobre" className="nav-link">Sobre</Link>
            <Link to="/estrutura" className="nav-link">Estrutura</Link>
            <Link to="/sobre" className="nav-link">Contato</Link>
            <Link
              to="/matricula"
              className="bg-[#ffd700] text-[#003876] px-6 py-2 rounded-full font-semibold transition-all duration-300 hover:bg-[#003876] hover:text-[#ffd700] hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transform hover:scale-105"
            >
              Matrícula 2026
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
            <Link to="/sobre" onClick={closeMobileMenu} className="text-[#003876] hover:text-[#ffd700] transition-colors">
              Sobre
            </Link>
            <Link to="/estrutura" onClick={closeMobileMenu} className="text-[#003876] hover:text-[#ffd700] transition-colors">
              Estrutura
            </Link>
            <Link to="/sobre" onClick={closeMobileMenu} className="text-[#003876] hover:text-[#ffd700] transition-colors">
              Contato
            </Link>
            <Link
              to="/matricula"
              onClick={closeMobileMenu}
              className="bg-[#ffd700] text-[#003876] px-6 py-2 rounded-full font-semibold w-full text-center"
            >
              Matrícula 2026
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
