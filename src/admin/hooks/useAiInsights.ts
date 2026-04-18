import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from './useAdminAuth';

export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';
export type InsightStatus = 'new' | 'seen' | 'dismissed' | 'resolved';

export interface AiInsight {
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
  seen_at: string | null;
  dismissed_at: string | null;
  resolved_at: string | null;
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

export function useAiInsights() {
  const { profile } = useAdminAuth();
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      const sorted = [...(data as AiInsight[])].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
      );
      setInsights(sorted);
    }
    setLoading(false);
  }, [profile]);

  const updateStatus = useCallback(
    async (id: string, status: InsightStatus) => {
      const column = status === 'seen' ? 'seen_at'
        : status === 'dismissed' ? 'dismissed_at'
        : status === 'resolved' ? 'resolved_at'
        : null;
      const patch: Record<string, unknown> = { status };
      if (column) patch[column] = new Date().toISOString();
      setInsights((prev) => prev.filter((i) => i.id !== id || status === 'seen'));
      await supabase.from('ai_insights').update(patch).eq('id', id);
    },
    [],
  );

  const markSeen = useCallback((id: string) => updateStatus(id, 'seen'), [updateStatus]);
  const dismiss = useCallback((id: string) => updateStatus(id, 'dismissed'), [updateStatus]);
  const resolve = useCallback((id: string) => updateStatus(id, 'resolved'), [updateStatus]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`ai_insights:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_insights' },
        (payload) => {
          const row = payload.new as AiInsight;
          const role = profile.role;
          const matchesRole = row.audience?.length === 0 || row.audience?.includes(role);
          const matchesRecipient = !row.recipient_id || row.recipient_id === profile.id;
          if (matchesRole && matchesRecipient) {
            setInsights((prev) => {
              const merged = [row, ...prev.filter((i) => i.id !== row.id)];
              return merged.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
            });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const countsBySeverity = insights.reduce<Record<InsightSeverity, number>>(
    (acc, i) => { acc[i.severity]++; return acc; },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  return {
    insights,
    loading,
    totalCount: insights.length,
    countsBySeverity,
    markSeen,
    dismiss,
    resolve,
    refetch: fetchInsights,
  };
}
