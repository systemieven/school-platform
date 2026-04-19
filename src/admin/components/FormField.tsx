/**
 * FormField — Primitivas de formulário compartilhadas (admin + site público).
 *
 * Visual universal: floating-label com cor dourada (brand-secondary) no foco,
 * borda `brand-primary` no foco, ícone leading opcional, slot direito opcional
 * (ex.: toggle "olho" em campo de senha), hint, counter e estado de erro.
 */
import React, { forwardRef, useId, useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, Check, ChevronDown, XCircle } from 'lucide-react';

// ── Constantes CSS canônicas (mantidas para compat) ──────────────────────────

export const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand-primary dark:focus:border-brand-secondary transition-colors';

export const LABEL_CLS =
  'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5';

export const HINT_CLS =
  'text-[11px] text-gray-400 dark:text-gray-500 mt-1';

export const SECTION_LABEL_CLS =
  'text-[11px] font-semibold tracking-[0.12em] uppercase text-brand-primary/50 dark:text-blue-400/60 flex items-center gap-1.5';

// ── FloatingShell ────────────────────────────────────────────────────────────
// Wrapper visual compartilhado por todos os campos: borda arredondada, label
// flutuante, ícone leading, slot direito. Cor da label flutuante vira dourada
// no foco; em erro, vermelha. Borda ganha `brand-primary` no foco.

type FloatingShellProps = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  rightSlot?: React.ReactNode;
  focused: boolean;
  filled: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

