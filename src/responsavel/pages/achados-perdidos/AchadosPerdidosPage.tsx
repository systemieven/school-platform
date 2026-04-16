/**
 * AchadosPerdidosPage — Portal do Responsável: Achados e Perdidos
 *
 * Fase 15 — lista objetos disponíveis, permite reivindicar com confirmação de
 * senha, e exibe objetos já reivindicados pelo responsável.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import BiometricAuth from '../../components/BiometricAuth';
import {
  PackageSearch, Loader2, Package, MapPin, Archive,
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
  const [saveState, setSaveState]     = useState<ClaimSaveState>('idle');

  // Biometric credential
  const [credentialId, setCredentialId] = useState<string | null>(null);

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

  // ── Claim handlers ────────────────────────────────────────────────────────

  function openClaim(item: LostFoundItem) {
    setClaimItem(item);
    setSaveState('idle');
  }

  function closeClaim() {
    setClaimItem(null);
    setSaveState('idle');
  }

  async function handleConfirmClaim() {
    if (!guardian || !claimItem) return;

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

    if (updateError) {
      setSaveState('idle');
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
              <div className="w-full max-w-md shadow-xl">
                {/* Item summary */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-3 space-y-1 mb-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{claimItem.type}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{claimItem.description}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                    <MapPin className="w-3 h-3" />
                    <span>{claimItem.storage_location}</span>
                  </div>
                </div>

                <BiometricAuth
                  credentialId={credentialId}
                  guardianEmail={`${(guardian?.cpf ?? '').replace(/\D/g, '')}${GUARDIAN_EMAIL_SUFFIX}`}
                  title="Por segurança, confirme sua identidade para reivindicar este objeto."
                  onSuccess={handleConfirmClaim}
                  onCancel={closeClaim}
                />
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
