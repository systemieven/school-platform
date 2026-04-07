/**
 * WhatsAppStatusContext
 *
 * Fetches WA connection status once on mount (after login) and every 60 s in
 * the background. Exposes the status globally so the header badge and the
 * Settings panel can share one source of truth without duplicate fetches.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { checkWhatsAppStatus } from '../lib/whatsapp-api';
import type { WhatsAppApiStatus } from '../lib/whatsapp-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WaState = 'unknown' | 'connected' | 'connecting' | 'disconnected';

export interface WaStatus {
  state: WaState;
  instanceData: WhatsAppApiStatus | null;
  loading: boolean;
  /** Manually trigger a refresh (e.g. after connect / disconnect) */
  refresh: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const WhatsAppStatusContext = createContext<WaStatus>({
  state: 'unknown',
  instanceData: null,
  loading: false,
  refresh: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_IDLE       = 60_000; // 60 s when stable
const POLL_INTERVAL_CONNECTING = 3_000;  // 3 s while "connecting"

export function WhatsAppStatusProvider({ children }: { children: React.ReactNode }) {
  const [state,        setState]        = useState<WaState>('unknown');
  const [instanceData, setInstanceData] = useState<WhatsAppApiStatus | null>(null);
  const [loading,      setLoading]      = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const res = await checkWhatsAppStatus();
    if (res.connected) {
      setState('connected');
      setInstanceData(res.status ?? null);
    } else if (res.status?.state === 'connecting') {
      setState('connecting');
      setInstanceData(res.status ?? null);
    } else {
      setState('disconnected');
      setInstanceData(res.status ?? null);
    }
    setLoading(false);
  }, []);

  const scheduleNext = useCallback((currentState: WaState) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = currentState === 'connecting' ? POLL_INTERVAL_CONNECTING : POLL_INTERVAL_IDLE;
    timerRef.current = setTimeout(async () => {
      await fetchStatus();
    }, delay);
  }, [fetchStatus]);

  // Re-schedule whenever state changes
  useEffect(() => {
    scheduleNext(state);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state, scheduleNext]);

  // Initial fetch on mount
  useEffect(() => {
    fetchStatus();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    fetchStatus();
  }, [fetchStatus]);

  return (
    <WhatsAppStatusContext.Provider value={{ state, instanceData, loading, refresh }}>
      {children}
    </WhatsAppStatusContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWhatsAppStatus() {
  return useContext(WhatsAppStatusContext);
}