function FloatingShell({
  id,
  label,
  icon: Icon,
  rightSlot,
  focused,
  filled,
  disabled,
  error,
  className,
  children,
}: FloatingShellProps) {
  const floated = focused || filled;

  const borderCls = error
    ? 'border-red-400 dark:border-red-500/70'
    : focused
      ? 'border-brand-primary dark:border-brand-secondary'
      : 'border-gray-200 dark:border-gray-700';

  const labelColor = error
    ? 'text-red-500'
    : focused
      ? 'text-brand-secondary'
      : 'text-gray-500 dark:text-gray-400';

  const leftPadLabel = Icon ? 'left-10' : 'left-3';

  const labelPos = floated
    ? 'top-2 text-[10px] tracking-[0.08em] uppercase font-semibold'
    : 'top-1/2 -translate-y-1/2 text-sm font-normal';

  return (
    <div
      className={[
        'relative rounded-xl border bg-white dark:bg-gray-800 transition-colors',
        borderCls,
        disabled ? 'opacity-60' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {Icon && (
        <Icon
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
            focused ? 'text-brand-primary dark:text-brand-secondary' : 'text-gray-400'
          } transition-colors`}
        />
      )}
      <label
        htmlFor={id}
        className={`pointer-events-none absolute ${leftPadLabel} ${labelPos} ${labelColor} transition-all duration-150`}
      >
        {label}
      </label>
      {children}
      {rightSlot && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          {rightSlot}
        </div>
      )}
    </div>
  );
}

// CSS aplicado ao <input>/<select>/<textarea> dentro do FloatingShell.
const CONTROL_BASE =
  'peer w-full bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-transparent focus:placeholder:text-gray-300 dark:focus:placeholder:text-gray-600 focus:outline-none disabled:cursor-not-allowed';

function controlPadding(hasIcon: boolean, hasRight: boolean, tall = true) {
  const left = hasIcon ? 'pl-10' : 'pl-3';
  const right = hasRight ? 'pr-11' : 'pr-3';
  const vertical = tall ? 'pt-5 pb-1.5 h-[52px]' : 'py-2';
  return `${left} ${right} ${vertical}`;
}

// ── CharCounter ──────────────────────────────────────────────────────────────

function CharCounter({ current, max }: { current: number; max: number }) {
  const ratio = current / max;
  const color =
    ratio >= 1
      ? 'text-red-500'
      : ratio >= 0.9
        ? 'text-amber-500'
        : 'text-gray-400 dark:text-gray-500';

  return (
    <span className={`text-[11px] ${color} tabular-nums`}>
      {current}/{max}
    </span>
  );
}

// ── ErrorLine / FootLine ─────────────────────────────────────────────────────

function FootLine({
  error,
  hint,
  max,
  current,
}: {
  error?: string;
  hint?: string;
  max?: number;
  current?: number;
}) {
  if (error) {
    return (
      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
        <XCircle className="w-3 h-3 flex-shrink-0" /> {error}
      </p>
    );
  }
  if (!hint && max == null) return null;
  return (
    <div className="flex items-center justify-between mt-1">
      {hint ? <span className={HINT_CLS}>{hint}</span> : <span />}
      {max != null && current != null && <CharCounter current={current} max={max} />}
    </div>
  );
}

// ── InputField ───────────────────────────────────────────────────────────────

export interface InputFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'maxLength'> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  rightSlot?: React.ReactNode;
  hint?: string;
  error?: string;
  maxLength?: number;
  /**
   * Label flutuante (dentro da borda). Default: `false` — label externa em cima
   * do campo, padrão admin, alinhado com raw `<input className={INPUT_CLS}>`.
   * Setar `true` apenas no site público e LoginPage (experiência mais imersiva).
   */
  floating?: boolean;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  function InputField(
    { label, icon, rightSlot, hint, error, maxLength, className, id, onFocus, onBlur, floating, ...rest },
    ref,
  ) {
    const reactId = useId();
    const inputId = id ?? reactId;
    const [focused, setFocused] = useState(false);
    const value = typeof rest.value === 'string' ? rest.value : '';
    const filled = value.length > 0 || !!rest.defaultValue;

    // ── Modo padrão (admin): label externa, altura compacta, alinhada com INPUT_CLS
    if (!floating) {
      const Icon = icon;
      const borderErr = error ? ' border-red-400' : '';
      const padLeft = Icon ? ' pl-9' : '';
      const padRight = rightSlot ? ' pr-10' : '';
      return (
        <div>
          <label htmlFor={inputId} className={LABEL_CLS}>{label}</label>
          <div className="relative">
            {Icon && (
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            )}
            <input
              ref={ref}
              id={inputId}
              maxLength={maxLength}
              onFocus={(e) => { setFocused(true); onFocus?.(e); }}
              onBlur={(e) => { setFocused(false); onBlur?.(e); }}
              className={`${INPUT_CLS}${padLeft}${padRight}${borderErr}${className ? ` ${className}` : ''}`}
              {...rest}
            />
            {rightSlot && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                {rightSlot}
              </div>
            )}
          </div>
          <FootLine error={error} hint={hint} max={maxLength} current={value.length} />
        </div>
      );
    }

    // ── Modo floating (site público + login): label dentro, altura maior
    return (
      <div>
        <FloatingShell
          id={inputId}
          label={label}
          icon={icon}
          rightSlot={rightSlot}
          focused={focused}
          filled={filled}
          disabled={rest.disabled}
          error={error}
        >
          <input
            ref={ref}
            id={inputId}
            maxLength={maxLength}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            className={`${CONTROL_BASE} ${controlPadding(!!icon, !!rightSlot)}${className ? ` ${className}` : ''}`}
            {...rest}
          />
        </FloatingShell>
        <FootLine error={error} hint={hint} max={maxLength} current={value.length} />
      </div>
    );
  },
);

// ── TextareaField ────────────────────────────────────────────────────────────

export interface TextareaFieldProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'maxLength'> {
  label: string;
  hint?: string;
  error?: string;
  maxLength?: number;
  /** Label dentro da borda. Default `false` (externa, padrão admin). */
  floating?: boolean;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
    { label, hint, error, maxLength, className, id, onFocus, onBlur, floating, ...rest },
    ref,
  ) {
    const reactId = useId();
    const inputId = id ?? reactId;
    const [focused, setFocused] = useState(false);
    const value = typeof rest.value === 'string' ? rest.value : '';

    // ── Modo padrão (admin): label externa
    if (!floating) {
      const borderErr = error ? ' border-red-400' : '';
      return (
        <div>
          <label htmlFor={inputId} className={LABEL_CLS}>{label}</label>
          <textarea
            ref={ref}
            id={inputId}
            maxLength={maxLength}
            rows={rest.rows ?? 3}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            className={`${INPUT_CLS} resize-none${borderErr}${className ? ` ${className}` : ''}`}
            {...rest}
          />
          <FootLine error={error} hint={hint} max={maxLength} current={value.length} />
        </div>
      );
    }

    // ── Modo floating (site público + login)
    const borderCls = error
      ? 'border-red-400 dark:border-red-500/70'
      : focused
        ? 'border-brand-primary dark:border-brand-secondary'
        : 'border-gray-200 dark:border-gray-700';
    const labelColor = error
      ? 'text-red-500'
      : focused
        ? 'text-brand-secondary'
        : 'text-gray-500 dark:text-gray-400';

    return (
      <div>
        <div className={`relative rounded-xl border bg-white dark:bg-gray-800 transition-colors ${borderCls}`}>
          <label
            htmlFor={inputId}
            className={`pointer-events-none absolute left-3 top-2 text-[10px] tracking-[0.08em] uppercase font-semibold ${labelColor} transition-colors`}
          >
            {label}
          </label>
          <textarea
            ref={ref}
            id={inputId}
            maxLength={maxLength}
            rows={rest.rows ?? 3}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            className={`${CONTROL_BASE} px-3 pt-6 pb-2 resize-none${className ? ` ${className}` : ''}`}
            {...rest}
          />
        </div>
        <FootLine error={error} hint={hint} max={maxLength} current={value.length} />
      </div>
    );
  },
);

// ── SelectField ──────────────────────────────────────────────────────────────
// Label EXTERNA (padrão admin): o admin mistura raw `<input className={INPUT_CLS}>`
// com Selects em grids — manter label externa evita desalinhamento vertical.

export interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function SelectField({
  label,
  hint,
  error,
  children,
  className,
  id,
  ...rest
}: SelectFieldProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  return (
    <div>
      <label htmlFor={inputId} className={LABEL_CLS}>{label}</label>
      <select
        id={inputId}
        className={`${INPUT_CLS}${error ? ' border-red-400' : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {children}
      </select>
      <FootLine error={error} hint={hint} />
    </div>
  );
}

// ── SelectDropdown ───────────────────────────────────────────────────────────
// Wrapper em torno de <select> nativo, com chevron e ícone opcional.
// Label externa (compatível com padrões do admin).

export interface SelectDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  children: React.ReactNode;
}

export function SelectDropdown({
  label,
  icon,
  hint,
  error,
  children,
  className,
  wrapperClassName,
  id,
  ...rest
}: SelectDropdownProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  return (
    <div className={wrapperClassName}>
      {label && <label htmlFor={inputId} className={LABEL_CLS}>{label}</label>}
      <div className="relative">
        {icon &&
          React.createElement(icon, {
            className:
              'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none',
          })}
        <select
          id={inputId}
          className={`${INPUT_CLS} pr-8 appearance-none${icon ? ' pl-9' : ''}${error ? ' border-red-400' : ''}${className ? ` ${className}` : ''}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      <FootLine error={error} hint={hint} />
    </div>
  );
}

// ── SearchableSelect ─────────────────────────────────────────────────────────
// Dropdown com busca integrada — ideal para listas longas.

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export function SearchableSelect({
  label,
  icon,
  hint,
  error,
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  disabled = false,
  id,
}: SearchableSelectProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';
  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle() {
    if (disabled) return;
    setOpen((v) => !v);
    setSearch('');
  }

  function select(val: string) {
    onChange(val);
    setOpen(false);
    setSearch('');
  }

  const filled = !!value;

  return (
    <div ref={containerRef}>
      {label && <label htmlFor={inputId} className={LABEL_CLS}>{label}</label>}
      <div className="relative">
        {icon &&
          React.createElement(icon, {
            className:
              'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10',
          })}
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={toggle}
          className={`${INPUT_CLS} pr-8 text-left flex items-center gap-2${icon ? ' pl-9' : ''}${error ? ' border-red-400' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className={`truncate ${filled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown className="ml-auto w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400 text-center">Nenhum resultado</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => select(o.value)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                        o.value === value
                          ? 'bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-secondary font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${o.value === value ? 'opacity-100' : 'opacity-0'}`}
                      />
                      {o.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      <FootLine error={error} hint={hint} />
    </div>
  );
}

// ── SectionLabel ─────────────────────────────────────────────────────────────

export interface SectionLabelProps {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

export function SectionLabel({ icon: Icon, children }: SectionLabelProps) {
  return (
    <p className={SECTION_LABEL_CLS}>
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      {children}
    </p>
  );
}

// ── SectionDivider ───────────────────────────────────────────────────────────

export function SectionDivider() {
  return <hr className="border-gray-100 dark:border-gray-700/40" />;
}

// ── ArrayItemCard ────────────────────────────────────────────────────────────

export interface ArrayItemCardProps {
  /** 1-based index displayed as a badge */
  index: number;
  onRemove: () => void;
  children: React.ReactNode;
}

export function ArrayItemCard({ index, onRemove, children }: ArrayItemCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700/40">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-brand-primary/10 text-brand-primary text-[10px] font-bold">
          {index}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
          title="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

// ── AddButton ────────────────────────────────────────────────────────────────

export interface AddButtonProps {
  label: string;
  onClick: () => void;
}

export function AddButton({ label, onClick }: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-primary border border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-primary/40 rounded-xl px-3 py-2 transition-colors"
    >
      <Plus className="w-4 h-4" />
      {label}
    </button>
  );
}

// ── RemoveButton ─────────────────────────────────────────────────────────────

export interface RemoveButtonProps {
  onClick: () => void;
}

export function RemoveButton({ onClick }: RemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
      title="Remover"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
