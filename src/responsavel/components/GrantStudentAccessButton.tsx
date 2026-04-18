/**
 * GrantStudentAccessButton — botão usado pelo responsável autenticado para
 * liberar/renovar o acesso do aluno ao Portal do Aluno (PRD §10.20).
 *
 * Chama a edge function `student-grant-access` (verify_jwt=true), que:
 *  - valida que o caller é guardian deste aluno (student_guardians)
 *  - cria ou reseta o auth user do aluno + must_change_password=true
 *  - dispara WhatsApp com a senha provisória para o telefone do RESPONSÁVEL
 *  - aplica rate-limit (3/student/h, 5/guardian/h) e audita em
 *    student_access_attempts (channel='guardian_grant')
 *
 * O botão segue o mesmo contrato visual de outros gates do portal:
 * idle → loading (Loader2) → estado pós-resposta (sucesso/erro/info)
 * com mensagem inline auto-dispensada após 6s.
 */
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, KeyRound, Send, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface Props {
  studentId: string;
  studentName?: string;
  variant?: 'card' | 'inline';
  /** Quando true, renderiza copy de "primeiro acesso"; senão "reenviar senha". */
  isFirstAccessHint?: boolean;
  className?: string;
}

type ResponseStatus =
  | 'sent'
  | 'no_guardian_phone'
  | 'no_whatsapp'
  | 'rate_limited'
  | 'unauthorized'
  | 'error';

interface StatusMessage {
  status: ResponseStatus;
  message: string;
}

export default function GrantStudentAccessButton({
  studentId,
  studentName,
  variant = 'card',
  isFirstAccessHint = true,
  className = '',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<StatusMessage | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      const systemUrl = window.location.origin + '/portal/login';
      const { data, error } = await supabase.functions.invoke('student-grant-access', {
        body: { student_id: studentId, system_url: systemUrl },
      });

      if (error) {
        setFeedback({
          status: 'error',
          message: 'Não foi possível liberar o acesso. Tente novamente em alguns instantes.',
        });
      } else {
        const payload = (data ?? {}) as {
          status?: ResponseStatus;
          message?: string;
        };
        setFeedback({
          status: payload.status ?? 'error',
          message:
            payload.message ??
            (payload.status === 'sent'
              ? 'Senha provisória enviada para o seu WhatsApp.'
              : 'Não foi possível concluir.'),
        });
      }
    } catch (err) {
      setFeedback({
        status: 'error',
        message: err instanceof Error ? err.message : 'Erro inesperado.',
      });
    } finally {
      setLoading(false);
      // auto-clear depois de 8s para permitir nova tentativa visual
      setTimeout(() => setFeedback(null), 8000);
    }
  }

  const ctaLabel = isFirstAccessHint
    ? 'Liberar acesso ao aluno'
    : 'Reenviar senha do aluno';

  // ── feedback color tokens ──────────────────────────────────────────────────
  const tone = (() => {
    if (!feedback) return null;
    if (feedback.status === 'sent') {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        Icon: CheckCircle2,
      };
    }
    if (feedback.status === 'rate_limited' || feedback.status === 'no_whatsapp' ||
        feedback.status === 'no_guardian_phone') {
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-700 dark:text-amber-300',
        Icon: Info,
      };
    }
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      Icon: AlertCircle,
    };
  })();

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Enviando…
        </>
      ) : (
        <>
          {isFirstAccessHint ? <KeyRound className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {ctaLabel}
        </>
      )}
    </button>
  );

  if (variant === 'inline') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {button}
        {feedback && tone && (
          <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${tone.bg} ${tone.text}`}>
            <tone.Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{feedback.message}</span>
          </div>
        )}
      </div>
    );
  }

  // variant 'card'
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-xl bg-brand-primary/10 dark:bg-brand-secondary/10 flex items-center justify-center flex-shrink-0">
          <KeyRound className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Acesso ao Portal do Aluno
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isFirstAccessHint
              ? `Crie uma senha provisória para ${studentName ?? 'o aluno'} entrar no Portal do Aluno. Ela vai chegar no seu WhatsApp.`
              : `Reenvie uma nova senha provisória de ${studentName ?? 'o aluno'} para o seu WhatsApp.`}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        {button}
      </div>

      {feedback && tone && (
        <div className={`mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${tone.bg} ${tone.text}`}>
          <tone.Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
