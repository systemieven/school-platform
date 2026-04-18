import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { TOPBAR_ICONS, getTopBarIcon } from '../../shared/topBarIcons';

interface Props {
  label?: string;
  value: string | null | undefined;
  onChange: (key: string | null) => void;
}

export default function TopBarIconPicker({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const Current = getTopBarIcon(value);
  const currentLabel = value
    ? TOPBAR_ICONS.find((o) => o.key === value)?.label ?? value
    : 'Nenhum (so texto)';

  return (
    <div ref={rootRef} className="relative">
      {label && (
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 hover:border-brand-primary/50 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          {Current ? (
            <Current className="w-4 h-4 flex-shrink-0 text-brand-primary" />
          ) : (
            <span className="w-4 h-4 flex-shrink-0 rounded-sm border border-dashed border-gray-300 dark:border-gray-600" />
          )}
          <span className="truncate">{currentLabel}</span>
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(null); } }}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              title="Remover icone"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
              !value
                ? 'bg-brand-primary/5 text-brand-primary dark:text-brand-secondary font-medium'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <span className="w-4 h-4 rounded-sm border border-dashed border-gray-300 dark:border-gray-600" />
            Nenhum (so texto)
          </button>
          <div className="max-h-64 overflow-y-auto grid grid-cols-4 gap-1 p-2 border-t border-gray-100 dark:border-gray-700/40">
            {TOPBAR_ICONS.map((opt) => {
              const Icon = opt.icon;
              const active = opt.key === value;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { onChange(opt.key); setOpen(false); }}
                  title={opt.label}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
                    active
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] leading-tight truncate w-full text-center">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
