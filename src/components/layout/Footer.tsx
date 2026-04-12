import { Link } from 'react-router-dom';
import { Phone, MapPin, Clock, Instagram } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useBranding } from '../../contexts/BrandingContext';

// ── Business hours helpers ────────────────────────────────────────────────────
interface BHInterval { start: string; end: string }
interface BHDay { open?: boolean; intervals?: Array<{ start?: string; end?: string }>; start?: string; end?: string }

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function getBusinessIntervalsForWeekday(rawBH: unknown, weekday: number): BHInterval[] {
  if (!rawBH) return [];
  let bh: Record<string, BHDay>;
  try {
    bh = typeof rawBH === 'string' ? JSON.parse(rawBH) : (rawBH as Record<string, BHDay>);
  } catch {
    return [];
  }
  const d = bh?.[String(weekday)];
  if (!d?.open) return [];
  if (Array.isArray(d.intervals) && d.intervals.length > 0) {
    return d.intervals
      .filter((i) => typeof i.start === 'string' && typeof i.end === 'string')
      .map((i) => ({ start: i.start as string, end: i.end as string }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }
  if (typeof d.start === 'string' && typeof d.end === 'string') {
    return [{ start: d.start, end: d.end }];
  }
  return [];
}

function buildBusinessHoursLines(raw: unknown): string[] {
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const openDays: { idx: number; name: string; intervals: BHInterval[]; signature: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const intervals = getBusinessIntervalsForWeekday(raw, i);
    if (intervals.length === 0) continue;
    openDays.push({
      idx: i,
      name: DAYS[i],
      intervals,
      signature: intervals.map((iv) => `${iv.start}-${iv.end}`).join('|'),
    });
  }
  if (openDays.length === 0) return [];

  const groups: { names: string[]; lastIdx: number; intervals: BHInterval[]; signature: string }[] = [];
  for (const d of openDays) {
    const last = groups[groups.length - 1];
    if (last && last.signature === d.signature && last.lastIdx + 1 === d.idx) {
      last.names.push(d.name);
      last.lastIdx = d.idx;
    } else {
      groups.push({ names: [d.name], lastIdx: d.idx, intervals: d.intervals, signature: d.signature });
    }
  }

  return groups.map((g) => {
    const label = g.names.length === 1 ? g.names[0] : `${g.names[0]} - ${g.names[g.names.length - 1]}`;
    const times = g.intervals.map((iv) => `${fmtTime(iv.start)} às ${fmtTime(iv.end)}`).join(' e ');
    return `${label}: ${times}`;
  });
}

// ── Social network helpers ────────────────────────────────────────────────────
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

function SocialIcon({ network, size = 24 }: { network: string; size?: number }) {
  switch (network) {
    case 'instagram':
      return <Instagram size={size} />;
    case 'facebook':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'whatsapp':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      );
    case 'twitter':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case 'linkedin':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
        </svg>
      );
    default:
      return null;
  }
}

function formatAddress(raw: unknown): { line1: string; line2: string } {
  if (!raw) return { line1: '', line2: '' };
  if (typeof raw === 'object' && raw !== null) {
    const a = raw as Record<string, string>;
    const line1 = [a.rua, a.numero && `, ${a.numero}`].filter(Boolean).join('');
    const line2 = [a.bairro, a.cidade && `${a.cidade}${a.estado ? `/${a.estado}` : ''}`].filter(Boolean).join(', ');
    return { line1, line2 };
  }
  // Legacy plain string — split at " - "
  const s = String(raw);
  const idx = s.indexOf(' - ');
  if (idx === -1) return { line1: s, line2: '' };
  return { line1: s.slice(0, idx), line2: s.slice(idx + 3) };
}

// ── Footer config types & defaults ──

interface FooterColumn {
  title: string;
  links: Array<{ label: string; route: string }>;
}

interface FooterConfig {
  columns: FooterColumn[];
  legal_links: Array<{ label: string; route: string }>;
  copyright_text: string;
  show_cnpj: boolean;
}

