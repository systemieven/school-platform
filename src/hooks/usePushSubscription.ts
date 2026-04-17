import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type UserType = 'admin' | 'guardian' | 'student';
type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out as Uint8Array<ArrayBuffer>;
}

function bufToB64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function usePushSubscription(userType: UserType) {
  const supported = isSupported();
  const [permission, setPermission] = useState<PermState>(
    supported ? (Notification.permission as PermState) : 'unsupported',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) { setLoading(false); return; }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) return;
    setError(null);
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PermState);
      if (perm !== 'granted') {
        setLoading(false);
        return;
      }

      const { data: keyRow, error: keyErr } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', 'push')
        .eq('key', 'vapid_public_key')
        .maybeSingle();
      if (keyErr) throw keyErr;
      const raw = keyRow?.value;
      const vapid = typeof raw === 'string' ? raw : String(raw ?? '').replace(/^"|"$/g, '');
      if (!vapid) throw new Error('VAPID public key não configurada.');

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Usuário não autenticado.');

      const p256dh = bufToB64(sub.getKey('p256dh'));
      const authKey = bufToB64(sub.getKey('auth'));

      const { error: upErr } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            user_type: userType,
            endpoint: sub.endpoint,
            p256dh,
            auth: authKey,
            user_agent: navigator.userAgent,
            last_seen_at: new Date().toISOString(),
            revoked_at: null,
          },
          { onConflict: 'endpoint' },
        );
      if (upErr) throw upErr;

      setSubscribed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [supported, userType]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setError(null);
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase
          .from('push_subscriptions')
          .update({ revoked_at: new Date().toISOString() })
          .eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe };
}
