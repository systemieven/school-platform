/// <reference lib="webworker" />
/**
 * Service Worker custom — Sprint 13.N.2
 *
 * Responsabilidades:
 *  1. Precache dos assets buildados (via `self.__WB_MANIFEST` injetado pelo
 *     vite-plugin-pwa com strategy `injectManifest`).
 *  2. Handler de `push` — exibe notificacao nativa do SO com dados enviados
 *     pela Edge Function `push-send`.
 *  3. Handler de `notificationclick` — foca uma janela existente ou abre
 *     nova na URL do deep-link.
 */
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = { title: 'Notificação', body: '' };
  try {
    if (event.data) data = event.data.json() as PushPayload;
  } catch {
    const text = event.data?.text();
    if (text) data = { title: 'Notificação', body: text };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notificação', {
      body: data.body || '',
      icon: data.icon || '/pwa-icon.svg',
      badge: data.badge || '/pwa-icon.svg',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | null)?.url || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of allClients) {
      if (client.url.includes(targetUrl)) {
        return (client as WindowClient).focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