const DEFAULT_FOOTER: FooterConfig = {
  columns: [
    {
      title: 'Links Rápidos',
      links: [
        { label: 'Portal do Aluno', route: '/portal-aluno' },
        { label: 'Biblioteca Virtual', route: '/biblioteca-virtual' },
        { label: 'Área do Professor', route: '/area-professor' },
      ],
    },
    {
      title: 'Segmentos',
      links: [
        { label: 'Educação Infantil', route: '/educacao-infantil' },
        { label: 'Ensino Fundamental I', route: '/ensino-fundamental-1' },
        { label: 'Ensino Fundamental II', route: '/ensino-fundamental-2' },
        { label: 'Ensino Médio', route: '/ensino-medio' },
      ],
    },
  ],
  legal_links: [
    { label: 'Política de Privacidade', route: '/politica-privacidade' },
    { label: 'Termos de Uso', route: '/termos-de-uso' },
  ],
  copyright_text: 'Todos os direitos reservados.',
  show_cnpj: true,
};

function parseFooter(raw: unknown): FooterConfig {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    columns: Array.isArray(obj.columns) ? (obj.columns as FooterColumn[]) : DEFAULT_FOOTER.columns,
    legal_links: Array.isArray(obj.legal_links) ? (obj.legal_links as FooterConfig['legal_links']) : DEFAULT_FOOTER.legal_links,
    copyright_text: (obj.copyright_text as string) || DEFAULT_FOOTER.copyright_text,
    show_cnpj: typeof obj.show_cnpj === 'boolean' ? obj.show_cnpj : DEFAULT_FOOTER.show_cnpj,
  };
}

// ── Component ──

export default function Footer() {
  const { settings: generalSettings } = useSettings('general');
  const { settings: navSettings } = useSettings('navigation');
  const { identity } = useBranding();

  const footerConfig = parseFooter(navSettings.footer);

  const schoolName = identity.school_name || (generalSettings.school_name as string) || 'Colégio Batista em Caruaru';
  const cnpj       = identity.cnpj || (generalSettings.cnpj as string) || '01.873.279/0002-61';
  const phone      = (generalSettings.phone as string) || '(81) 3721-4787';

  const { line1: addrLine1, line2: addrLine2 } = formatAddress(generalSettings.address)
    || formatAddress('Rua Marcílio Dias, 99 - São Francisco, Caruaru/PE');

  const socialNetworks = parseSocialNetworks(generalSettings.social_networks);
  const businessHoursLines = buildBusinessHoursLines(generalSettings.business_hours);

  return (
    <footer className="bg-brand-primary text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Contact column — always first */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Contato</h3>
            <ul className="space-y-2">
              <li className="flex items-center">
                <Phone size={16} className="mr-2" />
                {phone}
              </li>
              <li className="flex items-start">
                <MapPin size={16} className="mr-2 mt-1 shrink-0" />
                <span>
                  {addrLine1}
                  {addrLine2 && <><br />{addrLine2}</>}
                </span>
              </li>
            </ul>
            {businessHoursLines.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center mb-2 text-white/90">
                  <Clock size={16} className="mr-2" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Horários de funcionamento</span>
                </div>
                <ul className="space-y-1 text-sm opacity-90">
                  {businessHoursLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Dynamic columns from settings */}
          {footerConfig.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xl font-semibold mb-4">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.route}>
                    <Link to={link.route} className="hover:text-brand-secondary transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Social networks column */}
          {socialNetworks.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Redes Sociais</h3>
              <div className="flex flex-wrap gap-4">
                {socialNetworks.map((entry) => (
                  <a
                    key={entry.id}
                    href={buildSocialUrl(entry)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={entry.network}
                    className="hover:text-brand-secondary transition-colors"
                  >
                    <SocialIcon network={entry.network} size={24} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm opacity-80">
          <p>&copy; {new Date().getFullYear()} {schoolName}. {footerConfig.copyright_text}</p>
          {footerConfig.show_cnpj && <p className="mt-1">CNPJ: {cnpj}</p>}
          {footerConfig.legal_links.length > 0 && (
            <div className="mt-3 flex items-center justify-center gap-4">
              {footerConfig.legal_links.map((link, idx) => (
                <span key={link.route} className="contents">
                  {idx > 0 && <span className="text-white/30">|</span>}
                  <Link to={link.route} className="hover:text-brand-secondary transition-colors">
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
