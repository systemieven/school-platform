import { Link } from 'react-router-dom';
import { Monitor, ExternalLink } from 'lucide-react';

export default function PDVTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
        <Monitor className="w-8 h-8 text-brand-primary" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Ponto de Venda</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          O PDV funciona em tela cheia para melhor experiência de atendimento no caixa.
        </p>
      </div>
      <Link
        to="/admin/loja/pdv"
        className="flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl font-medium text-sm transition-colors"
      >
        <Monitor className="w-4 h-4" />
        Abrir PDV em Tela Cheia
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </Link>
    </div>
  );
}
