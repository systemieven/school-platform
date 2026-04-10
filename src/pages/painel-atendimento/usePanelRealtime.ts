import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export interface CalledTicket {
  id: string;
  ticket_number: string;
  sector_key: string;
  sector_label: string;
  visitor_name: string | null;
  status: string;
  called_at: string;
}

interface PanelRealtimeConfig {
  sector_filter: string[];
  history_count: number;
  onCall?: () => void;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  return { start, end };
}

export default function usePanelRealtime(config: PanelRealtimeConfig) {
  const [featured, setFeatured] = useState<CalledTicket | null>(null);
  const [history, setHistory] = useState<Map<string, CalledTicket[]>>(new Map());
  const [connected, setConnected] = useState(true);
  const configRef = useRef(config);
  configRef.current = config;
  const dateRef = useRef(new Date().toDateString());

  const matchesSectorFilter = useCallback(
    (sectorKey: string) => {
      const filter = configRef.current.sector_filter;
      return !filter.length || filter.includes(sectorKey);
    },
    [],
  );

  const fetchInitial = useCallback(async () => {
    const { start, end } = todayRange();
    const { data } = await supabase
      .from('attendance_tickets')
      .select('id, ticket_number, sector_key, sector_label, visitor_name, status, called_at')
      .in('status', ['called', 'in_service'])
      .gte('issued_at', start)
      .lte('issued_at', end)
      .order('called_at', { ascending: false });

    if (!data) return;

    const tickets = (data as CalledTicket[]).filter((t) => matchesSectorFilter(t.sector_key));

    if (tickets.length > 0) {
      setFeatured(tickets[0]);
      const hist = new Map<string, CalledTicket[]>();
      for (let i = 1; i < tickets.length; i++) {
        const t = tickets[i];
        const arr = hist.get(t.sector_key) || [];
        if (arr.length < configRef.current.history_count) {
          arr.push(t);
        }
        hist.set(t.sector_key, arr);
      }
      setHistory(hist);
    } else {
      setFeatured(null);
      setHistory(new Map());
    }
  }, [matchesSectorFilter]);

  useEffect(() => {
    fetchInitial();

    const channel = supabase
      .channel('panel-attendance')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attendance_tickets' },
        (payload) => {
          const ticket = payload.new as CalledTicket;
          if (ticket.status !== 'called') return;
          if (!matchesSectorFilter(ticket.sector_key)) return;

          setFeatured((prev) => {
            if (prev) {
              setHistory((h) => {
                const next = new Map(h);
                const arr = [...(next.get(prev.sector_key) || [])];
                arr.unshift(prev);
                next.set(
                  prev.sector_key,
                  arr.slice(0, configRef.current.history_count),
                );
                return next;
              });
            }
            return ticket;
          });

          configRef.current.onCall?.();
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    // Re-fetch when tab becomes visible again (wake from sleep)
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        fetchInitial();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    // Midnight rollover check
    const rolloverInterval = setInterval(() => {
      const today = new Date().toDateString();
      if (today !== dateRef.current) {
        dateRef.current = today;
        setFeatured(null);
        setHistory(new Map());
        fetchInitial();
      }
    }, 60_000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(rolloverInterval);
    };
  }, [fetchInitial, matchesSectorFilter]);

  return { featured, history, connected };
}
