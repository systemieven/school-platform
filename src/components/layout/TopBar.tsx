import { Link } from 'react-router-dom';

export default function TopBar() {
  return (
    <div className="bg-[#ffd700] text-[#003876] py-1">
      <div className="container mx-auto px-4">
        <div className="flex justify-end items-center space-x-4 text-sm">
          <Link to="/portal-aluno" className="hover:text-[#003876]/80 transition-colors">Portal do Aluno</Link>
          <Link to="/biblioteca-virtual" className="hover:text-[#003876]/80 transition-colors">Biblioteca Virtual</Link>
          <Link to="/area-professor" className="hover:text-[#003876]/80 transition-colors">Área do Professor</Link>
        </div>
      </div>
    </div>
  );
}
