/**
 * LegalConsent — Toggle de ciência e aceite dos Termos de Uso e Política de Privacidade.
 * Reutilizado em todos os formulários do sistema.
 */

import { Link } from 'react-router-dom';

interface LegalConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Variante visual: 'default' para formulários em fundo claro, 'dark' para fundo escuro */
  variant?: 'default' | 'dark';
}

export default function LegalConsent({ checked, onChange, variant = 'default' }: LegalConsentProps) {
  const isDark = variant === 'dark';

  return (
    <label className="flex items-start gap-3 cursor-pointer group select-none">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={[
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200',
            checked
              ? 'bg-[#003876] border-[#003876]'
              : isDark
                ? 'bg-white/10 border-white/30 group-hover:border-white/50'
                : 'bg-white border-gray-300 group-hover:border-[#003876]/50',
          ].join(' ')}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <p className={`text-sm leading-relaxed ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
        Li e concordo com os{' '}
        <Link
          to="/termos-de-uso"
          target="_blank"
          className={`font-semibold underline underline-offset-2 transition-colors ${
            isDark
              ? 'text-[#ffd700] hover:text-[#ffe44d]'
              : 'text-[#003876] hover:text-[#ffd700]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          Termos de Uso
        </Link>{' '}
        e a{' '}
        <Link
          to="/politica-privacidade"
          target="_blank"
          className={`font-semibold underline underline-offset-2 transition-colors ${
            isDark
              ? 'text-[#ffd700] hover:text-[#ffe44d]'
              : 'text-[#003876] hover:text-[#ffd700]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          Política de Privacidade
        </Link>.
      </p>
    </label>
  );
}
