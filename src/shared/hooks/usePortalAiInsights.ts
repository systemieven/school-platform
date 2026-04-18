import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';
export type InsightStatus = 'new' | 'seen' | 'dismissed' | 'resolved';

export interface PortalAiInsight {
  id: string;
  agent_slug: string;
  severity: InsightSeverity;
  status: InsightStatus;
  audience: string[];
  recipient_id: string | null;
  related_module: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  actions: Array<{
    label: string;
    type: 'navigate' | 'whatsapp' | 'resolve';
    params?: Record<string, unknown>;
  }>;
  created_at: string;
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

export function usePortalAiInsights(authUserId: string | null | undefined) {
  const [insights, setInsights] = useState<PortalAiInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!authUserId) { setLoading(false); return; }
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) {
      const sorted = [...(data as PortalAiInsight[])].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
      );
      setInsights(sorted);
    }
    setLoading(false);
  }, [authUserId]);

  const updateStatus = useCallback(async (id: string, status: InsightStatus) => {
    const column = status === 'seen' ? 'seen_at'
      : status === 'dismissed' ? 'dismissed_at'
      : status === 'resolved' ? 'resolved_at'
      : null;
    const patch: Record<string, unknown> = { status };
    if (column) patch[column] = new Date().toISOString();
    setInsights((prev) => prev.filter((i) => i.id !== id || status === 'seen'));
    await supabase.from('ai_insights').update(patch).eq('id', id);
  }, []);

  const markSeen  = useCallback((id: string) => updateStatus(id, 'seen'),      [updateStatus]);
  const dismiss   = useCallback((id: string) => updateStatus(id, 'dismissed'), [updateStatus]);
  const resolve   = useCallback((id: string) => updateStatus(id, 'resolved'),  [updateStatus]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!authUserId) return;
    const channel = supabase
      .channel(`ai_insights_portal:${authUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_insights' },
        (payload) => {
          const row = payload.new as PortalAiInsight;
          if (row.recipient_id && row.recipient_id !== authUserId) return;
          setInsights((prev) => {
            const merged = [row, ...prev.filter((i) => i.id !== row.id)];
            return merged.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUserId]);

  return { insights, loading, totalCount: insights.length, markSeen, dismiss, resolve, refetch: fetch };
}
