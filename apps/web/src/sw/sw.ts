/// <reference lib="webworker" />
import { PrecacheController, PrecacheRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

import { claimRuntimeFlag, getRuntimeValue } from '../infrastructure/runtime-db';
import {
  MAX_SW_TIMER_MS,
  REST_NOTIFICATION_TAG,
  type PageToSwMessage,
  type SwToPageMessage,
} from './protocol';

declare const self: ServiceWorkerGlobalScope;

const BUILD = __APP_BUILD__;
const RUNTIME_CACHE = 'powr-runtime-v1';
const NETWORK_TIMEOUT_MS = 3000;

const precache = new PrecacheController();
precache.addToCacheList(self.__WB_MANIFEST);

// Install gate (§6.3, §8.4): never install a new version while a workout is active. The install
// fails before anything is downloaded; the page calls registration.update() when the session ends.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const activeSession = await getRuntimeValue('activeSession');
      if (activeSession) throw new Error('deferred-active-session');
      await precache.install(event);
    })(),
  );
});

let userAcceptedUpdate = false;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await precache.activate(event);
      // Take over open pages only after the user accepted the update (never automatically).
      if (userAcceptedUpdate) await self.clients.claim();
    })(),
  );
});

// Precached assets, cache-first; navigations get the precached app shell (deep links offline).
registerRoute(new PrecacheRoute(precache));
registerRoute(new NavigationRoute(precache.createHandlerBoundToURL('/index.html')));
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    ['/version.json', '/changelog.json'].includes(url.pathname),
  ({ request }) => networkFirst(request),
);

const armedTimers = new Map<string, () => void>();

self.addEventListener('message', (event) => {
  const message = event.data as PageToSwMessage;
  switch (message.type) {
    case 'SKIP_WAITING':
      userAcceptedUpdate = true;
      void self.skipWaiting();
      break;
    case 'GET_BUILD': {
      const reply: SwToPageMessage = { type: 'BUILD', build: BUILD };
      event.ports[0]?.postMessage(reply);
      break;
    }
    case 'ARM_REST':
      event.waitUntil(restTimer(message));
      break;
    case 'DISARM':
      armedTimers.get(message.timerId)?.();
      break;
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/session';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) await existing.focus();
      else await self.clients.openWindow(url);
    })(),
  );
});

/**
 * Hidden-state rest alert, one of several best-effort paths (§8.8.4). Holds the message event
 * open until the rest ends; only for rests within Chromium's 5-minute event limit.
 */
async function restTimer(message: Extract<PageToSwMessage, { type: 'ARM_REST' }>): Promise<void> {
  const delay = message.endsAtEpochMs - Date.now();
  if (delay > MAX_SW_TIMER_MS) return;
  armedTimers.get(message.timerId)?.();

  const fire = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(true), Math.max(0, delay));
    armedTimers.set(message.timerId, () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
  armedTimers.delete(message.timerId);
  if (!fire) return;

  // Whichever path fires first claims the flag; the other one stays silent.
  const claimed = await claimRuntimeFlag(`fired:${message.timerId}`, { by: 'sw', at: Date.now() });
  if (!claimed || Notification.permission !== 'granted') return;
  await self.registration.showNotification(message.title, {
    body: message.body,
    tag: REST_NOTIFICATION_TAG,
    renotify: true,
    data: { url: message.url },
    vibrate: [200, 100, 200],
  } as NotificationOptions);
}

async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

function fetchWithTimeout(request: Request, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}
