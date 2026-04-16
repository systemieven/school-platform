import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import BiometricAuth from '../../components/BiometricAuth';
import {
  DoorOpen, Loader2, CalendarDays,
  Camera,
} from 'lucide-react';
import type {
  ExitAuthorization,
  ExitAuthorizationStatus,
} from '../../../admin/types/admin.types';
import {
  EXIT_AUTH_STATUS_LABELS,
  THIRD_PARTY_REL_LABELS,
} from '../../../admin/types/admin.types';
import { CLIENT_DEFAULTS } from '../../../config/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved';
type Step = 'form' | 'confirm-password';

// ── Colour helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ExitAuthorizationStatus, string> = {
  requested:  'bg-blue-100 text-blue-700',
  analyzing:  'bg-amber-100 text-amber-700',
  authorized: 'bg-emerald-100 text-emerald-700',
  rejected:   'bg-red-100 text-red-700',
  completed:  'bg-indigo-100 text-indigo-700',
  expired:    'bg-gray-100 text-gray-600',
};

const PERIOD_LABELS: Record<string, string> = {
  morning:   'Manhã',
  afternoon: 'Tarde',
  full_day:  'Dia Inteiro',
};

const GUARDIAN_EMAIL_SUFFIX =
  (CLIENT_DEFAULTS as Record<string, unknown> & { guardian?: { email_suffix?: string } })
    .guardian?.email_suffix ?? '@responsavel.portal';

