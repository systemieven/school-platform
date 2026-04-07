import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from './useAdminAuth';
import type { Notification } from '../types/admin.types';

export function useNotifications() {
  const { profile } = useAdminAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }, [profile]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)),
    );
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!profile) return;
    const unread = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() })));
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unread);
  }, [profile, notifications]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchNotifications };
}
