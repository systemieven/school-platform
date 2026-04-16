import { useState, useEffect, useCallback } from 'react';
import {
  DoorOpen, Loader2, Check, X, ChevronLeft, ChevronRight,
  User, CalendarDays, Clock,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import type {
  ExitAuthorization,
  ExitAuthorizationStatus,
} from '../../types/admin.types';
import {
  EXIT_AUTH_STATUS_LABELS,
  THIRD_PARTY_REL_LABELS,
} from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';

// ── Colour helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ExitAuthorizationStatus, string> = {
  requested:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  analyzing:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  authorized: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  completed:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  expired:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const PERIOD_LABELS: Record<string, string> = {
  morning:   'Manhã',
  afternoon: 'Tarde',
  full_day:  'Dia Inteiro',
};

const PAGE_SIZE = 20;

type SaveState = 'idle' | 'saving' | 'saved';

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutorizacoesSaidaAdminPage() {
  const { profile } = useAdminAuth();

  const [rows, setRows]         = useState<ExitAuthorization[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(0);
  const [total, setTotal]       = useState(0);
  const [filterStatus, setFilterStatus] = useState<ExitAuthorizationStatus | ''>('');

  // Drawer state
  const [selected, setSelected]     = useState<ExitAuthorization | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [action, setAction]         = useState<'authorize' | 'reject' | 'view' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saveState, setSaveState]   = useState<SaveState>('idle');

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const loadRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('exit_authorizations')
      .select(
        `id, student_id, guardian_id, third_party_name, third_party_cpf, third_party_phone,
         third_party_rel, third_party_photo_url, valid_from, valid_until, period, status,
         reviewed_by, reviewed_at, rejection_reason, exited_at, exit_confirmed_by,
         audit_log, created_at, updated_at,
         student:students(id, full_name),
         guardian:guardian_profiles(id, name, phone)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterStatus) q = q.eq('status', filterStatus);

    const { data, count, error } = await q;

    if (!error && data) {
      setRows(data as unknown as ExitAuthorization[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, filterStatus]);

  useEffect(() => { loadRows(); }, [loadRows]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  function openDrawer(row: ExitAuthorization, act: 'authorize' | 'reject' | 'view') {
    setSelected(row);
    setAction(act);
    setRejectionReason('');
    setSaveState('idle');
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => { setSelected(null); setAction(null); setSaveState('idle'); }, 300);
  }

  async function handleSave() {
    if (!selected || !profile) return;
    setSaveState('saving');

    const now = new Date().toISOString();

    if (action === 'authorize') {
      const newLog = [
        ...(selected.audit_log ?? []),
        { event: 'authorized', at: now, by: profile.id, user_name: profile.full_name ?? '' },
      ];
      const { error } = await supabase
        .from('exit_authorizations')
        .update({ status: 'authorized', reviewed_by: profile.id, reviewed_at: now, audit_log: newLog, updated_at: now })
        .eq('id', selected.id);
      if (error) { setSaveState('idle'); return; }
    } else if (action === 'reject') {
      const newLog = [
        ...(selected.audit_log ?? []),
        { event: 'rejected', at: now, by: profile.id, user_name: profile.full_name ?? '' },
      ];
      const { error } = await supabase
        .from('exit_authorizations')
        .update({ status: 'rejected', reviewed_by: profile.id, reviewed_at: now, rejection_reason: rejectionReason || null, audit_log: newLog, updated_at: now })
        .eq('id', selected.id);
      if (error) { setSaveState('idle'); return; }
    }

    setSaveState('saved');
    setTimeout(() => {
      closeDrawer();
      loadRows();
    }, 900);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabs: Array<{ value: ExitAuthorizationStatus | ''; label: string }> = [
    { value: '',           label: 'Todas' },
    { value: 'requested',  label: 'Solicitadas' },
    { value: 'analyzing',  label: 'Em Análise' },
    { value: 'authorized', label: 'Autorizadas' },
    { value: 'rejected',   label: 'Recusadas' },
    { value: 'completed',  label: 'Concluídas' },
  ];

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <DoorOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Autorizações de Saída</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Análise das autorizações excepcionais de retirada</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => { setFilterStatus(t.value as ExitAuthorizationStatus | ''); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                filterStatus === t.value
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <DoorOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma autorização encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <ExitAuthCard
              key={row.id}
              row={row}
              onAuthorize={() => openDrawer(row, 'authorize')}
              onReject={() => openDrawer(row, 'reject')}
              onView={() => openDrawer(row, 'view')}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail / Action Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={
          action === 'authorize' ? 'Autorizar Saída'
          : action === 'reject' ? 'Recusar Autorização'
          : 'Detalhes da Autorização'
        }
      >
        {selected && (
          <>
            <DrawerCard title="Aluno e Responsável">
              <div className="space-y-2 text-sm">
                <Row label="Aluno" value={selected.student?.full_name ?? '—'} />
                <Row label="Responsável" value={selected.guardian?.name ?? '—'} />
                {selected.guardian?.phone && <Row label="Telefone" value={selected.guardian.phone} />}
              </div>
            </DrawerCard>

            <DrawerCard title="Terceiro Autorizado">
              <div className="space-y-2 text-sm">
                <Row label="Nome" value={selected.third_party_name} />
                <Row label="CPF" value={selected.third_party_cpf} />
                <Row label="Telefone" value={selected.third_party_phone} />
                <Row label="Parentesco" value={THIRD_PARTY_REL_LABELS[selected.third_party_rel] ?? selected.third_party_rel} />
                {selected.third_party_photo_url && (
                  <div>
                    <span className="text-gray-400 dark:text-gray-500 block mb-1">Foto</span>
                    <img
                      src={selected.third_party_photo_url}
                      alt={selected.third_party_name}
                      className="w-20 h-20 rounded-xl object-cover border border-gray-200 dark:border-gray-600"
                    />
                  </div>
                )}
              </div>
            </DrawerCard>

            <DrawerCard title="Período de Validade">
              <div className="space-y-2 text-sm">
                <Row label="De" value={formatDate(selected.valid_from)} />
                <Row label="Até" value={formatDate(selected.valid_until)} />
                {selected.period && <Row label="Turno" value={PERIOD_LABELS[selected.period] ?? selected.period} />}
              </div>
            </DrawerCard>

            {action === 'reject' && (
              <DrawerCard title="Motivo da Recusa">
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Explique o motivo da recusa (opcional)..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary transition-colors resize-none"
                />
              </DrawerCard>
            )}

            {selected.rejection_reason && (
              <DrawerCard title="Recusa">
                <p className="text-sm text-red-600 dark:text-red-400">{selected.rejection_reason}</p>
              </DrawerCard>
            )}

            {/* Audit log */}
            {selected.audit_log && selected.audit_log.length > 0 && (
              <DrawerCard title="Histórico">
                <div className="space-y-2">
                  {selected.audit_log.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {String(entry['event'] ?? '—')}
                        </span>
                        {Boolean(entry['user_name']) && (
                          <span className="text-gray-400"> por {String(entry['user_name'])}</span>
                        )}
                        {Boolean(entry['at']) && (
                          <span className="text-gray-400 block">
                            {new Date(String(entry['at'])).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </DrawerCard>
            )}

            {/* Footer */}
            {action !== 'view' ? (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeDrawer}
                  disabled={saveState === 'saving'}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveState !== 'idle'}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    saveState === 'saved'
                      ? 'bg-emerald-500 text-white'
                      : action === 'reject'
                      ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                  }`}
                >
                  {saveState === 'saving' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
                  ) : saveState === 'saved' ? (
                    <><Check className="w-4 h-4" /> Salvo!</>
                  ) : action === 'authorize' ? (
                    <><Check className="w-4 h-4" /> Autorizar</>
                  ) : (
                    <><X className="w-4 h-4" /> Recusar</>
                  )}
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <button
                  onClick={closeDrawer}
                  className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ExitAuthCard({
  row,
  onAuthorize,
  onReject,
  onView,
}: {
  row: ExitAuthorization;
  onAuthorize: () => void;
  onReject: () => void;
  onView: () => void;
}) {
  const canReview = row.status === 'requested' || row.status === 'analyzing';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {row.student?.full_name ?? '—'}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[row.status]}`}>
              {EXIT_AUTH_STATUS_LABELS[row.status]}
            </span>
            {row.period && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                {PERIOD_LABELS[row.period] ?? row.period}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {row.third_party_name} ({THIRD_PARTY_REL_LABELS[row.third_party_rel] ?? row.third_party_rel})
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> {formatDate(row.valid_from)} → {formatDate(row.valid_until)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {row.guardian?.name ?? '—'}
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onView}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Ver
          </button>
          {canReview && (
            <>
              <button
                onClick={onReject}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors"
              >
                Recusar
              </button>
              <button
                onClick={onAuthorize}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors"
              >
                Autorizar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 dark:text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-800 dark:text-gray-200 flex-1">{value}</span>
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
