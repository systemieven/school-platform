import { useState, useMemo, useRef, useEffect } from 'react';
import { icons, X } from 'lucide-react';

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
}

const ICON_OPTIONS: { name: string; label: string }[] = [
  // Academic
  { name: 'GraduationCap', label: 'Formatura' },
  { name: 'BookOpen', label: 'Livro Aberto' },
  { name: 'BookMarked', label: 'Livro Marcado' },
  { name: 'Book', label: 'Livro' },
  { name: 'Brain', label: 'Cérebro' },
  { name: 'Lightbulb', label: 'Ideia' },
  { name: 'Trophy', label: 'Troféu' },
  { name: 'Award', label: 'Prêmio' },
  { name: 'Star', label: 'Estrela' },
  { name: 'Target', label: 'Alvo' },
  { name: 'Rocket', label: 'Foguete' },
  { name: 'PenTool', label: 'Caneta' },
  { name: 'FileText', label: 'Documento' },
  { name: 'ClipboardList', label: 'Lista' },
  // People
  { name: 'Users', label: 'Pessoas' },
  { name: 'User', label: 'Pessoa' },
  { name: 'Baby', label: 'Bebê' },
  { name: 'Heart', label: 'Coração' },
  { name: 'HeartHandshake', label: 'Parceria' },
  { name: 'Hand', label: 'Mão' },
  { name: 'UserCheck', label: 'Verificado' },
  // Activities
  { name: 'Music', label: 'Música' },
  { name: 'Palette', label: 'Arte' },
  { name: 'Puzzle', label: 'Quebra-cabeça' },
  { name: 'Gamepad2', label: 'Jogos' },
  { name: 'Bike', label: 'Bicicleta' },
  { name: 'Volleyball', label: 'Vôlei' },
  { name: 'Drama', label: 'Teatro' },
  // Facilities
  { name: 'Building', label: 'Prédio' },
  { name: 'Building2', label: 'Edifício' },
  { name: 'Home', label: 'Casa' },
  { name: 'DoorOpen', label: 'Porta' },
  { name: 'Monitor', label: 'Tela' },
  { name: 'Microscope', label: 'Microscópio' },
  { name: 'Beaker', label: 'Laboratório' },
  { name: 'Laptop', label: 'Notebook' },
  // General
  { name: 'TreePine', label: 'Árvore' },
  { name: 'Sun', label: 'Sol' },
  { name: 'Globe', label: 'Globo' },
  { name: 'Compass', label: 'Bússola' },
  { name: 'Calendar', label: 'Calendário' },
  { name: 'Clock', label: 'Relógio' },
  { name: 'Shield', label: 'Escudo' },
  { name: 'Flag', label: 'Bandeira' },
  { name: 'MapPin', label: 'Local' },
  { name: 'Church', label: 'Igreja' },
  { name: 'Cross', label: 'Cruz' },
  { name: 'Sparkles', label: 'Brilho' },
];

export default function IconPicker({ value, onChange, label }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return ICON_OPTIONS;
    const q = search.toLowerCase();
    return ICON_OPTIONS.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.name.toLowerCase().includes(q)
    );
  }, [search]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const CurrentIcon = value ? icons[value as keyof typeof icons] : null;
  const currentLabel = ICON_OPTIONS.find((o) => o.name === value)?.label;

  return (
    <div className="relative">
      {label && (
        <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {label}
        </span>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all duration-200 ${
          value
            ? 'border-brand-primary/30 bg-brand-primary/5 text-brand-primary hover:bg-brand-primary/10'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-brand-primary/40 hover:bg-brand-primary/5'
        }`}
      >
        {CurrentIcon ? (
          <CurrentIcon className="w-4 h-4" />
        ) : (
          <span className="w-4 h-4 rounded border border-dashed border-gray-300 dark:border-gray-600" />
        )}
        <span className="text-xs">
          {currentLabel || 'Escolher ícone'}
        </span>
      </button>

      {/* Dialog overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div
            ref={dialogRef}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[90vw] max-w-md p-5 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Escolher ícone
              </h3>
              <button
                type="button"
                onClick={() => { setOpen(false); setSearch(''); }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ícone..."
              autoFocus
              className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-2.5 py-1.5 mb-3 w-full focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />

            {/* Icon grid */}
            <div className="grid grid-cols-8 gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {filtered.map((opt) => {
                const IconComponent = icons[opt.name as keyof typeof icons];
                if (!IconComponent) return null;

                const isSelected = value === opt.name;

                return (
                  <button
                    key={opt.name}
                    type="button"
                    title={opt.label}
                    onClick={() => {
                      onChange(opt.name);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      isSelected
                        ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20 ring-2 ring-brand-primary/30'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-brand-primary/10 hover:text-brand-primary'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-8 text-xs text-gray-400 text-center py-4">
                  Nenhum ícone encontrado
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
