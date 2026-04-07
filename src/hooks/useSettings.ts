import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SettingRow {
  key: string;
  value: unknown;
}

/**
 * Fetches system_settings rows for one or more categories and
 * returns a key→value map. Parses JSON strings automatically.
 */
export function useSettings(categories: string | string[]) {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cats = Array.isArray(categories) ? categories : [categories];

    supabase
      .from('system_settings')
      .select('key, value')
      .in('category', cats)
      .then(({ data }) => {
        const map: Record<string, unknown> = {};
        (data as SettingRow[] | null)?.forEach((row) => {
          let val = row.value;
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch { /* keep as string */ }
          }
          map[row.key] = val;
        });
        setSettings(map);
        setLoading(false);
      });
  }, [JSON.stringify(categories)]);

  return { settings, loading };
}
