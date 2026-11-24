import type { CapabilityProbe, CapabilityReport, CapabilityValue } from '@powr/application';

/** Feature detection for the capability probe page (spike S-2) and diagnostics (§8.23). */
export const capabilityProbe: CapabilityProbe = {
  async probe(): Promise<CapabilityReport> {
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;

    return {
      probedAt: new Date().toISOString(),
      groups: [
        group('Browser', {
          userAgent: navigator.userAgent,
          brands: uaBrands(),
          language: navigator.language,
          standalone: matchMedia('(display-mode: standalone)').matches,
          viewport: `${innerWidth}x${innerHeight} @${devicePixelRatio}`,
        }),
        group('Offline and storage', {
          serviceWorker: 'serviceWorker' in navigator,
          serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
          storagePersist: typeof navigator.storage?.persist === 'function',
          storagePersisted: navigator.storage?.persisted
            ? await navigator.storage.persisted()
            : null,
          storageUsageMb: estimate?.usage === undefined ? null : round(estimate.usage / 1e6),
          storageQuotaMb: estimate?.quota === undefined ? null : round(estimate.quota / 1e6),
          idbDurabilityOption: 'durability' in IDBTransaction.prototype,
          opfs: typeof navigator.storage?.getDirectory === 'function',
        }),
        group('Alerts', {
          notificationApi: 'Notification' in globalThis,
          notificationPermission:
            'Notification' in globalThis ? Notification.permission : 'unsupported',
          showNotificationApi:
            typeof ServiceWorkerRegistration !== 'undefined' &&
            'showNotification' in ServiceWorkerRegistration.prototype,
          wakeLock: 'wakeLock' in navigator,
          vibrate: 'vibrate' in navigator,
          audioContext: 'AudioContext' in globalThis,
          mediaSession: 'mediaSession' in navigator,
          pageLifecycleFreeze: 'onfreeze' in document,
          wasDiscarded:
            'wasDiscarded' in document
              ? Boolean((document as { wasDiscarded?: boolean }).wasDiscarded)
              : null,
        }),
        group('Sharing and files', {
          webShare: 'share' in navigator,
          canShareZip: canShareFile('backup.zip', 'application/zip'),
          canShareJson: canShareFile('data.json', 'application/json'),
          canShareIcs: canShareFile('plan.ics', 'text/calendar'),
          canShareCsv: canShareFile('log.csv', 'text/csv'),
          canSharePng: canShareFile('card.png', 'image/png'),
          canShareTxt: canShareFile('diagnostics.txt', 'text/plain'),
          saveFilePicker: 'showSaveFilePicker' in globalThis,
          openFilePicker: 'showOpenFilePicker' in globalThis,
        }),
        group('Install and display', {
          beforeInstallPromptSupported: 'onbeforeinstallprompt' in globalThis,
          viewTransitions: 'startViewTransition' in document,
          cssLightDark: CSS.supports('color', 'light-dark(white, black)'),
          prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
          prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          weekInfo: weekInfo(),
          temporalNative: 'Temporal' in globalThis,
        }),
      ],
    };
  },
};

function group(name: string, items: Record<string, CapabilityValue>) {
  return { name, items: Object.entries(items).map(([key, value]) => ({ key, value })) };
}

function canShareFile(name: string, type: string): CapabilityValue {
  if (typeof navigator.canShare !== 'function') return null;
  try {
    return navigator.canShare({ files: [new File(['x'], name, { type })] });
  } catch {
    return false;
  }
}

function uaBrands(): CapabilityValue {
  const brands = (navigator as { userAgentData?: { brands: { brand: string; version: string }[] } })
    .userAgentData?.brands;
  return brands ? brands.map((brand) => `${brand.brand} ${brand.version}`).join(', ') : null;
}

function weekInfo(): CapabilityValue {
  const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
  };
  return typeof locale.getWeekInfo === 'function'
    ? `firstDay=${locale.getWeekInfo().firstDay}`
    : null;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
