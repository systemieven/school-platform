import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * useRealtimeRows
 *
 * Subscribe to INSERT/UPDATE/DELETE events on a Supabase table and
 * automatically patch a React state array (the typical list used by
 * admin list pages). Designed to sit next to the page's `fetchData`
 * effect, not replace it — the initial load stays a plain SELECT,
 * and this hook keeps the list in sync afterwards.
 *
 * Contract:
 * - `table`   : public schema table name (e.g. `visit_appointments`)
 * - `setRows` : the React setter returned by useState<Row[]>
 * - `enabled` : optional gate (e.g. only after auth is ready). Default true.
 * - `onSelectedPatch` : optional callback fired on UPDATE so pages that
 *                       keep a `selected` copy in state can mirror changes.
 * - `channelKey` : optional suffix so multiple mounts don't collide.
 *
 * Behavior:
 * - INSERT  → prepend the new row to the list (dedup by id).
 * - UPDATE  → map over the list and replace the matching row by id.
 * - DELETE  → filter the matching row out of the list (by payload.old.id).
 *
 * Notes:
 * - The table must be in the `supabase_realtime` publication.
 * - REPLICA IDENTITY DEFAULT is enough: INSERT/UPDATE carry the full new
 *   row and DELETE carries the primary key.
 */
export function useRealtimeRows<T extends { id: string }>(opts: {
  table: string;
  setRows: Dispatch<SetStateAction<T[]>>;
  enabled?: boolean;
  onSelectedPatch?: (row: T) => void;
  channelKey?: string;
}) {
  const { table, setRows, enabled = true, onSelectedPatch, channelKey } = opts;

  useEffect(() => {
    if (!enabled) return;

    const channelName = `rt:${table}${channelKey ? `:${channelKey}` : ''}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table },
        (payload) => {
          const row = payload.new as T;
          setRows((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table },
        (payload) => {
          const row = payload.new as T;
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)));
          if (onSelectedPatch) onSelectedPatch(row);
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow?.id) return;
          setRows((prev) => prev.filter((r) => r.id !== oldRow.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, enabled, channelKey]);
}
