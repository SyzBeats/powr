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

export { i18n };
