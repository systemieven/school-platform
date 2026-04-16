import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import {
  MessageSquareDot, Loader2, Check, CalendarDays, Paperclip,
} from 'lucide-react';
import type {
  AbsenceReasonOption,
  AbsenceCommunication,
  AbsenceCommunicationStatus,
} from '../../../admin/types/admin.types';
import {
  ABSENCE_COMM_STATUS_LABELS,
  ABSENCE_COMM_STATUS_COLORS,
} from '../../../admin/types/admin.types';

// ── Colour helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  blue:  'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-emerald-100 text-emerald-700',
  red:   'bg-red-100 text-red-700',
};

type SaveState = 'idle' | 'saving' | 'saved';

const EMPTY_FORM = {
  type: 'planned' as 'planned' | 'justification',
  absence_date: '',
  reason_key: '',
  notes: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FaltasPage() {
  const { guardian, currentStudentId, students } = useGuardian();

  const [reasons, setReasons]   = useState<AbsenceReasonOption[]>([]);
  const [history, setHistory]   = useState<AbsenceCommunication[]>([]);
  const [loading, setLoading]   = useState(true);

  const [form, setForm]         = useState(EMPTY_FORM);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError]       = useState('');

  // File attachment
  const [attachFile, setAttachFile] = useState<File | null>(null);

  // Current student's guardian_profiles id
  const currentStudent = students.find((s) => s.student_id === currentStudentId);

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadReasons() {
      const { data } = await supabase
        .from('absence_reason_options')
        .select('*')
        .eq('is_active', true)
        .order('position');
      if (data) setReasons(data as AbsenceReasonOption[]);
    }
    loadReasons();
  }, []);

  useEffect(() => {
    if (!currentStudentId || !guardian) { setLoading(false); return; }

    async function loadHistory() {
      setLoading(true);
      const { data } = await supabase
        .from('absence_communications')
        .select('*, reason:absence_reason_options(id, key, label, icon, color, is_active, position, description)')
        .eq('student_id', currentStudentId)
        .eq('guardian_id', guardian!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setHistory(data as AbsenceCommunication[]);
      setLoading(false);
    }
    loadHistory();
  }, [currentStudentId, guardian]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guardian || !currentStudentId) return;
    if (!form.absence_date) { setError('Informe a data da falta.'); return; }
    setError('');
    setSaveState('saving');

    let attachmentUrl: string | null = null;
    let attachmentPath: string | null = null;

    // Upload attachment if provided
    if (attachFile) {
      const ext = attachFile.name.split('.').pop() ?? 'bin';
      const path = `absence-attachments/${guardian.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, attachFile, { upsert: false });

      if (!uploadError && uploadData) {
        attachmentPath = uploadData.path;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadData.path);
        attachmentUrl = urlData.publicUrl;
      }
    }

    const { error: insertError } = await supabase.from('absence_communications').insert({
      student_id:     currentStudentId,
      guardian_id:    guardian.id,
      type:           form.type,
      absence_date:   form.absence_date,
      reason_key:     form.reason_key || null,
      notes:          form.notes || null,
      attachment_url: attachmentUrl,
      attachment_path: attachmentPath,
      status:         'sent',
    });

    if (insertError) {
      setError('Erro ao enviar a comunicação. Tente novamente.');
      setSaveState('idle');
      return;
    }

    setSaveState('saved');
    setTimeout(() => {
      setSaveState('idle');
      setForm(EMPTY_FORM);
      setAttachFile(null);
      // Refresh history
      if (guardian && currentStudentId) {
        supabase
          .from('absence_communications')
          .select('*, reason:absence_reason_options(id, key, label, icon, color, is_active, position, description)')
          .eq('student_id', currentStudentId)
          .eq('guardian_id', guardian.id)
          .order('created_at', { ascending: false })
          .limit(30)
          .then(({ data }) => { if (data) setHistory(data as AbsenceCommunication[]); });
      }
    }, 900);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
    focus:border-brand-primary outline-none transition-colors`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <MessageSquareDot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Comunicação de Faltas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentStudent?.student?.full_name ?? 'Aluno'}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
          <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Nova Comunicação</span>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Tipo</label>
            <div className="flex gap-2">
              {([['planned', 'Falta Programada'], ['justification', 'Justificativa']] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: val }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    form.type === val
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Data da Falta <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={form.absence_date}
                onChange={(e) => setForm((f) => ({ ...f, absence_date: e.target.value }))}
                className={`${inp} pl-9`}
                required
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Motivo</label>
            <select
              value={form.reason_key}
              onChange={(e) => setForm((f) => ({ ...f, reason_key: e.target.value }))}
              className={inp}
            >
              <option value="">Selecione um motivo...</option>
              {reasons.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Observações</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Detalhes adicionais (opcional)..."
              className={`${inp} resize-none`}
            />
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Anexo (laudo, atestado, etc.)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-brand-primary hover:text-brand-primary transition-colors">
                <Paperclip className="w-4 h-4" />
                {attachFile ? attachFile.name : 'Selecionar arquivo (PDF, imagem)'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {attachFile && (
              <button
                type="button"
                onClick={() => setAttachFile(null)}
                className="text-xs text-red-400 hover:text-red-600 mt-1"
              >
                Remover anexo
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            disabled={saveState !== 'idle'}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              saveState === 'saved'
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
            }`}
          >
            {saveState === 'saving' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
            ) : saveState === 'saved' ? (
              <><Check className="w-4 h-4" /> Enviado!</>
            ) : (
              <><MessageSquareDot className="w-4 h-4" /> Enviar Comunicação</>
            )}
          </button>
        </form>
      </div>

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Histórico</h2>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
            <MessageSquareDot className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nenhuma comunicação enviada ainda.</p>
          </div>
        ) : (
          history.map((item) => {
            const color = ABSENCE_COMM_STATUS_COLORS[item.status as AbsenceCommunicationStatus] ?? 'blue';
            return (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        item.type === 'planned'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.type === 'planned' ? 'Programada' : 'Justificativa'}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[color] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ABSENCE_COMM_STATUS_LABELS[item.status as AbsenceCommunicationStatus] ?? item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {formatDate(item.absence_date)}
                      </span>
                      {item.reason?.label && <span>{item.reason.label}</span>}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.notes}</p>
                    )}
                    {item.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">
                        Motivo da recusa: {item.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}
