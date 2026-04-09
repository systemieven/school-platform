import { Link } from 'react-router-dom';
import { Phone, MapPin, Instagram } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

const FB_HREF = 'https://www.facebook.com/colegiobatistacaruarupe/?locale=pt_BR';

export default function Footer() {
  const { settings } = useSettings('general');

  const schoolName = (settings.school_name as string) || 'Colégio Batista em Caruaru';
  const cnpj       = (settings.cnpj       as string) || '01.873.279/0002-61';
  const phone      = (settings.phone      as string) || '(81) 3721-4787';
  const address    = (settings.address    as string) || 'Rua Marcílio Dias, 99 - São Francisco, Caruaru/PE';

  // whatsapp can be stored as a full number (5581999...) or with formatting
  const rawWa  = (settings.whatsapp as string) || '5581991398203';
  const waNum  = rawWa.replace(/\D/g, '');
  const waHref = `https://wa.me/${waNum}?text=Olá, vim do site e queria mais informações`;

  // Split address into two lines at the first " - " or ","
  const [addrLine1, addrLine2] = (() => {
    const sep = address.includes(' - ') ? ' - ' : ', ';
    const idx = address.indexOf(sep);
    if (idx === -1) return [address, ''];
    return [address.slice(0, idx), address.slice(idx + sep.length)];
  })();

  return (
    <footer className="bg-[#003876] text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12">
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
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Links Rápidos</h3>
            <ul className="space-y-2">
              <li><Link to="/portal-aluno" className="hover:text-[#ffd700] transition-colors">Portal do Aluno</Link></li>
              <li><Link to="/biblioteca-virtual" className="hover:text-[#ffd700] transition-colors">Biblioteca Virtual</Link></li>
              <li><Link to="/area-professor" className="hover:text-[#ffd700] transition-colors">Área do Professor</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Segmentos</h3>
            <ul className="space-y-2">
              <li><Link to="/educacao-infantil" className="hover:text-[#ffd700] transition-colors">Educação Infantil</Link></li>
              <li><Link to="/ensino-fundamental-1" className="hover:text-[#ffd700] transition-colors">Ensino Fundamental I</Link></li>
              <li><Link to="/ensino-fundamental-2" className="hover:text-[#ffd700] transition-colors">Ensino Fundamental II</Link></li>
              <li><Link to="/ensino-medio" className="hover:text-[#ffd700] transition-colors">Ensino Médio</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Redes Sociais</h3>
            <div className="flex space-x-4">
              <a
                href="https://instagram.com/colegiobatistacaruarupe"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="hover:text-[#ffd700] transition-colors"
              >
                <Instagram size={24} />
              </a>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="hover:text-[#ffd700] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
              <a
                href={FB_HREF}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="hover:text-[#ffd700] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm opacity-80">
          <p>&copy; {new Date().getFullYear()} {schoolName}. Todos os direitos reservados.</p>
          <p className="mt-1">CNPJ: {cnpj}</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <Link to="/politica-privacidade" className="hover:text-[#ffd700] transition-colors">Política de Privacidade</Link>
            <span className="text-white/30">|</span>
            <Link to="/termos-de-uso" className="hover:text-[#ffd700] transition-colors">Termos de Uso</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
