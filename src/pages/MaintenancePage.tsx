import { Phone, Mail, MessageCircle, Wrench } from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';
import { useSettings } from '../hooks/useSettings';

export default function MaintenancePage() {
  const { identity } = useBranding();
  const { settings } = useSettings('general');

  const phone     = (settings.phone     as string) || '';
  const whatsapp  = (settings.whatsapp  as string) || '';
  const email     = (settings.email     as string) || '';
  const message   = (settings.maintenance_message as string) || 'Estamos realizando melhorias no site. Voltaremos em breve!';

  const hasContact = phone || whatsapp || email;

  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">

        {/* Logo or fallback icon */}
        {identity.logo_url ? (
          <div className="inline-flex bg-white rounded-2xl p-4 shadow-lg">
            <img
              src={identity.logo_url}
              alt={identity.school_short_name || identity.school_name}
              className="h-20 w-auto object-contain"
            />
          </div>
        ) : (
          <div className="inline-flex bg-white/20 rounded-2xl p-5">
            <Wrench className="w-12 h-12 text-white" />
          </div>
        )}

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-3">Em Manutenção</h1>
          <p className="text-white/80 text-base leading-relaxed">{message}</p>
        </div>

        {/* Contact info */}
        {hasContact && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">
              Entre em contato
            </p>

            {phone && (
              <a
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="flex items-center gap-3 justify-center hover:text-white/70 transition-colors text-sm"
              >
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>{phone}</span>
              </a>
            )}

            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 justify-center hover:text-white/70 transition-colors text-sm"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span>{whatsapp}</span>
              </a>
            )}

            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-3 justify-center hover:text-white/70 transition-colors text-sm"
              >
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>{email}</span>
              </a>
            )}
          </div>
        )}

        {/* School name fallback */}
        {identity.school_name && (
          <p className="text-white/40 text-xs">
            {identity.school_name}
          </p>
        )}
      </div>
    </div>
  );
}
