import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

// ── Defaults ──

const DEFAULT_QUICK_LINKS = [
  { label: 'Portal do Aluno', route: '/portal-aluno' },
  { label: 'Biblioteca Virtual', route: '/biblioteca-virtual' },
  { label: 'Área do Professor', route: '/area-professor' },
];

// ── Social network helpers (same format as Footer — source: general.social_networks) ──

interface SocialEntry { id: number; network: string; handle: string; message?: string }

function parseSocialNetworks(raw: unknown): SocialEntry[] {
  try {
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw as string);
    if (Array.isArray(arr)) return arr as SocialEntry[];
  } catch { /* ignore */ }
  return [];
}

function buildSocialUrl(entry: SocialEntry): string {
  const h = entry.handle.replace(/^@/, '');
  switch (entry.network) {
    case 'instagram': return `https://instagram.com/${h}`;
    case 'facebook':  return `https://facebook.com/${h}`;
    case 'whatsapp':  return `https://wa.me/${h.replace(/\D/g, '')}${entry.message ? `?text=${encodeURIComponent(entry.message)}` : ''}`;
    case 'twitter':   return `https://x.com/${h}`;
    case 'linkedin':  return `https://linkedin.com/company/${h}`;
    case 'youtube':   return `https://youtube.com/@${h}`;
    case 'tiktok':    return `https://tiktok.com/@${h}`;
    default:          return '#';
  }
}

function TopBarSocialIcon({ network }: { network: string }) {
  switch (network) {
    case 'instagram':
      return <Instagram size={16} />;
    case 'whatsapp':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      );
    case 'facebook':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    default:
      return null;
  }
}

// ── Topbar config helpers ──

interface TopBarConfig {
  show_topbar: boolean;
  quick_links: Array<{ label: string; route: string }>;
}

function parseTopbar(raw: unknown): TopBarConfig {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    show_topbar: typeof obj.show_topbar === 'boolean' ? obj.show_topbar : true,
    quick_links: Array.isArray(obj.quick_links) ? obj.quick_links : DEFAULT_QUICK_LINKS,
  };
}

// ── Component ──

export default function TopBar() {
  const { settings: navSettings } = useSettings('navigation');
  const { settings: generalSettings } = useSettings('general');

  const config = parseTopbar(navSettings.topbar);
  const socialNetworks = parseSocialNetworks(generalSettings.social_networks);

  if (!config.show_topbar) return null;

  return (
    <div className="bg-brand-secondary text-brand-primary py-1">
      <div className="container mx-auto px-4">
        <div className="flex justify-end items-center gap-4 text-sm">

          {/* Quick links (com divisores entre eles) */}
          {config.quick_links.map((link, idx) => (
            <Fragment key={`${link.route}-${idx}`}>
              {idx > 0 && <span className="w-px h-3.5 bg-brand-primary/20" aria-hidden="true" />}
              <Link
                to={link.route}
                className="hover:text-brand-primary/80 transition-colors"
              >
                {link.label}
              </Link>
            </Fragment>
          ))}

          {/* Divider */}
          {socialNetworks.length > 0 && (
            <span className="w-px h-3.5 bg-brand-primary/20" />
          )}

          {/* Social icons — source: general.social_networks (Dados Institucionais) */}
          {socialNetworks.map((entry) => (
            <a
              key={entry.id}
              href={buildSocialUrl(entry)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={entry.network}
              className="hover:text-brand-primary/70 transition-colors"
            >
              <TopBarSocialIcon network={entry.network} />
            </a>
          ))}

        </div>
      </div>
    </div>
  );
}