const EMPTY_FORM = {
  third_party_name:  '',
  third_party_cpf:   '',
  third_party_phone: '',
  third_party_rel:   '',
  valid_from:        '',
  valid_until:       '',
  period:            '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutorizacoesSaidaPage() {
  const { guardian, currentStudentId, students } = useGuardian();

  const [history, setHistory]   = useState<ExitAuthorization[]>([]);
  const [loading, setLoading]   = useState(true);

  const [step, setStep]         = useState<Step>('form');
  const [form, setForm]         = useState(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [formError, setFormError] = useState('');

  // Biometric credential
  const [credentialId, setCredentialId] = useState<string | null>(null);

  const currentStudent = students.find((s) => s.student_id === currentStudentId);

  // ── Load history ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentStudentId || !guardian) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('exit_authorizations')
        .select('*, student:students(id, full_name), guardian:guardian_profiles(id, name, phone)')
        .eq('student_id', currentStudentId)
        .eq('guardian_id', guardian!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setHistory(data as ExitAuthorization[]);
      setLoading(false);
    }
    load();
  }, [currentStudentId, guardian]);

  // ── Load biometric credential ─────────────────────────────────────────────

  useEffect(() => {
    if (!guardian?.id) return;
    supabase
      .from('webauthn_credentials')
      .select('credential_id')
      .eq('guardian_id', guardian.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCredentialId(data?.credential_id ?? null));
  }, [guardian?.id]);

  // ── Photo handler ─────────────────────────────────────────────────────────────

  function handlePhoto(file: File) {
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  // ── Form validation + proceed to password step ────────────────────────────────

  function handleProceed(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.third_party_name.trim()) { setFormError('Nome do terceiro é obrigatório.'); return; }
    if (!form.third_party_cpf.trim())  { setFormError('CPF do terceiro é obrigatório.'); return; }
    if (!form.third_party_phone.trim()) { setFormError('Telefone do terceiro é obrigatório.'); return; }
    if (!form.third_party_rel)         { setFormError('Selecione o parentesco.'); return; }
    if (!form.valid_from || !form.valid_until) { setFormError('Informe o período de validade.'); return; }
    if (form.valid_until < form.valid_from) { setFormError('Data final deve ser após a data inicial.'); return; }
    setStep('confirm-password');
  }

  // ── Insert after identity confirmed ──────────────────────────────────────────

  async function handleConfirmAndInsert() {
    if (!guardian || !currentStudentId) return;

    setSaveState('saving');

    let photoUrl: string | null = null;
    let photoPath: string | null = null;

    if (photoFile) {
      const ext = photoFile.name.split('.').pop() ?? 'jpg';
      const path = `exit-auth-photos/${guardian.id}/${Date.now()}.${ext}`;
      const { data: upData, error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, photoFile, { upsert: false });
      if (!upErr && upData) {
        photoPath = upData.path;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(upData.path);
        photoUrl = urlData.publicUrl;
      }
    }

    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from('exit_authorizations').insert({
      student_id:            currentStudentId,
      guardian_id:           guardian.id,
      third_party_name:      form.third_party_name,
      third_party_cpf:       form.third_party_cpf,
      third_party_phone:     form.third_party_phone,
      third_party_rel:       form.third_party_rel,
      third_party_photo_url: photoUrl,
      third_party_photo_path: photoPath,
      valid_from:            form.valid_from,
      valid_until:           form.valid_until,
      period:                form.period || null,
      password_confirmed_at: now,
      status:                'requested',
      audit_log:             [{ event: 'created', at: now, by: guardian.id }],
    });

    if (insertError) {
      setSaveState('idle');
      return;
    }

    setSaveState('saved');
    setTimeout(() => {
      setSaveState('idle');
      setStep('form');
      setForm(EMPTY_FORM);
      setPhotoFile(null);
      setPhotoPreview(null);
      // Refresh history
      supabase
        .from('exit_authorizations')
        .select('*, student:students(id, full_name), guardian:guardian_profiles(id, name, phone)')
        .eq('student_id', currentStudentId)
        .eq('guardian_id', guardian.id)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => { if (data) setHistory(data as ExitAuthorization[]); });
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
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <DoorOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Autorização de Saída</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentStudent?.student?.full_name ?? 'Aluno'}
          </p>
        </div>
      </div>

      {/* Identity confirmation overlay */}
      {step === 'confirm-password' && (
        <BiometricAuth
          credentialId={credentialId}
          guardianEmail={`${(guardian?.cpf ?? '').replace(/\D/g, '')}${GUARDIAN_EMAIL_SUFFIX}`}
          title="Por segurança, confirme sua identidade para enviar a autorização de saída."
          onSuccess={handleConfirmAndInsert}
          onCancel={() => { setStep('form'); }}
        />
      )}

      {/* Request form */}
      {step === 'form' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Nova Autorização</span>
          </div>
          <form onSubmit={handleProceed} className="p-4 space-y-4">
            {/* Third party info */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.third_party_name}
                onChange={(e) => setForm((f) => ({ ...f, third_party_name: e.target.value }))}
                placeholder="Nome do responsável pela retirada"
                className={inp}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  CPF <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.third_party_cpf}
                  onChange={(e) => setForm((f) => ({ ...f, third_party_cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                  className={inp}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Telefone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.third_party_phone}
                  onChange={(e) => setForm((f) => ({ ...f, third_party_phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className={inp}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Parentesco / Relação <span className="text-red-500">*</span>
              </label>
              <select
                value={form.third_party_rel}
                onChange={(e) => setForm((f) => ({ ...f, third_party_rel: e.target.value }))}
                className={inp}
                required
              >
                <option value="">Selecione...</option>
                {Object.entries(THIRD_PARTY_REL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Válida de <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                    className={`${inp} pl-9`}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Válida até <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                    className={`${inp} pl-9`}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Period */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Turno</label>
              <select
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                className={inp}
              >
                <option value="">Qualquer turno</option>
                {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Foto do Responsável (opcional)
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                {photoPreview ? (
                  <img src={photoPreview} alt="Prévia" className="w-16 h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-600" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <span className="text-sm text-brand-primary hover:underline">
                  {photoFile ? 'Trocar foto' : 'Adicionar foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
                />
              </label>
            </div>

            {formError && <p className="text-xs text-red-500">{formError}</p>}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium transition-colors"
            >
              <DoorOpen className="w-4 h-4" /> Prosseguir para Confirmação
            </button>
          </form>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Histórico</h2>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
            <DoorOpen className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nenhuma autorização solicitada ainda.</p>
          </div>
        ) : (
          history.map((item) => (
            <HistoryCard key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  );
}

// ── History card ──────────────────────────────────────────────────────────────

function HistoryCard({ item }: { item: ExitAuthorization }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {item.third_party_name}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[item.status]}`}>
                {EXIT_AUTH_STATUS_LABELS[item.status]}
              </span>
              {item.period && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700">
                  {PERIOD_LABELS[item.period] ?? item.period}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {THIRD_PARTY_REL_LABELS[item.third_party_rel] ?? item.third_party_rel} · {formatDate(item.valid_from)} → {formatDate(item.valid_until)}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 dark:border-gray-700 pt-3 space-y-2">
          <InfoRow label="CPF" value={item.third_party_cpf} />
          <InfoRow label="Telefone" value={item.third_party_phone} />

          {item.rejection_reason && (
            <p className="text-xs text-red-500">Recusa: {item.rejection_reason}</p>
          )}

          {/* Audit log */}
          {item.audit_log && item.audit_log.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Histórico</p>
              <div className="space-y-1.5">
                {item.audit_log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{String(entry['event'] ?? '—')}</span>
                      {Boolean(entry['at']) && (
                        <span className="text-gray-400 ml-1">{new Date(String(entry['at'])).toLocaleString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-gray-700 dark:text-gray-300">{value}</span>
    </div>
  );
}

function formatDate(date: string): string {
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}
