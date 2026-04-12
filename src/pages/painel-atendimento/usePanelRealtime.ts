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
  const [history, setHistory] = useState<CalledTicket[]>([]);
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
      .in('status', ['called', 'in_service', 'finished'])
      .not('called_at', 'is', null)
      .gte('issued_at', start)
      .lte('issued_at', end)
      .order('called_at', { ascending: false });

    if (!data) return;

    const tickets = (data as CalledTicket[]).filter((t) => matchesSectorFilter(t.sector_key));

    if (tickets.length > 0) {
      setFeatured(tickets[0]);
      setHistory(tickets.slice(1, 1 + configRef.current.history_count));
    } else {
      setFeatured(null);
      setHistory([]);
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
          if (!matchesSectorFilter(ticket.sector_key)) return;

          if (ticket.status === 'called') {
            // New call: current featured goes to history, new ticket becomes featured
            setFeatured((prev) => {
              if (prev) {
                setHistory((h) =>
                  [prev, ...h].slice(0, configRef.current.history_count),
                );
              }
              return ticket;
            });
            configRef.current.onCall?.();
          } else if (ticket.status === 'finished' || ticket.status === 'in_service') {
            // If the featured ticket changed status, move it to history
            setFeatured((prev) => {
              if (prev && prev.id === ticket.id) {
                setHistory((h) =>
                  [prev, ...h].slice(0, configRef.current.history_count),
                );
                return null;
              }
              return prev;
            });
          }
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
