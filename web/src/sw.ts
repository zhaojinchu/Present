/// <reference lib="webworker" />
// Service worker. Precaches the app shell so launching from the home screen is instant and works
// offline to the sign-in screen, and carries the Web Push handlers for the stretch goal.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every in-app URL serves the shell; the router takes it from there.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Photos and profile pictures from Supabase storage. Signed URLs carry a token that changes every
// time one is created, so the cache key drops it and the bytes are served from here for 30 days;
// posts never change once uploaded and avatars carry their own ?v= version.
registerRoute(
  ({ request, url }) => request.destination === 'image' && url.pathname.startsWith('/storage/v1/object/'),
  new CacheFirst({
    cacheName: 'present-photos-v1',
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          const u = new URL(request.url);
          u.searchParams.delete('token');
          return u.href;
        },
      },
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600, purgeOnQuotaError: true }),
    ],
  }),
);

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try {
    data = (event.data?.json() as PushPayload) ?? {};
  } catch {
    data = { body: event.data?.text() ?? '' };
  }
  const title = data.title ?? 'Present';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? '',
      tag: data.tag ?? 'present',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          void client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
