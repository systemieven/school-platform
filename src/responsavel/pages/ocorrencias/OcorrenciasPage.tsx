import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import {
  OCCURRENCE_TYPE_LABELS,
  OCCURRENCE_SEVERITY_LABELS,
  OCCURRENCE_STATUS_LABELS,
  type StudentOccurrence,
  type OccurrenceType,
  type OccurrenceSeverity,
  type OccurrenceStatus,
} from '../../../admin/types/admin.types';
import { Loader2, AlertCircle, X, Send } from 'lucide-react';

// ── Badge helpers ─────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<OccurrenceType, string> = {
  behavioral:           'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
  academic:             'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  health:               'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  administrative:       'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  commendation:         'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
  absence_justification:'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
};

const SEVERITY_COLORS: Record<OccurrenceSeverity, string> = {
  info:     'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  warning:  'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  critical: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
};

const STATUS_COLORS: Record<OccurrenceStatus, string> = {
  open:     'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  read:     'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  resolved: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function OcorrenciasPage() {
  const { currentStudentId } = useGuardian();
  const [occurrences, setOccurrences] = useState<StudentOccurrence[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<StudentOccurrence | null>(null);
  const [response, setResponse]       = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!currentStudentId) { setLoading(false); return; }

    supabase
      .from('student_occurrences')
      .select('*')
      .eq('student_id', currentStudentId)
      .eq('visible_to_guardian', true)
      .order('occurrence_date', { ascending: false })
      .then(({ data }) => {
        setOccurrences((data ?? []) as StudentOccurrence[]);
        setLoading(false);
      });
  }, [currentStudentId]);

  async function handleOpen(occ: StudentOccurrence) {
    setSelected(occ);
    setResponse(occ.guardian_response ?? '');

    // Mark as read if open
    if (occ.status === 'open') {
      await supabase
        .from('student_occurrences')
        .update({ status: 'read' })
        .eq('id', occ.id);

      setOccurrences((prev) =>
        prev.map((o) => o.id === occ.id ? { ...o, status: 'read' as OccurrenceStatus } : o)
      );
      setSelected((prev) => prev ? { ...prev, status: 'read' as OccurrenceStatus } : prev);
    }
  }

  async function handleSendResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !response.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('student_occurrences')
      .update({
        guardian_response: response.trim(),
        guardian_responded_at: new Date().toISOString(),
        status: 'read',
      })
      .eq('id', selected.id);

    if (!error) {
      const updated: Partial<StudentOccurrence> = {
        guardian_response: response.trim(),
        guardian_responded_at: new Date().toISOString(),
        status: 'read',
      };
      setOccurrences((prev) =>
        prev.map((o) => o.id === selected.id ? { ...o, ...updated } : o)
      );
      setSelected((prev) => prev ? { ...prev, ...updated } : prev);
    }
    setSaving(false);
  }

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> Ocorrências
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ocorrências registradas pela escola.
        </p>
      </div>

      {occurrences.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhuma ocorrência registrada.</p>
          <p className="text-xs mt-1">Ocorrências visíveis ao responsável aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {occurrences.map((occ) => (
            <button
              key={occ.id}
              onClick={() => handleOpen(occ)}
              className={`w-full text-left bg-white dark:bg-gray-800 rounded-2xl border p-4 hover:shadow-md transition-shadow ${
                occ.status === 'open'
                  ? 'border-amber-200 dark:border-amber-800'
                  : 'border-gray-100 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{occ.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(occ.occurrence_date)}</p>
                </div>
                {occ.status === 'open' && (
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[occ.type]}`}>
                  {OCCURRENCE_TYPE_LABELS[occ.type]}
                </span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[occ.severity]}`}>
                  {OCCURRENCE_SEVERITY_LABELS[occ.severity]}
                </span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[occ.status]}`}>
                  {OCCURRENCE_STATUS_LABELS[occ.status]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer / modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 dark:text-gray-100">{selected.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(selected.occurrence_date)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="ml-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[selected.type]}`}>
                  {OCCURRENCE_TYPE_LABELS[selected.type]}
                </span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[selected.severity]}`}>
                  {OCCURRENCE_SEVERITY_LABELS[selected.severity]}
                </span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status]}`}>
                  {OCCURRENCE_STATUS_LABELS[selected.status]}
                </span>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Descrição</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selected.description}</p>
              </div>

              {/* Previous response */}
              {selected.guardian_response && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Sua resposta anterior</p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">{selected.guardian_response}</p>
                  {selected.guardian_responded_at && (
                    <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                      {new Date(selected.guardian_responded_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              )}

              {/* Response form */}
              <form onSubmit={handleSendResponse} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    {selected.guardian_response ? 'Atualizar resposta' : 'Enviar resposta'}
                  </label>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={3}
                    placeholder="Escreva sua resposta..."
                    className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none transition-colors resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || !response.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {saving ? 'Enviando...' : 'Enviar resposta'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
