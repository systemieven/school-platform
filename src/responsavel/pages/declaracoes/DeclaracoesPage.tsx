import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import {
  Loader2, FileText, FilePlus, Download, X, ChevronRight, Info,
} from 'lucide-react';
import type {
  DocumentTemplate,
  DocumentRequest,
  DocumentRequestStatus,
} from '../../../admin/types/admin.types';
import {
  DOCUMENT_REQUEST_STATUS_LABELS,
} from '../../../admin/types/admin.types';

// ── Status colours ────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<DocumentRequestStatus, { color: string; bg: string }> = {
  pending:    { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30' },
  approved:   { color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/30' },
  generating: { color: 'text-purple-700 dark:text-purple-400',bg: 'bg-purple-50 dark:bg-purple-900/30' },
  generated:  { color: 'text-indigo-700 dark:text-indigo-400',bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  delivered:  { color: 'text-green-700 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/30' },
  rejected:   { color: 'text-red-700 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/30' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  declaration:   'Declaração',
  history:       'Histórico',
  certificate:   'Certificado',
  report:        'Boletim',
  authorization: 'Autorização',
  other:         'Outro',
};

// ── Request modal ─────────────────────────────────────────────────────────────
interface RequestModalProps {
  templates: DocumentTemplate[];
  onClose: () => void;
  onSubmit: (templateId: string, notes: string) => Promise<void>;
}

function RequestModal({ templates, onClose, onSubmit }: RequestModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selectedId) return;
    setSubmitting(true);
    await onSubmit(selectedId, notes);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FilePlus className="w-4 h-4" /> Solicitar Documento
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Template grid */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Selecione o tipo de documento
            </p>
            {templates.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">
                Nenhum documento disponível no momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${
                      selectedId === t.id
                        ? 'border-brand-primary bg-brand-primary/5 dark:border-brand-secondary dark:bg-brand-secondary/10'
                        : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight">
                      {t.name}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {DOC_TYPE_LABELS[t.document_type] ?? t.document_type}
                    </p>
                    {t.requires_approval && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-yellow-600 dark:text-yellow-400">
                        <Info className="w-3 h-3" /> Aguarda aprovação
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Informe a finalidade ou qualquer detalhe relevante..."
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedId || submitting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <FilePlus className="w-4 h-4" /> Solicitar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DeclaracoesPage() {
  const { guardian, currentStudentId } = useGuardian();

  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!currentStudentId) { setLoading(false); return; }

    Promise.all([
      supabase
        .from('document_requests')
        .select('*, template:document_templates(name, document_type, requires_approval)')
        .eq('student_id', currentStudentId)
        .order('created_at', { ascending: false }),
      supabase
        .from('document_templates')
        .select('id, name, document_type, description, requires_approval')
        .eq('is_active', true)
        .order('name'),
    ]).then(([reqRes, tplRes]) => {
      setRequests((reqRes.data ?? []) as DocumentRequest[]);
      setTemplates((tplRes.data ?? []) as DocumentTemplate[]);
      setLoading(false);
    });
  }, [currentStudentId]);

  async function handleSubmit(templateId: string, notes: string) {
    if (!currentStudentId || !guardian) return;

    const { data } = await supabase
      .from('document_requests')
      .insert({
        template_id: templateId,
        student_id: currentStudentId,
        requested_by: guardian.id,
        requester_type: 'guardian',
        notes: notes.trim() || null,
        status: 'pending',
      })
      .select('*, template:document_templates(name, document_type, requires_approval)')
      .single();

    if (data) {
      setRequests((prev) => [data as DocumentRequest, ...prev]);
    }
    setShowModal(false);
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Declarações e Documentos
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Solicite declarações e acompanhe o status das suas requisições.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0"
          >
            <FilePlus className="w-4 h-4" />
            <span className="hidden sm:inline">Solicitar Documento</span>
            <span className="sm:hidden">Solicitar</span>
          </button>
        </div>

        {/* List */}
        {requests.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              Nenhuma solicitação ainda. Clique em{' '}
              <span className="font-medium text-gray-500 dark:text-gray-300">
                + Solicitar Documento
              </span>{' '}
              para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const statusKey = req.status as DocumentRequestStatus;
              const style = STATUS_STYLE[statusKey] ?? STATUS_STYLE.pending;
              const label = DOCUMENT_REQUEST_STATUS_LABELS[statusKey] ?? req.status;
              const canDownload =
                (req.status === 'generated' || req.status === 'delivered') && req.pdf_url;

              return (
                <div
                  key={req.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {req.template?.name ?? 'Documento'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {DOC_TYPE_LABELS[req.template?.document_type ?? ''] ?? ''}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${style.color} ${style.bg}`}
                    >
                      {label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3">
                    <p className="text-xs text-gray-400">
                      Solicitado em {fmtDate(req.created_at)}
                    </p>
                    <div className="flex items-center gap-2">
                      {req.template?.requires_approval && req.status === 'pending' && (
                        <span className="text-[11px] text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                          <Info className="w-3 h-3" /> Aguarda aprovação
                        </span>
                      )}
                      {canDownload && (
                        <a
                          href={req.pdf_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-medium hover:opacity-90 transition-opacity"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      )}
                      {!canDownload && req.status !== 'rejected' && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <ChevronRight className="w-3 h-3" /> Em processamento
                        </span>
                      )}
                    </div>
                  </div>

                  {req.rejection_reason && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                      Motivo da recusa: {req.rejection_reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <RequestModal
          templates={templates}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}
