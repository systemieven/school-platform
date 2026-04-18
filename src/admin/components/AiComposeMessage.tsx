import { useEffect, useState } from 'react';
import { Loader2, Check, MessageCircle, Sparkles, RotateCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Drawer, DrawerCard } from './Drawer';

export interface ComposeContext {
  student_id?: string;
  guardian_id?: string;
  context_type: string;
  context_payload?: Record<string, unknown>;
  suggested_text?: string;
}

interface Props {
  context: ComposeContext;
  onClose: () => void;
}

export default function AiComposeMessage({ context, onClose }: Props) {
  const [draft, setDraft] = useState(context.suggested_text ?? '');
  const [generating, setGenerating] = useState(!context.suggested_text);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateDraft() {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: invErr } = await supabase.functions.invoke('ai-orchestrator', {
        body: {
          agent_slug: 'parent_communication',
          context: {
            context_type: context.context_type,
            student_id: context.student_id,
            guardian_id: context.guardian_id,
            ...(context.context_payload ?? {}),
          },
        },
      });
      if (invErr) throw invErr;
      const text = (data as { text?: string })?.text ?? '';
      try {
        const parsed = JSON.parse(text);
        setDraft(typeof parsed?.message === 'string' ? parsed.message : text);
      } catch {
        setDraft(text);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (!context.suggested_text) generateDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { error: invErr } = await supabase.functions.invoke('message-orchestrator', {
        body: {
          channel: 'whatsapp',
          recipient_type: context.guardian_id ? 'guardian' : 'student',
          recipient_id: context.guardian_id ?? context.student_id,
          student_id: context.student_id,
          message: draft,
          context: { source: 'ai_compose', context_type: context.context_type },
        },
      });
      if (invErr) throw invErr;
      setSent(true);
      setTimeout(() => { onClose(); }, 900);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Compor mensagem"
      icon={Sparkles}
      width="w-[440px]"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || generating || !draft.trim()}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
              ${sent ? 'bg-emerald-500 text-white'
                     : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" />
              : sent ? <Check className="w-4 h-4" />
              : <MessageCircle className="w-4 h-4" />}
            {sending ? 'Enviando…' : sent ? 'Enviado!' : 'Enviar WhatsApp'}
          </button>
        </div>
      }
    >
      <DrawerCard title="Rascunho" icon={Sparkles}>
        {generating ? (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Gerando rascunho…
          </div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
            />
            <button
              onClick={generateDraft}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-primary dark:hover:text-brand-secondary"
            >
              <RotateCw className="w-3 h-3" /> Regenerar com IA
            </button>
          </>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}
      </DrawerCard>
    </Drawer>
  );
}
