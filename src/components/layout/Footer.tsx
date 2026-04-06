import { Link } from 'react-router-dom';
import { Phone, MapPin, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#003876] text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12">
          <div>
            <h3 className="text-xl font-semibold mb-4">Contato</h3>
            <ul className="space-y-2">
              <li className="flex items-center">
                <Phone size={16} className="mr-2" />
                (81) 3721-4787
              </li>
              <li className="flex items-start">
                <MapPin size={16} className="mr-2 mt-1 shrink-0" />
                <span>Rua Marcílio Dias, 99<br />São Francisco, Caruaru/PE</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Links Rápidos</h3>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-[#ffd700] transition-colors">Portal do Aluno</a></li>
              <li><Link to="/biblioteca-virtual" className="hover:text-[#ffd700] transition-colors">Biblioteca Virtual</Link></li>
              <li><a href="#" className="hover:text-[#ffd700] transition-colors">Área do Professor</a></li>
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
                className="hover:text-[#ffd700] transition-colors"
              >
                <Instagram size={24} />
                <span className="sr-only">Instagram</span>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm opacity-80">
          <p>&copy; {new Date().getFullYear()} Colégio Batista em Caruaru. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
