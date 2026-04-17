/**
 * OverdueContactsWidget
 *
 * Lista de contatos sem resposta há mais de N horas. Cada item
 * linka para o módulo de contatos. Mostra empty-state amigável
 * quando a lista está zerada.
 */
import { Link } from 'react-router-dom';
import { ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface OverdueContact {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  status: string;
}

export interface OverdueContactsWidgetProps {
  contacts: OverdueContact[];
  linkTo?: string;
  title?: string;
  emptyLabel?: string;
}

function hoursAgo(dateStr: string): string {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export function OverdueContactsWidget({
  contacts,
  linkTo = '/admin/contatos',
  title = 'Contatos pendentes',
  emptyLabel = 'Nenhum contato sem resposta',
}: OverdueContactsWidgetProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">{title}</h3>
          {contacts.length > 0 && (
            <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {contacts.length}
            </span>
          )}
        </div>
        <Link
          to={linkTo}
          className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1"
        >
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">{emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <Link
              key={c.id}
              to={linkTo}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            >
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.phone}</p>
              </div>
              <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 flex-shrink-0">
                {hoursAgo(c.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
