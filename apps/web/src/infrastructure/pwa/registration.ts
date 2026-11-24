/**
 * Service-worker registration and the update prompt (§8.4, §6.3).
 *
 * Own code instead of `virtual:pwa-register`: workbox-window stops watching `updatefound` after
 * the first update it considers external, and the install gate makes exactly that happen
 * (a rejected install mid-session), so the post-session update would go unnoticed.
 */
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface ServiceWorkerEvents {
  onOfflineReady(): void;
  onUpdateAvailable(): void;
  onError(error: unknown): void;
}

export interface ServiceWorkerController {
  checkForUpdate(): Promise<void>;
  /** Activates the waiting version; the page reloads once it takes control. */
  applyUpdate(): void;
  /** Developer action (`?debug=1`): drop the service worker and app files, keep all data. */
  resetAppFiles(): Promise<void>;
}

export function registerServiceWorker(events: ServiceWorkerEvents): ServiceWorkerController {
  let registration: ServiceWorkerRegistration | null = null;
  let lastCheck = Date.now();

  if (!('serviceWorker' in navigator)) {
    return { checkForUpdate: async () => {}, applyUpdate: () => {}, resetAppFiles };
  }

  const watchInstalling = (worker: ServiceWorker | null) => {
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller)
        events.onUpdateAvailable();
    });
  };

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registered) => {
      registration = registered;
      if (registered.waiting && navigator.serviceWorker.controller) events.onUpdateAvailable();
      watchInstalling(registered.installing);
      registered.addEventListener('updatefound', () => watchInstalling(registered.installing));
    })
    .catch((error: unknown) => events.onError(error));

  // Ready = an active worker exists, i.e. the precache install completed.
  void navigator.serviceWorker.ready.then(() => events.onOfflineReady());

  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      Date.now() - lastCheck > UPDATE_CHECK_INTERVAL_MS
    ) {
      void controller.checkForUpdate();
    }
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  const controller: ServiceWorkerController = {
    async checkForUpdate() {
      lastCheck = Date.now();
      try {
        await registration?.update();
      } catch {
        // A rejected install (the gate) or no network: try again at the next check.
      }
    },
    applyUpdate() {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    },
    resetAppFiles,
  };
  return controller;
}

async function resetAppFiles(): Promise<void> {
  const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}
