import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import {
  Loader2, RefreshCw, CheckCircle, X, Tag, CalendarDays,
} from 'lucide-react';
import type {
  ReenrollmentCampaign,
  ReenrollmentApplication,
  ReenrollmentApplicationStatus,
} from '../../../admin/types/admin.types';
import {
  REENROLLMENT_APPLICATION_STATUS_LABELS,
} from '../../../admin/types/admin.types';

// ── Status colours ────────────────────────────────────────────────────────────
const APP_STATUS_STYLE: Record<ReenrollmentApplicationStatus, { color: string; bg: string }> = {
  pending:            { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30' },
  confirmed:          { color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/30' },
  signed:             { color: 'text-indigo-700 dark:text-indigo-400',bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  contract_generated: { color: 'text-purple-700 dark:text-purple-400',bg: 'bg-purple-50 dark:bg-purple-900/30' },
  completed:          { color: 'text-green-700 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/30' },
  cancelled:          { color: 'text-gray-500 dark:text-gray-400',    bg: 'bg-gray-50 dark:bg-gray-800' },
};

// ── Confirm modal ─────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  campaign: ReenrollmentCampaign;
  onClose: () => void;
  onConfirm: (earlyDiscount: boolean, notes: string, signatureData: string | null) => Promise<void>;
}

function ConfirmModal({ campaign, onClose, onConfirm }: ConfirmModalProps) {
  const [earlyDiscount, setEarlyDiscount] = useState(false);
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

  const earlyDeadlinePassed =
    campaign.early_deadline != null &&
    new Date(campaign.early_deadline + 'T23:59:59') < new Date();

  const showEarlyDiscountOption =
    !earlyDeadlinePassed &&
    campaign.early_deadline != null &&
    campaign.early_discount_pct > 0;

  async function handleSubmit() {
    if (campaign.requires_signature && !accepted) return;
    setSubmitting(true);
    const signature = campaign.requires_signature ? new Date().toISOString() : null;
    await onConfirm(earlyDiscount, notes, signature);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" /> Confirmar Rematrícula
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
          {/* Campaign summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{campaign.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ano letivo: <span className="font-medium">{campaign.school_year}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Período:{' '}
              <span className="font-medium">
                {fmtDate(campaign.start_date)} a {fmtDate(campaign.end_date)}
              </span>
            </p>
            {campaign.early_deadline && campaign.early_discount_pct > 0 && (
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                Desconto antecipado: {campaign.early_discount_pct}% até{' '}
                {fmtDate(campaign.early_deadline)}
              </p>
            )}
          </div>

          {/* Early discount checkbox */}
          {showEarlyDiscountOption && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={earlyDiscount}
                onChange={(e) => setEarlyDiscount(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-primary"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Quero o desconto antecipado ({campaign.early_discount_pct}% de desconto —
                matricular antes de {fmtDate(campaign.early_deadline!)})
              </span>
            </label>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Alguma informação adicional..."
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
            />
          </div>

          {/* Signature */}
          {campaign.requires_signature && (
            <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-gray-100 dark:border-gray-700 cursor-pointer hover:border-brand-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-primary"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Li e aceito os termos de rematrícula
              </span>
            </label>
          )}
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
            disabled={(campaign.requires_signature && !accepted) || submitting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Confirmando…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" /> Confirmar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RematriculaPage() {
  const { guardian, currentStudentId } = useGuardian();

  const [campaigns, setCampaigns] = useState<ReenrollmentCampaign[]>([]);
  const [applications, setApplications] = useState<ReenrollmentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaign, setActiveCampaign] = useState<ReenrollmentCampaign | null>(null);

  // Derive current year for header label
  const currentYear = campaigns[0]?.school_year ?? new Date().getFullYear();

  useEffect(() => {
    if (!currentStudentId) { setLoading(false); return; }

    Promise.all([
      supabase
        .from('reenrollment_campaigns')
        .select('*')
        .eq('status', 'active')
        .order('school_year', { ascending: false }),
      supabase
        .from('reenrollment_applications')
        .select(
          '*, campaign:reenrollment_campaigns(title, school_year, early_deadline, early_discount_pct)'
        )
        .eq('student_id', currentStudentId)
        .order('created_at', { ascending: false }),
    ]).then(([campRes, appRes]) => {
      setCampaigns((campRes.data ?? []) as ReenrollmentCampaign[]);
      setApplications((appRes.data ?? []) as ReenrollmentApplication[]);
      setLoading(false);
    });
  }, [currentStudentId]);

  function existingApplication(campaignId: string): ReenrollmentApplication | undefined {
    return applications.find(
      (a) =>
        a.campaign_id === campaignId &&
        a.status !== 'cancelled'
    );
  }

  async function handleConfirm(
    earlyDiscount: boolean,
    notes: string,
    signatureData: string | null
  ) {
    if (!activeCampaign || !currentStudentId || !guardian) return;

    const { data } = await supabase
      .from('reenrollment_applications')
      .insert({
        campaign_id: activeCampaign.id,
        student_id: currentStudentId,
        guardian_id: guardian.id,
        status: 'confirmed',
        early_discount_applied: earlyDiscount,
        confirmed_at: new Date().toISOString(),
        notes: notes.trim() || null,
        signature_data: signatureData,
        signed_at: signatureData ? new Date().toISOString() : null,
      })
      .select('*, campaign:reenrollment_campaigns(title, school_year, early_deadline, early_discount_pct)')
      .single();

    if (data) {
      setApplications((prev) => [data as ReenrollmentApplication, ...prev]);
    }
    setActiveCampaign(null);
  }

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  const fmtDateTime = (d: string) => new Date(d).toLocaleDateString('pt-BR');

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
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" /> Rematrícula {currentYear}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Confirme a rematrícula do seu filho(a) para o próximo ano letivo.
          </p>
        </div>

        {/* Active campaigns */}
        {campaigns.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma campanha de rematrícula ativa no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Campanhas Ativas
            </p>
            {campaigns.map((campaign) => {
              const existing = existingApplication(campaign.id);
              const hasApplication = !!existing;

              return (
                <div
                  key={campaign.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {campaign.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ano letivo {campaign.school_year}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30">
                      Ativa
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {fmtDate(campaign.start_date)} a {fmtDate(campaign.end_date)}
                  </div>

                  {campaign.early_deadline && campaign.early_discount_pct > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-medium">
                      <Tag className="w-3.5 h-3.5" />
                      Prazo para desconto antecipado:{' '}
                      {fmtDate(campaign.early_deadline)} — {campaign.early_discount_pct}% de
                      desconto
                    </div>
                  )}

                  {campaign.instructions && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                      {campaign.instructions}
                    </p>
                  )}

                  <div className="pt-1">
                    {hasApplication ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            APP_STATUS_STYLE[existing!.status]?.color ?? ''
                          } ${APP_STATUS_STYLE[existing!.status]?.bg ?? ''}`}
                        >
                          {REENROLLMENT_APPLICATION_STATUS_LABELS[existing!.status] ??
                            existing!.status}
                        </span>
                        <span className="text-xs text-gray-400">Solicitação registrada</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveCampaign(campaign)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirmar Rematrícula
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* My applications */}
        {applications.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Minhas Solicitações
            </p>
            {applications.map((app) => {
              const statusKey = app.status as ReenrollmentApplicationStatus;
              const style = APP_STATUS_STYLE[statusKey] ?? APP_STATUS_STYLE.pending;
              const label = REENROLLMENT_APPLICATION_STATUS_LABELS[statusKey] ?? app.status;

              return (
                <div
                  key={app.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {app.campaign?.title ?? 'Campanha'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ano letivo {app.campaign?.school_year ?? ''}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${style.color} ${style.bg}`}
                    >
                      {label}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 mt-2">
                    {app.confirmed_at && (
                      <p className="text-xs text-gray-400">
                        Confirmado em {fmtDateTime(app.confirmed_at)}
                      </p>
                    )}
                    {app.early_discount_applied && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30">
                        <Tag className="w-3 h-3" /> Desconto antecipado aplicado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeCampaign && (
        <ConfirmModal
          campaign={activeCampaign}
          onClose={() => setActiveCampaign(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
