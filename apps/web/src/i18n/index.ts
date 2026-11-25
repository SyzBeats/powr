import { i18n } from '@lingui/core';

/**
 * English UI with externalized strings (TC-C06). More locales only add catalogs. The compiled
 * catalog is a lazy chunk (since M2b it holds every screen's strings and the "Why?" texts, about
 * 20 kB gzip), loaded at boot in parallel with the database, content and rules (§6.7, §8.19) and
 * precached like every other chunk.
 */
export async function activateLocale(): Promise<void> {
  const { messages } = await import('./locales/en/messages.po');
  i18n.loadAndActivate({ locale: 'en', messages });
}

/**
 * Catalogs of long texts read rarely (M5s): the legal texts, "How POWR decides" and the
 * attributions screen (`legal`), and the registry's parameter labels (`params`). Each is its own
 * lazy chunk, so the boot catalog stays the size it was; the service worker precaches them.
 */
const LAZY = {
  legal: () => import('./locales/en/legal.po'),
  params: () => import('./locales/en/params.po'),
} as const;

export type LazyCatalog = keyof typeof LAZY;

const loading = new Map<LazyCatalog, Promise<void>>();

/**
 * Loads a lazy catalog once and merges it into the English messages (and the active locale's, if
 * a test switched it). Components read it with `use(loadCatalog(name))` inside a `<Suspense>`.
 */
export function loadCatalog(name: LazyCatalog): Promise<void> {
  const known = loading.get(name);
  if (known) return known;
  const promise = LAZY[name]().then(({ messages }) => {
    i18n.load('en', messages);
    if (i18n.locale && i18n.locale !== 'en') i18n.load(i18n.locale, messages);
  });
  loading.set(name, promise);
  return promise;
}

export { i18n };
