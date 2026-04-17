/**
 * FormField — Primitivas de formulário compartilhadas para os painéis de configuração.
 *
 * Substitui os `inputCls`/`labelCls` locais duplicados em cada painel com componentes
 * ricos: ícone leading, hint, counter de caracteres, dark mode completo.
 */
import React, { forwardRef } from 'react';
import { AlignJustify, ChevronDown, Plus, Trash2 } from 'lucide-react';

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

// ─── SelectDropdown ──────────────────────────────────────────────────────────
interface SelectDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  /** Extra classes applied to the outer wrapper <div> (e.g. "mb-3"). */
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
