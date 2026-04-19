import { useState, useMemo } from 'react';
import { List } from 'lucide-react';

interface RoutePickerProps {
  value: string;
  onChange: (route: string) => void;
  label?: string;
  allowNull?: boolean;
  allowExternal?: boolean;
}

// Espelha src/App.tsx — TODAS as rotas aqui devem existir nele.
// Antes apontava para /portal-aluno, /area-professor e /biblioteca-virtual
// que NUNCA existiram no router (caiam no NotFound). Corrigido para
// rotas reais dos 3 portais + loja + atendimento.
const AVAILABLE_ROUTES = [
  { group: 'Institucional', routes: [
    { path: '/', label: 'Inicio' },
    { path: '/sobre', label: 'Sobre' },
    { path: '/estrutura', label: 'Estrutura' },
    { path: '/contato', label: 'Contato' },
    { path: '/agendar-visita', label: 'Agendar Visita' },
    { path: '/trabalhe-conosco', label: 'Trabalhe Conosco' },
  ]},
  { group: 'Segmentos', routes: [
    { path: '/educacao-infantil', label: 'Educacao Infantil' },
    { path: '/ensino-fundamental-1', label: 'Ensino Fundamental I' },
    { path: '/ensino-fundamental-2', label: 'Ensino Fundamental II' },
    { path: '/ensino-medio', label: 'Ensino Medio' },
  ]},
  { group: 'Matricula', routes: [
    { path: '/matricula', label: 'Matricula' },
  ]},
  { group: 'Loja', routes: [
    { path: '/loja', label: 'Loja' },
    { path: '/loja/carrinho', label: 'Carrinho' },
  ]},
  { group: 'Portais', routes: [
    { path: '/portal/login',       label: 'Portal do Aluno' },
    { path: '/responsavel/login',  label: 'Portal do Responsavel' },
  ]},
  { group: 'Atendimento', routes: [
    { path: '/atendimento', label: 'Atendimento (QR)' },
    { path: '/painel-atendimento', label: 'Painel de Atendimento (TV)' },
  ]},
  { group: 'Legal', routes: [
    { path: '/politica-privacidade', label: 'Politica de Privacidade' },
    { path: '/termos-de-uso', label: 'Termos de Uso' },
  ]},
];

const allKnownPaths = AVAILABLE_ROUTES.flatMap(g => g.routes.map(r => r.path));

const inputClassName =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary bg-white dark:bg-gray-800 dark:border-gray-700';

export default function RoutePicker({ value, onChange, label, allowNull }: RoutePickerProps) {
  const isKnown = useMemo(() => value === '' || allKnownPaths.includes(value), [value]);

  const [customMode, setCustomMode] = useState(() => {
    if (value && !allKnownPaths.includes(value)) return true;
    return false;
  });

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__custom__') {
      setCustomMode(true);
    } else {
      onChange(selected);
    }
  };

  const handleSwitchToSelect = () => {
    setCustomMode(false);
    if (!isKnown) {
      onChange('');
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {label}
        </label>
      )}

      {customMode ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className={inputClassName}
          />
          <button
            type="button"
            onClick={handleSwitchToSelect}
            className="flex-shrink-0 text-xs text-gray-400 hover:text-brand-primary flex items-center gap-1"
            title="Escolher rota"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={handleSelectChange}
          className={inputClassName}
        >
          {allowNull && (
            <option value="">Nenhuma (menu pai)</option>
          )}
          {AVAILABLE_ROUTES.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.routes.map((route) => (
                <option key={route.path} value={route.path}>
                  {route.label} ({route.path})
                </option>
              ))}
            </optgroup>
          ))}
          <option value="__custom__">URL personalizada…</option>
        </select>
      )}
    </div>
  );
}
