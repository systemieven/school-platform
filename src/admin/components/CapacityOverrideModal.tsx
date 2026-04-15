/**
 * CapacityOverrideModal — autoriza ou bloqueia inserção/movimentação de aluno
 * para uma turma cheia.
 *
 * Usado pelo trigger `check_class_capacity` (migration 62). Quando o backend
 * dispara o erro `capacity_exceeded`, o frontend captura, parseia o HINT
 * (`class:<uuid> current:<n> max:<n>`) e abre este modal.
 *
 * - Coordenadores e teachers veem mensagem de bloqueio ("peça a um admin").
 * - Admin/super_admin veem botão "Autorizar e adicionar" que dispara o callback
 *   `onConfirm`, que normalmente reexecuta a operação via RPC
 *   `create_student_with_capacity` com `force=true`.
 *
 * O componente é puramente apresentacional — quem reexecuta a operação é
 * o caller via callback `onConfirm`.
 */

import { AlertTriangle, X, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  /** É admin ou super_admin? Define se o botão de autorizar aparece. */
  canOverride: boolean;
  className?: string;
  /** Contagem atual de alunos na turma (do HINT do erro). */
  currentCount: number;
  /** max_students da turma. */
  maxStudents: number;
}

export default function CapacityOverrideModal({
  open,
  onClose,
  onConfirm,
  canOverride,
  className,
  currentCount,
  maxStudents,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleConfirm() {
    setError('');
    setConfirming(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autorizar override.');
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white">Turma cheia</h2>
            <p className="text-xs text-amber-50/90 truncate">
              {className ? `${className} · ` : ''}{currentCount} de {maxStudents} vagas ocupadas
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={confirming}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {canOverride ? (
            <>
              <div className="flex gap-3 items-start">
                <ShieldCheck className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Como administrador, você pode autorizar este aluno acima do limite
                  da turma. A ação ficará registrada nos logs de auditoria com seu
                  nome e a contagem no momento da autorização.
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3 text-xs text-amber-800 dark:text-amber-200">
                Capacidade atual: <strong>{currentCount}/{maxStudents}</strong>.
                Após autorizar: <strong>{currentCount + 1}/{maxStudents}</strong>.
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3 items-start">
                <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Esta turma já atingiu o limite de <strong>{maxStudents} alunos</strong>.
                  Apenas administradores podem autorizar a inclusão acima da capacidade.
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-600 dark:text-gray-400">
                Peça a um administrador para autorizar este lançamento, ou escolha
                outra turma.
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={confirming}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {canOverride ? 'Cancelar' : 'Voltar'}
            </button>
            {canOverride && (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
              >
                {confirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {confirming ? 'Autorizando…' : 'Autorizar e adicionar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tenta extrair `current` e `max` do HINT do erro `capacity_exceeded`.
 * Retorna null se não for um erro de capacidade.
 *
 * Formato esperado do HINT (definido em check_class_capacity):
 *   "class:<uuid> current:<n> max:<n>"
 */
export function parseCapacityError(err: unknown): {
  classId: string;
  current: number;
  max: number;
} | null {
  if (!err || typeof err !== 'object') return null;

  const e = err as { message?: string; hint?: string; details?: string };
  const isCapacity =
    e.message === 'capacity_exceeded' ||
    e.message?.includes('capacity_exceeded') ||
    (typeof e.hint === 'string' && e.hint.startsWith('class:'));

  if (!isCapacity) return null;

  const hint = e.hint ?? '';
  const m = hint.match(/class:([^ ]+)\s+current:(\d+)\s+max:(\d+)/);
  if (!m) return null;

  return {
    classId: m[1],
    current: Number(m[2]),
    max: Number(m[3]),
  };
}
