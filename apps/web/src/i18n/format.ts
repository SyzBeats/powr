/**
 * Locale-aware formatting (§8.15): numbers and dates follow the device locale while the UI
 * language stays English (NFR-L10N-01). Units belong in messages, never concatenated here.
 */
const deviceLocale = (): string => navigator.languages[0] ?? navigator.language ?? 'en';

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(deviceLocale(), { maximumFractionDigits }).format(value);
}

export function formatDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat(deviceLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(epochMs);
}

export function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat(deviceLocale(), { timeStyle: 'short' }).format(epochMs);
}

export function formatBytes(bytes: number): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return new Intl.NumberFormat(deviceLocale(), {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}
