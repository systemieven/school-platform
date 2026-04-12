import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useBranding } from '../../contexts/BrandingContext';

// ── Types ──

interface NavItem {
  label: string;
  route: string | null;
  children?: Array<{ label: string; route: string }>;
}

interface NavbarConfig {
  items: NavItem[];
}

// ── Defaults ──

const DEFAULT_LOGO_URL = '';

const DEFAULT_ITEMS: NavItem[] = [
  { label: 'Início', route: '/' },
  {
    label: 'Segmentos',
    route: null,
    children: [
      { label: 'Educação Infantil', route: '/educacao-infantil' },
      { label: 'Ensino Fundamental I', route: '/ensino-fundamental-1' },
      { label: 'Ensino Fundamental II', route: '/ensino-fundamental-2' },
      { label: 'Ensino Médio', route: '/ensino-medio' },
    ],
  },
  { label: 'Sobre', route: '/sobre' },
  { label: 'Estrutura', route: '/estrutura' },
  { label: 'Contato', route: '/contato' },
];

function parseNavbar(raw: unknown): NavbarConfig {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    items: Array.isArray(obj.items) ? (obj.items as NavItem[]) : DEFAULT_ITEMS,
  };
}

// ── Component ──

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { settings } = useSettings('navigation');
  const { identity, cta } = useBranding();

  const config = parseNavbar(settings.navbar);
  const logoUrl = identity.logo_url || DEFAULT_LOGO_URL;
  const logoAlt = identity.school_short_name || identity.school_name || '';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openDropdown = (idx: number) => {
    clearTimeout(closeTimerRef.current);
    setOpenDropdownIdx(idx);
  };

  const closeDropdown = () => {
    closeTimerRef.current = setTimeout(() => setOpenDropdownIdx(null), 200);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className={`bg-white sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'shadow-lg' : ''}`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center" onClick={closeMobileMenu}>
            <img
              src={logoUrl}
              alt={logoAlt}
              className="h-16 w-auto"
            />
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            {config.items.map((item, idx) =>
              item.children && item.children.length > 0 ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => openDropdown(idx)}
                  onMouseLeave={closeDropdown}
                >
                  <button className="nav-link flex items-center">
                    {item.label}
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Transparent bridge to cover gap between button and menu */}
                  {openDropdownIdx === idx && (
                    <div className="absolute top-full left-0 w-full h-2" />
                  )}

                  <div
                    className={`absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl py-2 transition-all duration-150 ${
                      openDropdownIdx === idx ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
                    }`}
                    onMouseEnter={() => openDropdown(idx)}
                    onMouseLeave={closeDropdown}
                  >
                    {item.children.map((child) => (
                      <Link
                        key={child.route}
                        to={child.route}
                        className="block px-4 py-2.5 text-brand-primary hover:bg-gray-50 hover:text-brand-secondary transition-colors"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link key={item.label} to={item.route || '/'} className="nav-link">
                  {item.label}
                </Link>
              )
            )}

            <Link
              to={cta.enrollment_route}
              className={`btn-matricula-nav bg-brand-secondary text-brand-primary px-6 py-2 rounded-full font-semibold transition-all duration-300 hover:bg-brand-primary hover:text-brand-secondary hover:[animation:none] hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transform hover:scale-105`}
            >
              {cta.enrollment_label}
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
              <X className="h-6 w-6 text-brand-primary" />
            ) : (
              <Menu className="h-6 w-6 text-brand-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden bg-white ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col space-y-4">
            {config.items.map((item) =>
              item.children && item.children.length > 0 ? (
                <div key={item.label} className="space-y-2 pl-4 border-l-2 border-gray-200">
                  {item.children.map((child) => (
                    <Link
                      key={child.route}
                      to={child.route}
                      onClick={closeMobileMenu}
                      className="block text-brand-primary hover:text-brand-secondary transition-colors"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={item.label}
                  to={item.route || '/'}
                  onClick={closeMobileMenu}
                  className="text-brand-primary hover:text-brand-secondary transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
            <Link
              to={cta.enrollment_route}
              onClick={closeMobileMenu}
              className="bg-brand-secondary text-brand-primary px-6 py-2 rounded-full font-semibold w-full text-center"
            >
              {cta.enrollment_label}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
