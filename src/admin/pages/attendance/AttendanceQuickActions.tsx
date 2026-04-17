import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { DrawerCard } from '../../components/Drawer';
import {
  Zap,
  MessageCircle,
  CreditCard,
  FileText,
  CalendarPlus,
  GraduationCap,
  User,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';
import type { AttendanceTicket, GuardianProfile, Enrollment, FinancialInstallment } from '../../types/admin.types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(p: string): string {
  return p.replace(/\D/g, '');
}

// ── Types ────────────────────────────────────────────────────────────────────

interface QuickActionData {
  guardian: GuardianProfile | null;
  enrollments: Pick<Enrollment, 'id' | 'guardian_name' | 'student_name' | 'status' | 'enrollment_number' | 'segment'>[];
  pendingInstallments: (FinancialInstallment & { student?: { full_name: string } | null })[];
}

interface ScheduleForm {
  date: string;
  time: string;
  notes: string;
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  ticket: AttendanceTicket;
}

export default function AttendanceQuickActions({ ticket }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuickActionData>({
    guardian: null,
    enrollments: [],
    pendingInstallments: [],
  });

  // Agendar retorno
  const [scheduling, setScheduling] = useState(false);
  const [schedForm, setSchedForm] = useState<ScheduleForm>({ date: '', time: '09:00', notes: '' });
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);
  const [schedError, setSchedError] = useState<string | null>(null);

  // WhatsApp via MessageOrchestrator
  const [waSending, setWaSending] = useState(false);
  const [waSent, setWaSent] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const waSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2ª via
  const [showInstallments, setShowInstallments] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────

  useEffect(() => {
    const rawPhone = normalizePhone(ticket.visitor_phone);
    if (!rawPhone) { setLoading(false); return; }

    // Take last 9 digits for flexible matching (handles DDD variations)
    const suffix = rawPhone.slice(-9);

    const load = async () => {
      setLoading(true);

      const [guardianRes, enrollmentsRes] = await Promise.all([
        supabase
          .from('guardian_profiles')
          .select('id, name, cpf, phone, email, is_active, must_change_password, created_at, updated_at')
          .ilike('phone', `%${suffix}%`)
          .limit(1),
        supabase
          .from('enrollments')
          .select('id, guardian_name, guardian_phone, student_name, status, enrollment_number, segment')
          .ilike('guardian_phone', `%${suffix}%`)
          .limit(5),
      ]);

      const guardian = (guardianRes.data?.[0] as GuardianProfile) ?? null;
      const enrollmentList = (enrollmentsRes.data ?? []) as Pick<Enrollment, 'id' | 'guardian_name' | 'student_name' | 'status' | 'enrollment_number' | 'segment'>[];

      // Get pending installments via students → enrollments
      let pendingInstallments: (FinancialInstallment & { student?: { full_name: string } | null })[] = [];

      if (enrollmentList.length > 0) {
        const enrollmentIds = enrollmentList.map((e) => e.id);

        const { data: students } = await supabase
          .from('students')
          .select('id')
          .in('enrollment_id', enrollmentIds);

        if (students && students.length > 0) {
          const studentIds = (students as { id: string }[]).map((s) => s.id);

          const { data: insts } = await supabase
            .from('financial_installments')
            .select('*, student:student_id(full_name)')
            .in('student_id', studentIds)
            .in('status', ['pending', 'overdue'])
            .order('due_date', { ascending: true })
            .limit(10);

          pendingInstallments = (insts ?? []) as (FinancialInstallment & { student?: { full_name: string } | null })[];
        }
      }

      setData({ guardian, enrollments: enrollmentList, pendingInstallments });
      setLoading(false);
    };

    load();
  }, [ticket.id, ticket.visitor_phone]);

  // ── Actions ─────────────────────────────────────────────────────────────

  async function handleWhatsApp() {
    if (waSending || waSent) return;
    const phone = normalizePhone(ticket.visitor_phone);
    if (!phone) return;

    setWaSending(true);
    setWaError(null);

    const body = `Olá ${ticket.visitor_name}, tudo bem? Passando para dar continuidade ao atendimento.`;

    const { error } = await supabase.functions.invoke('message-orchestrator', {
      body: { phone: '55' + phone, module: 'atendimento', body, priority: 2 },
    });

    setWaSending(false);

    if (error) {
      setWaError('Falha ao enviar. Tente novamente.');
      if (waSentTimer.current) clearTimeout(waSentTimer.current);
      waSentTimer.current = setTimeout(() => setWaError(null), 4000);
    } else {
      setWaSent(true);
      if (waSentTimer.current) clearTimeout(waSentTimer.current);
      waSentTimer.current = setTimeout(() => setWaSent(false), 3000);
    }
  }

  async function handleScheduleReturn() {
    if (!schedForm.date) return;
    setSchedSaving(true);
    setSchedError(null);

    const { error } = await supabase.from('visit_appointments').insert({
      visitor_name: ticket.visitor_name,
      visitor_phone: ticket.visitor_phone,
      visitor_email: ticket.visitor_email ?? null,
      visit_reason: ticket.sector_key,
      appointment_date: schedForm.date,
      appointment_time: schedForm.time,
      duration_minutes: 30,
      status: 'pending',
      origin: 'internal',
      companions: [],
      notes: schedForm.notes || null,
      internal_notes: `Retorno agendado via atendimento ${ticket.ticket_number}`,
    });

    setSchedSaving(false);
    if (error) {
      setSchedError('Erro ao agendar: ' + error.message);
    } else {
      setSchedSaved(true);
      setTimeout(() => {
        setSchedSaved(false);
        setScheduling(false);
        setSchedForm({ date: '', time: '09:00', notes: '' });
      }, 1500);
    }
  }

  async function handleCopy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DrawerCard title="Ações Rápidas" icon={Zap}>
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      </DrawerCard>
    );
  }

  return (
    <DrawerCard title="Ações Rápidas" icon={Zap}>
      {/* ── Vínculos encontrados ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg ${
            data.guardian
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
          }`}
        >
          <User className="w-3 h-3 flex-shrink-0" />
          {data.guardian ? data.guardian.name : 'Sem cadastro de responsável'}
        </span>

        {data.enrollments.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            <GraduationCap className="w-3 h-3 flex-shrink-0" />
            {data.enrollments.length} matrícula{data.enrollments.length > 1 ? 's' : ''}
          </span>
        )}

        {data.pendingInstallments.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <CreditCard className="w-3 h-3 flex-shrink-0" />
            {data.pendingInstallments.length} parcela{data.pendingInstallments.length > 1 ? 's' : ''} em aberto
          </span>
        )}
      </div>

      {/* ── Botões de ação ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        {/* WhatsApp */}
        <button
          onClick={handleWhatsApp}
          disabled={waSending || waSent}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors disabled:cursor-default ${
            waSent
              ? 'bg-emerald-500 text-white'
              : waError
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {waSending ? (
            <><Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />Enviando…</>
          ) : waSent ? (
            <><Check className="w-4 h-4 flex-shrink-0" />Enviado!</>
          ) : waError ? (
            <><X className="w-4 h-4 flex-shrink-0" />Erro — tentar de novo</>
          ) : (
            <><MessageCircle className="w-4 h-4 flex-shrink-0" />Enviar WhatsApp</>
          )}
        </button>

        {/* Agendar retorno */}
        <button
          onClick={() => setScheduling((s) => !s)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
            scheduling
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
              : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400'
          }`}
        >
          <CalendarPlus className="w-4 h-4 flex-shrink-0" />
          Agendar Retorno
        </button>

        {/* 2ª via boleto — só se há parcelas */}
        {data.pendingInstallments.length > 0 && (
          <button
            onClick={() => setShowInstallments((s) => !s)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              showInstallments
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400'
            }`}
          >
            <CreditCard className="w-4 h-4 flex-shrink-0" />
            2ª Via Boleto/PIX
          </button>
        )}

        {/* Gerar declaração */}
        <a
          href="/admin/secretaria"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-xs font-medium transition-colors"
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          Gerar Declaração
          <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
        </a>

        {/* Ver matrícula — só se há matrículas */}
        {data.enrollments.length > 0 && (
          <a
            href="/admin/gestao?tab=matriculas"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-medium transition-colors"
          >
            <GraduationCap className="w-4 h-4 flex-shrink-0" />
            Ver Matrícula
            <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
          </a>
        )}
      </div>

      {/* ── Formulário: Agendar Retorno ──────────────────────────────────── */}
      {scheduling && (
        <div className="mt-3 p-3 rounded-xl border border-blue-100 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-900/10 space-y-2.5">
          <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
            Novo Agendamento
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Data *</label>
              <input
                type="date"
                value={schedForm.date}
                onChange={(e) => setSchedForm((f) => ({ ...f, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Horário</label>
              <input
                type="time"
                value={schedForm.time}
                onChange={(e) => setSchedForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <textarea
            value={schedForm.notes}
            onChange={(e) => setSchedForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Observações (opcional)..."
            rows={2}
            className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-brand-primary resize-none"
          />

          {schedError && (
            <p className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {schedError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setScheduling(false); setSchedError(null); }}
              className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!schedForm.date || schedSaving}
              onClick={handleScheduleReturn}
              className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                schedSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {schedSaving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Salvando…</>
              ) : schedSaved ? (
                <><Check className="w-3.5 h-3.5" />Agendado!</>
              ) : (
                <><CalendarPlus className="w-3.5 h-3.5" />Confirmar</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Parcelas em aberto ───────────────────────────────────────────── */}
      {showInstallments && data.pendingInstallments.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
            Parcelas em Aberto
          </p>
          {data.pendingInstallments.map((inst) => (
            <div
              key={inst.id}
              className="p-2.5 rounded-xl border border-amber-100 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-900/10"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                    {inst.student?.full_name ?? 'Aluno'} — Parcela {inst.installment_number}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Venc.{' '}
                    {new Date(inst.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {' · '}
                    <span className={inst.status === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                      R${' '}
                      {(inst.total_due ?? inst.amount).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${
                    inst.status === 'overdue'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}
                >
                  {inst.status === 'overdue' ? 'Vencida' : 'Pendente'}
                </span>
              </div>

              <div className="flex gap-1.5">
                {inst.pix_code ? (
                  <button
                    onClick={() => handleCopy(inst.pix_code!, `pix-${inst.id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors"
                  >
                    {copied === `pix-${inst.id}` ? (
                      <><Check className="w-3 h-3" />Copiado!</>
                    ) : (
                      <><Copy className="w-3 h-3" />Copiar PIX</>
                    )}
                  </button>
                ) : null}

                {inst.boleto_url ? (
                  <a
                    href={inst.boleto_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Boleto
                  </a>
                ) : null}

                {!inst.pix_code && !inst.boleto_url && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" />
                    Sem link de pagamento
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DrawerCard>
  );
}
