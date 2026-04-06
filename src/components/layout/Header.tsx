import { Phone, MapPin, Clock, Instagram } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-[#003876] text-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-2 text-sm">
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center">
              <Phone size={16} className="mr-2" />
              <span>(81) 3721-4787</span>
            </div>
            <div className="flex items-center">
              <MapPin size={16} className="mr-2" />
              <span>Rua Marcílio Dias, 99 - São Francisco, Caruaru/PE</span>
            </div>
            <div className="flex items-center">
              <Clock size={16} className="mr-2" />
              <span>Seg - Sex: 7h às 17h</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://instagram.com/colegiobatistacaruarupe"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#ffd700] transition-colors"
            >
              <Instagram size={20} />
              <span className="sr-only">Instagram</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
