import { Link, useLocation } from 'react-router-dom';
import { HardHat, ArrowLeft, ChevronRight } from 'lucide-react';

const PAGE_LABELS: Record<string, string> = {
  '/sobre': 'Sobre Nós',
  '/estrutura': 'Estrutura',
  '/portal-aluno': 'Portal do Aluno',
  '/biblioteca-virtual': 'Biblioteca Virtual',
  '/area-professor': 'Área do Professor',
};

export default function EmConstrucao() {
  const { pathname } = useLocation();
  const pageLabel = PAGE_LABELS[pathname];

  return (
    <div className="relative overflow-hidden min-h-screen bg-[#003876] flex items-center justify-center px-4">
      {/* Grain overlay */}
      <div className="grain-overlay" />

      {/* Decorative corner circles */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full border border-[#ffd700] opacity-10 pointer-events-none" />
      <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full border border-[#ffd700] opacity-10 pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full border border-[#ffd700] opacity-10 pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full border border-[#ffd700] opacity-10 pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-64 h-64 rounded-full border border-[#ffd700] opacity-5 pointer-events-none -translate-y-1/2" />

      {/* Centered content */}
      <div className="relative z-10 text-center max-w-lg w-full py-16">

        {/* Gold badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffd700] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffd700]" />
          </span>
          <span className="text-white/80 text-xs font-semibold tracking-wider uppercase">Em Desenvolvimento</span>
        </div>

        {/* Icon with ring animation */}
        <div className="flex justify-center mb-10">
          <div className="relative">
            <div className="bg-[#ffd700]/10 border-2 border-[#ffd700]/30 rounded-full p-8">
              <HardHat className="w-20 h-20 text-[#ffd700]" />
            </div>
            <span className="absolute inset-0 rounded-full border-2 border-[#ffd700]/20 animate-ping" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-display text-6xl md:text-7xl font-bold text-white mb-6">
          Em Construção
        </h1>

        {/* Gold accent line */}
        <div
          className="hero-accent-line h-[3px] bg-gradient-to-r from-[#ffd700] to-[#ffe44d] rounded-full mx-auto mb-8"
          style={{ maxWidth: 80 }}
        />

        {/* Page label */}
        {pageLabel && (
          <p className="text-[#ffd700]/80 text-lg font-medium tracking-wide mb-3">
            {pageLabel}
          </p>
        )}

        {/* Subtitle */}
        <p className="text-white/60 text-base leading-relaxed mb-12 max-w-sm mx-auto">
          Esta página está sendo desenvolvida com cuidado e em breve estará disponível para você.
        </p>

        {/* Progress bar */}
        <div className="bg-white/10 rounded-full h-1.5 w-64 mx-auto mb-12">
          <div className="bg-gradient-to-r from-[#ffd700] to-[#ffe44d] h-1.5 rounded-full w-[35%] animate-pulse" />
        </div>

        {/* Back button */}
        <Link
          to="/"
          className="group inline-flex items-center gap-3 bg-white/10 hover:bg-[#ffd700] border border-white/20 hover:border-[#ffd700] text-white hover:text-[#003876] px-8 py-4 rounded-full font-semibold transition-all duration-500"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
          Voltar ao Início
          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -ml-1 transition-all duration-300" />
        </Link>

        {/* Decorative year text */}
        <p className="text-white/20 tracking-[0.5em] text-xs font-semibold uppercase mt-16">
          — 2026 —
        </p>
      </div>
    </div>
  );
}
