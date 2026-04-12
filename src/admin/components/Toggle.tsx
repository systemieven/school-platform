/**
 * Toggle — canonical animated switch for the admin panel.
 *
 * Matches the w-12 h-6 style used in /admin/configuracoes:
 *   ● OFF: gray track, circle at left
 *   ● ON:  brand-blue track, circle at right with a checkmark inside
 *
 * Usage:
 *   <Toggle checked={value} onChange={setValue} label="Publicar" />
 *   <Toggle checked={value} onChange={setValue} />   // no label
 */

import { Check } from 'lucide-react';

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Optional text displayed to the right of the toggle */
  label?: string;
  /** Extra description line below the label */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Override the ON color (default: bg-brand-primary dark:bg-brand-secondary) */
  onColor?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  onColor,
}: ToggleProps) {
  const trackOn  = onColor ?? 'bg-brand-primary dark:bg-brand-secondary';
  const trackOff = 'bg-gray-300 dark:bg-gray-600';

  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} select-none`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50
          ${checked ? trackOn : trackOff}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md
            flex items-center justify-center transition-all duration-300
            ${checked ? 'translate-x-6' : 'translate-x-0'}`}
        >
          {checked && (
            <Check
              className="w-3 h-3 text-brand-primary dark:text-brand-primary"
              strokeWidth={3}
            />
          )}
        </span>
      </button>

      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-none">
              {label}
            </span>
          )}
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
      )}
    </label>
  );
}
