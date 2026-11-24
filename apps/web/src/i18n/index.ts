import { i18n } from '@lingui/core';

import { messages as en } from './locales/en/messages.po';

/** English UI with externalized strings (TC-C06). More locales only add catalogs. */
export function activateLocale(): void {
  i18n.loadAndActivate({ locale: 'en', messages: en });
}

export { i18n };
