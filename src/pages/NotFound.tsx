import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center relative overflow-hidden">

      {/* Diagonal gold stripe at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent z-10" />

      {/* Giant background "404" */}
      <span className="absolute select-none pointer-events-none font-display text-[20rem] md:text-[28rem] font-bold text-[#003876]/5 leading-none">
        404
      </span>

      {/* Main content */}
      <div className="relative z-10 text-center px-4">

        {/* Eyebrow */}
        <p className="text-xs font-bold tracking-[0.3em] uppercase text-[#ffd700] mb-6">
          Erro 404
        </p>

        {/* Gold divider bar */}
        <div className="section-divider mb-8" />

        {/* Heading */}
        <h1 className="font-display text-5xl md:text-6xl font-bold text-[#003876] mb-4">
          Página não encontrada
        </h1>

        {/* Subtitle */}
        <p className="text-gray-500 text-lg mb-10 max-w-sm mx-auto">
          A página que você procura não existe ou foi movida.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-[#003876] text-white px-8 py-4 rounded-full font-semibold hover:bg-[#ffd700] hover:text-[#003876] transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Início
          </Link>

          <a
            href="#"
            className="text-[#003876]/60 hover:text-[#003876] text-sm underline-offset-4 hover:underline transition-colors duration-300"
          >
            Reportar problema
          </a>
        </div>
      </div>
    </div>
  );
}
