/**
 * PasswordCriteriaChecker
 *
 * Shows a live checklist of password strength criteria based on the
 * active PasswordPolicy fetched from system_settings.
 *
 * Usage:
 *   <PasswordCriteriaChecker password={value} policy={policy} />
 */
import { Check, X } from 'lucide-react';
import type { PasswordPolicy } from '../types/admin.types';

interface Criterion {
  key: string;
  label: string;
  test: (pw: string) => boolean;
  /** Only render this criterion if the policy demands it */
  active: boolean;
}

interface Props {
  password: string;
  policy: PasswordPolicy;
}

export function PasswordCriteriaChecker({ password, policy }: Props) {
  const criteria: Criterion[] = [
    {
      key: 'length',
      label: `Mínimo de ${policy.min_length} caracteres`,
      test: (pw: string) => pw.length >= policy.min_length,
      active: true,
    },
    {
      key: 'uppercase',
      label: 'Letra maiúscula (A–Z)',
      test: (pw: string) => /[A-Z]/.test(pw),
      active: policy.require_uppercase,
    },
    {
      key: 'lowercase',
      label: 'Letra minúscula (a–z)',
      test: (pw: string) => /[a-z]/.test(pw),
      active: policy.require_lowercase,
    },
    {
      key: 'number',
      label: 'Número (0–9)',
      test: (pw: string) => /[0-9]/.test(pw),
      active: policy.require_numbers,
    },
    {
      key: 'special',
      label: 'Caractere especial (!@#$…)',
      test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
      active: policy.require_special,
    },
  ].filter((c) => c.active);

  if (criteria.length === 0) return null;

  return (
    <ul className="space-y-1.5 mt-2">
      {criteria.map((c) => {
        const ok = password.length > 0 && c.test(password);
        const pending = password.length === 0;
        return (
          <li key={c.key} className="flex items-center gap-2 text-xs">
            <span
              className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                pending
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                  : ok
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-500'
              }`}
            >
              {ok ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
            </span>
            <span
              className={
                pending
                  ? 'text-gray-400 dark:text-gray-500'
                  : ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              }
            >
              {c.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Returns true when the password satisfies ALL active criteria. */
export function passwordMeetsCriteria(password: string, policy: PasswordPolicy): boolean {
  if (password.length < policy.min_length) return false;
  if (policy.require_uppercase && !/[A-Z]/.test(password)) return false;
  if (policy.require_lowercase && !/[a-z]/.test(password)) return false;
  if (policy.require_numbers  && !/[0-9]/.test(password)) return false;
  if (policy.require_special  && !/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}
