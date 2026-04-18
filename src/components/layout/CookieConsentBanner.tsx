/**
 * CookieConsentBanner — aviso de cookies do site público.
 *
 * Lê configuração em `system_settings[category=branding, key=cookies]` e
 * renderiza um card fixo no canto inferior usando as cores definidas em
 * Site > Marca. Usuário decide "Aceitar" (botão secundário com o mesmo
 * efeito pulse do botão Matrícula, quando habilitado) ou "Recusar".
 *
 * Persiste a decisão em `localStorage` (`cookie_consent_v1`) — uma vez
 * tomada, o banner não reaparece. Para testar, limpe a chave no DevTools.
 *
 * Se `cookies.enabled=false` no admin, o componente não renderiza.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useBranding } from '../../contexts/BrandingContext';

const STORAGE_KEY = 'cookie_consent_v1';

interface CookieSettings {
  enabled: boolean;
  title: string;
  message: string;
  accept_label: string;
  decline_label: string;
  policy_label: string;
  policy_route: string;
  pulse: boolean;
}

const DEFAULTS: CookieSettings = {
  enabled: true,
  title: 'Este site usa cookies',
  message:
    'Utilizamos cookies para melhorar sua experiência, analisar o tráfego e personalizar conteúdo. ' +
    'Ao continuar navegando, você concorda com o uso destes cookies conforme descrito em nossa política.',
  accept_label: 'Aceitar',
  decline_label: 'Recusar',
  policy_label: 'Política de Privacidade',
  policy_route: '/politica-privacidade',
  pulse: true,
};

export default function CookieConsentBanner() {
  const { settings } = useSettings('branding');
  const { colors } = useBranding();
  const [decision, setDecision] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Hidrata do localStorage só no client (evita mismatch no SSR e flash).
  useEffect(() => {
    try { setDecision(localStorage.getItem(STORAGE_KEY)); } catch { /* ignore */ }
    setMounted(true);
  }, []);

  const cfg: CookieSettings = {
    ...DEFAULTS,
    ...((settings.cookies as Partial<CookieSettings> | undefined) ?? {}),
  };

  if (!mounted || !cfg.enabled || decision) return null;

  function persist(value: 'accepted' | 'declined') {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
    setDecision(value);
  }

  return (
    <div
      role="dialog"
      aria-label="Aviso de uso de cookies"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-6 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-[60] rounded-2xl shadow-2xl p-5"
      style={{
        backgroundColor: colors.primary,
        color: colors.text_on_primary,
        border: `1px solid ${colors.primary_dark}`,
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: colors.secondary, color: colors.text_on_secondary }}
        >
          <Cookie className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold mb-1">{cfg.title}</h3>
          <p className="text-xs leading-relaxed opacity-90">
            {cfg.message}{' '}
            {cfg.policy_route && (
              <Link
                to={cfg.policy_route}
                className="underline font-medium"
                style={{ color: colors.secondary }}
              >
                {cfg.policy_label}
              </Link>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => persist('declined')}
          aria-label="Fechar aviso"
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => persist('declined')}
          className="px-4 py-2 rounded-full text-xs font-semibold transition-colors hover:opacity-80"
          style={{
            color: colors.text_on_primary,
            backgroundColor: 'transparent',
            border: `1px solid ${colors.text_on_primary}40`,
          }}
        >
          {cfg.decline_label}
        </button>
        <button
          type="button"
          onClick={() => persist('accepted')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all transform hover:scale-105 ${
            cfg.pulse ? 'btn-matricula-nav' : ''
          }`}
          style={{
            backgroundColor: colors.secondary,
            color: colors.text_on_secondary,
          }}
        >
          {cfg.accept_label}
        </button>
      </div>
    </div>
  );
}
