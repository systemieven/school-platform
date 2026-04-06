import { Link, useLocation } from 'react-router-dom';
import { HardHat, ArrowLeft } from 'lucide-react';

const PAGE_LABELS: Record<string, string> = {
  '/sobre': 'Sobre',
  '/estrutura': 'Estrutura',
  '/portal-aluno': 'Portal do Aluno',
  '/biblioteca-virtual': 'Biblioteca Virtual',
  '/area-professor': 'Área do Professor',
};

export default function EmConstrucao() {
  const { pathname } = useLocation();
  const pageLabel = PAGE_LABELS[pathname];

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-8">
          <div className="bg-[#003876] rounded-full p-6">
            <HardHat className="w-16 h-16 text-[#ffd700]" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-[#003876] mb-4">
          Em Construção
        </h1>

        {pageLabel && (
          <p className="text-lg text-gray-500 mb-2 font-medium">{pageLabel}</p>
        )}

        <p className="text-gray-600 mb-10">
          Esta página está sendo desenvolvida e em breve estará disponível.
          Fique atento às novidades!
        </p>

        <div className="w-full bg-gray-100 rounded-full h-2 mb-10">
          <div
            className="bg-[#ffd700] h-2 rounded-full"
            style={{ width: '35%' }}
          />
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-[#003876] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#002855] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}
