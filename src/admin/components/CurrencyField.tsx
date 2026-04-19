import { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { formatBRL, digitsToReais } from '../lib/currency';

interface CurrencyFieldProps {
  label: string;
  value: number | null | undefined;
  onChange: (next: number | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showIcon?: boolean;
  min?: number;
  max?: number;
  labelClassName?: string;
  inputClassName?: string;
  id?: string;
}

const DEFAULT_LABEL_CLS =
  'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5';
const DEFAULT_INPUT_CLS =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-brand-primary dark:focus:border-brand-secondary transition-colors';

/**
 * Input mascarado para valores em reais (R$).
 * Estado guarda `number` em reais; UI exibe "R$ 1.500,50".
 *
 * Uso típico em drawers admin:
 *   <CurrencyField
 *     label="Salário mínimo"
 *     value={form.salary_range_min}
 *     onChange={(v) => set('salary_range_min', v)}
 *     showIcon
 *   />
 */
export function CurrencyField({
  label,
  value,
  onChange,
  required,
  disabled,
  placeholder = 'R$ 0,00',
  showIcon,
  min = 0,
  max,
  labelClassName = DEFAULT_LABEL_CLS,
  inputClassName = DEFAULT_INPUT_CLS,
  id,
}: CurrencyFieldProps) {
  const display = useMemo(() => formatBRL(value), [value]);

  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {showIcon && <DollarSign className="w-3 h-3 inline mr-1" />}
        {label}
        {required && ' *'}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          let next = digitsToReais(e.target.value);
          if (next != null) {
            if (max != null && next > max) next = max;
            if (next < min) next = min;
            next = Number(next.toFixed(2));
          }
          onChange(next);
        }}
        className={inputClassName}
      />
    </div>
  );
}
