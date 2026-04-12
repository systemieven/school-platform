import { Phone, MapPin } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

function formatAddress(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'object' && raw !== null) {
    const a = raw as Record<string, string>;
    return [
      a.rua,
      a.numero  && `, ${a.numero}`,
      a.bairro  && ` - ${a.bairro}`,
      a.cidade  && `, ${a.cidade}`,
      a.estado  && `/${a.estado}`,
    ].filter(Boolean).join('');
  }
  return String(raw);
}

export default function Header() {
  const { settings } = useSettings('general');

  const phone   = (settings.phone as string) || '(81) 3721-4787';
  const address = formatAddress(settings.address) || 'Rua Marcílio Dias, 99 - São Francisco, Caruaru/PE';

  return (
    <header className="bg-brand-primary text-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-2 text-sm">
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center">
              <Phone size={16} className="mr-2" />
              <span>{phone}</span>
            </div>
            <div className="flex items-center">
              <MapPin size={16} className="mr-2" />
              <span>{address}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
