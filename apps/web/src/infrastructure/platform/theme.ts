import type { ThemePreference } from '@powr/formats';

/** Must match public/theme-init.js, which applies the theme before first paint. */
const THEME_STORAGE_KEY = 'powr.theme';
const THEME_COLOR = { light: '#f6f6f4', dark: '#101214' } as const;

/** Applies a theme without reload: `data-theme` pins `color-scheme`, metas colour the system bars. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset['theme'];
  else root.dataset['theme'] = preference;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode, quota); the theme still applies for this page.
  }

  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLOR[preference === 'system' ? scheme : preference];
  }
}

export function storedTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}
