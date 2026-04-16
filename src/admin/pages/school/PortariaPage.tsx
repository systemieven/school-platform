import { useState, useCallback } from 'react';
import {
  ShieldCheck, Search, Loader2, Check, User,
  CalendarDays, MessageCircle, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ExitAuthorization } from '../../types/admin.types';
import {
  THIRD_PARTY_REL_LABELS,
} from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentResult {
  id: string;
  full_name: string;
  enrollment_number: string | null;
  photo_url: string | null;
  class_id: string | null;
  class?: { id: string; name: string } | null;
}

interface DiaryAttendanceToday {
  id: string;
  student_id: string;
  status: string;
  absence_communication_id: string | null;
  diary_entry?: { entry_date: string } | null;
}

interface AbsenceCommToday {
  id: string;
  type: string;
  reason_key: string | null;
  notes: string | null;
  status: string;
  reason?: { label: string } | null;
}

type ConfirmState = 'idle' | 'confirming' | 'saving' | 'done';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  morning:   'Manhã',
  afternoon: 'Tarde',
  full_day:  'Dia Inteiro',
};

function formatDate(date: string): string {
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortariaPage() {
  const { profile } = useAdminAuth();

  const [query, setQuery]           = useState('');
  const [searching, setSearching]   = useState(false);
  const [students, setStudents]     = useState<StudentResult[]>([]);
  const [selected, setSelected]     = useState<StudentResult | null>(null);

  // Data for selected student
  const [exitAuths, setExitAuths]             = useState<ExitAuthorization[]>([]);
  const [absenceComms, setAbsenceComms]       = useState<AbsenceCommToday[]>([]);
  const [diaryAttendance, setDiaryAttendance] = useState<DiaryAttendanceToday[]>([]);
  const [loadingDetail, setLoadingDetail]     = useState(false);

  // Confirm exit
  const [confirmingAuth, setConfirmingAuth]   = useState<ExitAuthorization | null>(null);
  const [confirmState, setConfirmState]       = useState<ConfirmState>('idle');

  // ── Search ───────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);

    const { data } = await supabase
      .from('students')
      .select('id, full_name, enrollment_number, photo_url, class_id, class:classes(id, name)')
      .or(`full_name.ilike.%${query.trim()}%,enrollment_number.ilike.%${query.trim()}%`)
      .eq('status', 'active')
      .limit(10);

    setStudents((data as unknown as StudentResult[]) ?? []);
    setSearching(false);
  }, [query]);

  async function selectStudent(student: StudentResult) {
    setSelected(student);
    setStudents([]);
    setLoadingDetail(true);

    const today = todayISO();

    // Load today's authorized exit authorizations
    const { data: auths } = await supabase
      .from('exit_authorizations')
      .select(
        `id, student_id, guardian_id, third_party_name, third_party_cpf, third_party_phone,
         third_party_rel, third_party_photo_url, valid_from, valid_until, period, status,
         reviewed_by, reviewed_at, rejection_reason, exited_at, exit_confirmed_by,
         audit_log, created_at, updated_at,
         student:students(id, full_name),
         guardian:guardian_profiles(id, name, phone)`
      )
      .eq('student_id', student.id)
      .eq('status', 'authorized')
      .lte('valid_from', today)
      .gte('valid_until', today);

    // Load today's absence communications
    const { data: comms } = await supabase
      .from('absence_communications')
      .select('id, type, reason_key, notes, status, reason:absence_reason_options(label)')
      .eq('student_id', student.id)
      .eq('absence_date', today);

    // Load today's diary attendance
    const { data: diary } = await supabase
      .from('diary_attendance')
      .select('id, student_id, status, absence_communication_id, diary_entry:class_diary_entries(entry_date)')
      .eq('student_id', student.id);

    const todayDiary = ((diary ?? []) as unknown as DiaryAttendanceToday[]).filter((d) => {
      const entryDate = (d.diary_entry as { entry_date: string } | null)?.entry_date;
      return entryDate === today;
    });

    setExitAuths((auths as unknown as ExitAuthorization[]) ?? []);
    setAbsenceComms((comms as unknown as AbsenceCommToday[]) ?? []);
    setDiaryAttendance(todayDiary);
    setLoadingDetail(false);
  }

  // ── Confirm exit ─────────────────────────────────────────────────────────────

  function startConfirm(auth: ExitAuthorization) {
    setConfirmingAuth(auth);
    setConfirmState('confirming');
  }

  async function confirmExit() {
    if (!confirmingAuth || !profile) return;
    setConfirmState('saving');

    const now = new Date().toISOString();
    const newLog = [
      ...(confirmingAuth.audit_log ?? []),
      { event: 'exit_confirmed', at: now, by: profile.id, user_name: profile.full_name ?? '' },
    ];

    const { error } = await supabase
      .from('exit_authorizations')
      .update({
        status:            'completed',
        exited_at:         now,
        exit_confirmed_by: profile.id,
        audit_log:         newLog,
        updated_at:        now,
      })
      .eq('id', confirmingAuth.id);

    if (!error) {
      setConfirmState('done');
      setTimeout(() => {
        setConfirmingAuth(null);
        setConfirmState('idle');
        // Refresh auth list for selected student
        if (selected) selectStudent(selected);
      }, 1200);
    } else {
      setConfirmState('idle');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Portaria</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Consulta de frequência e confirmação de retiradas</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar aluno por nome ou número de matrícula..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>

        {/* Search results */}
        {students.length > 0 && (
          <div className="mt-3 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left border-b border-gray-50 dark:border-gray-700/50 last:border-b-0"
              >
                {s.photo_url ? (
                  <img src={s.photo_url} alt={s.full_name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-500 flex-shrink-0">
                    {s.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.full_name}</p>
                  <p className="text-xs text-gray-400">
                    {s.class?.name ?? 'Sem turma'} {s.enrollment_number ? `· Mat. ${s.enrollment_number}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Student detail */}
      {selected && (
        <div className="space-y-4">
          {/* Student card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-4">
              {selected.photo_url ? (
                <img src={selected.photo_url} alt={selected.full_name} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl font-bold text-gray-400 flex-shrink-0">
                  {selected.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{selected.full_name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selected.class?.name ?? 'Sem turma'}
                  {selected.enrollment_number ? ` · Mat. ${selected.enrollment_number}` : ''}
                </p>
              </div>
            </div>
          </div>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Today's frequency */}
              <SectionCard title="Frequência Hoje" icon={CalendarDays}>
                {diaryAttendance.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhum registro de frequência hoje.</p>
                ) : (
                  <div className="space-y-2">
                    {diaryAttendance.map((d) => (
                      <div key={d.id} className="flex items-center gap-2">
                        <StatusDot status={d.status} />
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{d.status}</span>
                        {d.absence_communication_id && (
                          <span
                            title="Falta comunicada pelo responsável"
                            className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"
                          >
                            <MessageCircle className="w-3 h-3" /> Comunicada
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Absence communications today */}
              {absenceComms.length > 0 && (
                <SectionCard title="Comunicações de Falta Hoje" icon={MessageCircle}>
                  <div className="space-y-2">
                    {absenceComms.map((c) => (
                      <div key={c.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            c.type === 'planned'
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                          }`}>
                            {c.type === 'planned' ? 'Programada' : 'Justificativa'}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {c.reason?.label ?? c.reason_key ?? '—'}
                          </span>
                        </div>
                        {c.notes && <p className="text-gray-500 mt-0.5 line-clamp-2">{c.notes}</p>}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Exit authorizations */}
              <SectionCard title="Autorizações de Saída Hoje" icon={ShieldCheck}>
                {exitAuths.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <AlertCircle className="w-4 h-4" />
                    Nenhuma autorização ativa para hoje.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exitAuths.map((auth) => (
                      <div key={auth.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {auth.third_party_photo_url && (
                                <img
                                  src={auth.third_party_photo_url}
                                  alt={auth.third_party_name}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{auth.third_party_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {THIRD_PARTY_REL_LABELS[auth.third_party_rel] ?? auth.third_party_rel} · {auth.third_party_cpf}
                                </p>
                              </div>
                            </div>
                            {auth.period && (
                              <p className="text-xs text-gray-500 mt-1">Turno: {PERIOD_LABELS[auth.period] ?? auth.period}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              Válida: {formatDate(auth.valid_from)} → {formatDate(auth.valid_until)}
                            </p>
                          </div>

                          <div className="flex-shrink-0">
                            {confirmingAuth?.id === auth.id ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Confirmar saída?</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => { setConfirmingAuth(null); setConfirmState('idle'); }}
                                    className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 text-gray-600 hover:bg-gray-50 transition-colors"
                                  >
                                    Não
                                  </button>
                                  <button
                                    onClick={confirmExit}
                                    disabled={confirmState === 'saving'}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                                      confirmState === 'done'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
                                    }`}
                                  >
                                    {confirmState === 'saving' ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : confirmState === 'done' ? (
                                      <><Check className="w-3 h-3" /> Confirmado</>
                                    ) : (
                                      'Sim'
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => startConfirm(auth)}
                                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors flex items-center gap-1"
                              >
                                <User className="w-3 h-3" /> Confirmar Saída
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    present:   'bg-emerald-500',
    absent:    'bg-red-500',
    justified: 'bg-amber-500',
    late:      'bg-blue-500',
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-gray-300'}`} />
  );
}
