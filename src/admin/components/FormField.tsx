/**
 * FormField — Primitivas de formulário compartilhadas para os painéis de configuração.
 *
 * Substitui os `inputCls`/`labelCls` locais duplicados em cada painel com componentes
 * ricos: ícone leading, hint, counter de caracteres, dark mode completo.
 */
import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { Plus, Trash2, AlignJustify, Search, Check, ChevronDown } from 'lucide-react';

// ── Constantes CSS canônicas ─────────────────────────────────────────────────

export const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors';

export const LABEL_CLS =
  'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5';

export const HINT_CLS =
  'text-[11px] text-gray-400 dark:text-gray-500 mt-1';

export const SECTION_LABEL_CLS =
  'text-[11px] font-semibold tracking-[0.12em] uppercase text-brand-primary/50 dark:text-blue-400/60 flex items-center gap-1.5';

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

// ── InputField ───────────────────────────────────────────────────────────────

export interface InputFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'maxLength'> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  maxLength?: number;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  function InputField({ label, icon: Icon, hint, maxLength, className, ...rest }, ref) {
    const value = typeof rest.value === 'string' ? rest.value : '';
    const len = value.length;

    return (
      <div>
        <label className={LABEL_CLS}>{label}</label>
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          )}
          <input
            ref={ref}
            maxLength={maxLength}
            className={`${INPUT_CLS}${Icon ? ' pl-9' : ''}${className ? ` ${className}` : ''}`}
            {...rest}
          />
        </div>
        {(hint || maxLength) && (
          <div className="flex items-center justify-between mt-1">
            {hint ? <span className={HINT_CLS}>{hint}</span> : <span />}
            {maxLength != null && <CharCounter current={len} max={maxLength} />}
          </div>
        )}
      </div>
    );
  },
);

// ── TextareaField ────────────────────────────────────────────────────────────

export interface TextareaFieldProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'maxLength'> {
  label: string;
  hint?: string;
  maxLength?: number;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField({ label, hint, maxLength, className, ...rest }, ref) {
    const value = typeof rest.value === 'string' ? rest.value : '';
    const len = value.length;

    return (
      <div>
        <label className={LABEL_CLS}>{label}</label>
        <textarea
          ref={ref}
          maxLength={maxLength}
          rows={rest.rows ?? 2}
          className={`${INPUT_CLS} resize-none${className ? ` ${className}` : ''}`}
          {...rest}
        />
        {(hint || maxLength) && (
          <div className="flex items-center justify-between mt-1">
            {hint ? <span className={HINT_CLS}>{hint}</span> : <span />}
            {maxLength != null && <CharCounter current={len} max={maxLength} />}
          </div>
        )}
      </div>
    );
  },
);

// ── SelectField ──────────────────────────────────────────────────────────────

export interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function SelectField({ label, hint, children, className, ...rest }: SelectFieldProps) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <select className={`${INPUT_CLS}${className ? ` ${className}` : ''}`} {...rest}>
        {children}
      </select>
      {hint && <p className={HINT_CLS}>{hint}</p>}
    </div>
  );
}

// ── SelectDropdown ───────────────────────────────────────────────────────────
export interface SelectDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  wrapperClassName?: string;
  children: React.ReactNode;
}

export function SelectDropdown({ label, hint, children, className, wrapperClassName, ...rest }: SelectDropdownProps) {
  return (
    <div className={wrapperClassName}>
      {label && <label className={LABEL_CLS}>{label}</label>}
      <div className="relative">
        <AlignJustify className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <select
          className={`${INPUT_CLS} pl-9 pr-8 appearance-none${className ? ` ${className}` : ''}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      {hint && <p className={HINT_CLS}>{hint}</p>}
    </div>
  );
}

// ── SearchableSelect ─────────────────────────────────────────────────────────
// Dropdown com campo de busca integrado — ideal para listas longas (alunos,
// responsáveis, turmas, professores). Substitui SelectDropdown quando o array
// de opções pode ter dezenas ou centenas de itens.

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  label?: string;
  hint?: string;
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
  hint,
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  disabled = false,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fecha ao clicar fora
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

  // Foca o campo de busca ao abrir
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

  return (
    <div>
      {label && <label htmlFor={id} className={LABEL_CLS}>{label}</label>}
      <div ref={containerRef} className="relative">
        {/* Trigger — visual idêntico ao SelectDropdown */}
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={toggle}
          className={`${INPUT_CLS} pl-9 text-left flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <AlignJustify className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none flex-shrink-0" />
          <span className={`truncate ${value ? '' : 'text-gray-400 dark:text-gray-500'}`}>
            {selectedLabel || placeholder}
          </span>
        </button>

        {/* Painel de opções */}
        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
            {/* Campo de busca */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
            </div>

            {/* Lista filtrada */}
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400 text-center">Nenhum resultado</li>
              ) : filtered.map((o) => (
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
                    <Check className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${o.value === value ? 'opacity-100' : 'opacity-0'}`} />
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {hint && <p className={HINT_CLS}>{hint}</p>}
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
      {/* Header */}
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
      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {children}
      </div>
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
