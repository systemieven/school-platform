/**
 * SendWhatsAppModal
 * Reusable modal for sending WhatsApp messages from any module drawer.
 * Loads templates for the given module, renders variables, and calls sendWhatsAppText.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { sendWhatsAppText, renderTemplate } from '../lib/whatsapp-api';
import type { WhatsAppTemplate } from '../types/admin.types';
import {
  MessageCircle, X, Send, Loader2, Eye, EyeOff,
  Check, AlertCircle, ChevronRight,
} from 'lucide-react';

interface Props {
  module:        'agendamento' | 'matricula' | 'contato';
  phone:         string;
  recipientName: string;
  recordId:      string;
  variables:     Record<string, string>;
  onClose:       () => void;
  onSent?:       () => void;
}

const MODULE_CATEGORY: Record<Props['module'], string> = {
  agendamento: 'agendamento',
  matricula:   'matricula',
  contato:     'contato',
};

const CATEGORY_COLOR: Record<string, string> = {
  agendamento: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  matricula:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  contato:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  geral:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  boas_vindas: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

type Step = 'pick' | 'compose' | 'sent';

export default function SendWhatsAppModal({ module, phone, recipientName, recordId, variables, onClose, onSent }: Props) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selected, setSelected]  = useState<WhatsAppTemplate | null>(null);
  const [message, setMessage]    = useState('');
  const [step, setStep]          = useState<Step>('pick');
  const [sending, setSending]    = useState(false);
  const [error, setError]        = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(key: string) {
    const el = textareaRef.current;
    if (!el) { setMessage((m) => m + `{{${key}}}`); return; }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const snippet = `{{${key}}}`;
    const next = message.slice(0, start) + snippet + message.slice(end);
    setMessage(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  }

  const category = MODULE_CATEGORY[module];

  useEffect(() => {
    (async () => {
      setLoadingTemplates(true);
      const { data } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .in('category', [category, 'geral', 'boas_vindas'])
        .eq('is_active', true)
        .order('category')
        .order('name');
      setTemplates((data as WhatsAppTemplate[]) || []);
      setLoadingTemplates(false);
    })();
  }, [category]);

  const selectTemplate = (t: WhatsAppTemplate) => {
    setSelected(t);
    const rendered = renderTemplate(t.content.body || '', variables);
    setMessage(rendered);
    setStep('compose');
    setError('');
    setShowPreview(false);
  };

  const handleSend = async () => {
    if (!message.trim()) { setError('A mensagem não pode estar vazia.'); return; }
    setSending(true);
    setError('');
    // Always render variables at send time — covers both free messages with
    // inserted chips and templates re-edited after selection.
    const finalText = renderTemplate(message.trim(), variables);
    const result = await sendWhatsAppText({
      phone,
      text:            finalText,
      recipientName,
      templateId:      selected?.id,
      relatedModule:   module,
      relatedRecordId: recordId,
    });
    setSending(false);
    if (result.success) {
      setStep('sent');
      onSent?.();
    } else {
      setError(result.error || 'Falha no envio. Verifique a conexão WhatsApp nas configurações.');
    }
  };

  return (
    <>
      {/* Backdrop (above existing drawer z-50) */}
      <div className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-display font-bold text-gray-900 dark:text-white text-sm">
                  Enviar WhatsApp
                </h3>
                <p className="text-xs text-gray-400">
                  Para {recipientName} · {phone}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* ── Step: sent ── */}
            {step === 'sent' && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-display font-bold text-gray-900 dark:text-white mb-1">
                  Mensagem enviada!
                </h3>
                <p className="text-sm text-gray-400">
                  O status de entrega será atualizado automaticamente.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-5 py-2.5 bg-[#003876] text-white rounded-xl text-sm font-medium hover:bg-[#002855] transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* ── Step: pick template ── */}
            {step === 'pick' && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Selecione um template ou escreva uma mensagem livre abaixo.
                </p>

                {loadingTemplates ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Nenhum template ativo para este módulo.</p>
                    <p className="text-xs mt-1">Crie templates em <strong>WhatsApp → Templates</strong>.</p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => selectTemplate(t)}
                        className="w-full flex items-center gap-3 text-left p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLOR[t.category] || CATEGORY_COLOR.geral}`}>
                              {t.category}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                            {t.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5 font-mono">
                            {(t.content.body || '').slice(0, 80)}&hellip;
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Free-text button */}
                <button
                  onClick={() => { setSelected(null); setMessage(''); setStep('compose'); }}
                  className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#003876] dark:hover:text-white border border-dashed border-gray-200 dark:border-gray-600 hover:border-[#003876] dark:hover:border-gray-400 rounded-xl transition-colors"
                >
                  Escrever mensagem livre
                </button>
              </div>
            )}

            {/* ── Step: compose ── */}
            {step === 'compose' && (
              <div className="space-y-4">
                {selected && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                    <MessageCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span>Template: <strong>{selected.name}</strong></span>
                    <button
                      onClick={() => setStep('pick')}
                      className="ml-auto text-[#003876] dark:text-[#ffd700] hover:underline"
                    >
                      Trocar
                    </button>
                  </div>
                )}

                {/* Toggle preview */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Mensagem
                  </label>
                  <button
                    onClick={() => setShowPreview((p) => !p)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                      showPreview
                        ? 'bg-[#003876] text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    Preview
                  </button>
                </div>

                {showPreview ? (
                  /* Bubble preview — render variables so the preview matches what will be sent */
                  <div className="bg-[#dcf8c6] dark:bg-green-900/20 rounded-2xl p-4 max-w-xs ml-auto shadow-sm">
                    <p className="text-sm text-gray-800 dark:text-green-100 whitespace-pre-wrap leading-relaxed">
                      {renderTemplate(message, variables) || '(mensagem vazia)'}
                    </p>
                    <p className="text-[10px] text-right text-gray-400 dark:text-green-400/60 mt-2">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓
                    </p>
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    placeholder="Digite a mensagem..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/20 transition-all resize-y font-mono leading-relaxed"
                  />
                )}

                {/* Variable chips */}
                {!showPreview && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-400 self-center mr-1">Variáveis:</span>
                    {Object.keys(variables).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => insertVariable(key)}
                        className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400 rounded-md transition-colors"
                      >
                        {`{{${key}}}`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Char count */}
                <p className="text-[11px] text-right text-gray-400">{message.length} caracteres</p>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {(step === 'pick' || step === 'compose') && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 flex gap-3 flex-shrink-0">
              {step === 'compose' && (
                <button
                  onClick={() => setStep('pick')}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Voltar
                </button>
              )}
              {step === 'compose' && (
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Enviando…' : 'Enviar mensagem'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
