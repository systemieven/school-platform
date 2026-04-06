import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <h1 className="text-6xl font-bold text-[#003876] mb-4">404</h1>
      <p className="text-xl text-gray-600 mb-8">Página não encontrada</p>
      <Link
        to="/"
        className="bg-[#003876] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#002855] transition-colors"
      >
        Voltar ao Início
      </Link>
    </div>
  );
}
