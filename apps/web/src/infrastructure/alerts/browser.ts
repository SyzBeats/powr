/**
 * The browser identity the capability matrix is keyed by (technical concept §8.8.5): browser
 * family and major version, platform and display mode. Shared by the honest status (Settings →
 * Alerts) and the S-1 harness export, so device-test records and lookups use the same keys.
 */
export type BrowserFamily = 'chrome' | 'samsung' | 'other';
export type DisplayMode = 'standalone' | 'browser';

export interface BrowserInfo {
  readonly family: BrowserFamily;
  /** Major version, null when unknown. */
  readonly major: number | null;
  readonly platform: 'android' | 'other';
  readonly displayMode: DisplayMode;
}

/** Chromium-based browsers that are not Chrome itself. Samsung Internet is matched first. */
const OTHER_CHROMIUM = /\b(EdgA?|OPR|YaBrowser|Vivaldi|DuckDuckGo|Brave)\//;

export function parseBrowser(userAgent: string, standalone: boolean): BrowserInfo {
  const platform = /\bAndroid\b/.test(userAgent) ? 'android' : 'other';
  const displayMode: DisplayMode = standalone ? 'standalone' : 'browser';
  const samsung = /\bSamsungBrowser\/(\d+)/.exec(userAgent);
  if (samsung) return { family: 'samsung', major: Number(samsung[1]), platform, displayMode };
  const chrome = /\b(?:Chrome|CriOS)\/(\d+)/.exec(userAgent);
  if (chrome && !OTHER_CHROMIUM.test(userAgent)) {
    return { family: 'chrome', major: Number(chrome[1]), platform, displayMode };
  }
  return { family: 'other', major: null, platform, displayMode };
}

export function currentBrowser(): BrowserInfo {
  return parseBrowser(navigator.userAgent, matchMedia('(display-mode: standalone)').matches);
}
