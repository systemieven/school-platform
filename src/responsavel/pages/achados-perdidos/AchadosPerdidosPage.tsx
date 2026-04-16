/**
 * AchadosPerdidosPage — Portal do Responsável: Achados e Perdidos
 *
 * Fase 15 — lista objetos disponíveis, permite reivindicar com confirmação de
 * senha, e exibe objetos já reivindicados pelo responsável.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import {
  PackageSearch, Loader2, Check, Lock, Package, MapPin, Archive,
} from 'lucide-react';
import type { LostFoundItem, LostFoundStatus } from '../../../admin/types/admin.types';
import {
  LOST_FOUND_STATUS_LABELS,
  LOST_FOUND_STATUS_COLORS,
} from '../../../admin/types/admin.types';
import { CLIENT_DEFAULTS } from '../../../config/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

type ClaimSaveState = 'idle' | 'saving' | 'saved';

const GUARDIAN_EMAIL_SUFFIX =
  (CLIENT_DEFAULTS as Record<string, unknown> & { guardian?: { email_suffix?: string } })
    .guardian?.email_suffix ?? '@responsavel.portal';

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AchadosPerdidosPage() {
  const { guardian, currentStudentId, students } = useGuardian();

  const [available, setAvailable]     = useState<LostFoundItem[]>([]);
  const [myClaimed, setMyClaimed]     = useState<LostFoundItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showPhoto, setShowPhoto]     = useState(true);

  // Claim modal state
  const [claimItem, setClaimItem]     = useState<LostFoundItem | null>(null);
  const [password, setPassword]       = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirming, setConfirming]   = useState(false);
  const [saveState, setSaveState]     = useState<ClaimSaveState>('idle');

  const currentStudent = students.find((s) => s.student_id === currentStudentId);

  // ── Load setting + items ──────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!guardian) { setLoading(false); return; }
    setLoading(true);

    const [settingRes, availRes, myRes] = await Promise.all([
      supabase
        .from('system_settings')
        .select('value')
        .eq('category', 'general')
        .eq('key', 'lost_found_show_photo_on_portal')
        .maybeSingle(),
      supabase
        .from('lost_found_items')
        .select('*')
        .eq('status', 'available')
        .order('found_at', { ascending: false }),
      supabase
        .from('lost_found_items')
        .select('*')
        .eq('claimed_by_id', guardian.id)
        .eq('claimed_by_type', 'guardian')
        .in('status', ['claimed', 'delivered'] as LostFoundStatus[])
        .order('claimed_at', { ascending: false }),
    ]);

    if (settingRes.data?.value !== undefined) {
      setShowPhoto(Boolean(settingRes.data.value));
    }
    if (availRes.data) setAvailable(availRes.data as LostFoundItem[]);
    if (myRes.data) setMyClaimed(myRes.data as LostFoundItem[]);

    setLoading(false);
  }, [guardian]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Claim handlers ────────────────────────────────────────────────────────

  function openClaim(item: LostFoundItem) {
    setClaimItem(item);
    setPassword('');
    setPasswordError('');
    setSaveState('idle');
  }

  function closeClaim() {
    setClaimItem(null);
    setPassword('');
    setPasswordError('');
    setSaveState('idle');
  }

  async function handleConfirmClaim() {
    if (!guardian || !claimItem) return;
    if (!password.trim()) { setPasswordError('Informe sua senha.'); return; }
    setPasswordError('');
    setConfirming(true);

    const cpfClean = guardian.cpf?.replace(/\D/g, '') ?? '';
    const email = `${cpfClean}${GUARDIAN_EMAIL_SUFFIX}`;

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setPasswordError('Senha incorreta. Tente novamente.');
      setConfirming(false);
      return;
    }

    setSaveState('saving');

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('lost_found_items')
      .update({
        status:          'claimed',
        claimed_by_type: 'guardian',
        claimed_by_id:   guardian.id,
        claimed_at:      now,
        claimed_portal:  'guardian',
      })
      .eq('id', claimItem.id)
      .eq('status', 'available'); // guard against race conditions

    setConfirming(false);

    if (updateError) {
      setSaveState('idle');
      setPasswordError('Erro ao reivindicar o objeto. Tente novamente.');
      return;
    }

    // Insert event log (best-effort — ignore errors)
    await supabase.from('lost_found_events').insert({
      item_id:    claimItem.id,
      event:      'claimed',
      actor_type: 'guardian',
      actor_id:   guardian.id,
      actor_name: guardian.name,
    });

    setSaveState('saved');
    setTimeout(() => {
      closeClaim();
      loadData();
    }, 900);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
    focus:border-brand-primary outline-none transition-colors`;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <PackageSearch className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Achados e Perdidos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentStudent?.student?.full_name ?? 'Aluno'}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Claim modal */}
          {claimItem && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-amber-200 dark:border-amber-700/50 w-full max-w-md overflow-hidden shadow-xl">
                {/* Modal header */}
                <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-3 border-b border-amber-100 dark:border-amber-700/50 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Confirmar Reivindicação
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Item summary */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{claimItem.type}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{claimItem.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span>{claimItem.storage_location}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Por segurança, confirme sua senha para reivindicar este objeto.
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Sua Senha
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmClaim(); }}
                      placeholder="Digite sua senha..."
                      className={inp}
                      autoFocus
                    />
                    {passwordError && (
                      <p className="text-xs text-red-500 mt-1">{passwordError}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={closeClaim}
                      disabled={confirming || saveState === 'saving'}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmClaim}
                      disabled={confirming || saveState !== 'idle' || !password.trim()}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        saveState === 'saved'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
                      }`}
                    >
                      {confirming || saveState === 'saving' ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</>
                      ) : saveState === 'saved' ? (
                        <><Check className="w-4 h-4" /> Reivindicado!</>
                      ) : (
                        <><PackageSearch className="w-4 h-4" /> É meu!</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Available items */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Objetos Disponíveis
            </h2>

            {available.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
                <PackageSearch className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Nenhum objeto disponível no momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {available.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    showPhoto={showPhoto}
                    onClaim={openClaim}
                  />
                ))}
              </div>
            )}
          </section>

          {/* My claimed items */}
          {myClaimed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Meus Objetos Reivindicados
              </h2>
              <div className="space-y-2">
                {myClaimed.map((item) => (
                  <MyClaimedCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Item card (available) ─────────────────────────────────────────────────────

interface ItemCardProps {
  item: LostFoundItem;
  showPhoto: boolean;
  onClaim: (item: LostFoundItem) => void;
}

function ItemCard({ item, showPhoto, onClaim }: ItemCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
      {/* Photo or placeholder */}
      {showPhoto && item.photo_url ? (
        <img
          src={item.photo_url}
          alt={item.type}
          className="w-full h-28 object-cover"
        />
      ) : (
        <div className="w-full h-28 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
            {item.type}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {item.description}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{item.found_location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Archive className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{item.storage_location}</span>
          </div>
        </div>

        <button
          onClick={() => onClaim(item)}
          className="mt-auto w-full py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          É meu
        </button>
      </div>
    </div>
  );
}

// ── My claimed card ───────────────────────────────────────────────────────────

function MyClaimedCard({ item }: { item: LostFoundItem }) {
  const colorCls = LOST_FOUND_STATUS_COLORS[item.status] ?? '';
  const label    = LOST_FOUND_STATUS_LABELS[item.status] ?? item.status;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.type}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
          {item.claimed_at && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Reivindicado em {new Date(item.claimed_at).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${colorCls}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

// used to avoid unused import warning
void fmtDate;
