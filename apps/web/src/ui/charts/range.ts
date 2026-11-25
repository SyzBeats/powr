/**
 * Time windows of the charts (ANL-11 range presets, §8.10). Pure: calendar days are ISO strings
 * (`YYYY-MM-DD`) read as UTC midnights, so a window never shifts with the device time zone.
 */
export const RANGE_PRESETS = ['4w', '12w', '6m', '1y', 'all'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** A visible window on the time axis, in epoch milliseconds (UTC midnights), both ends included. */
export interface ChartWindow {
  readonly from: number;
  readonly to: number;
}

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` → epoch ms at UTC midnight. */
export function dayMs(date: string): number {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Epoch ms → `YYYY-MM-DD` (UTC). */
export function isoDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function addMonths(epochMs: number, months: number): number {
  const date = new Date(epochMs);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  // Clamp to the last day of the target month (31 March − 1 month = 28/29 February).
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.getTime();
}

/**
 * The window of a preset that ends at `end` (the newest data point or today): the last 4 or 12
 * weeks, 6 months or a year, or everything from `start`. A window may start before the first
 * point (a new lifter's "1 year"); the chart then shows its data from the first point on.
 */
export function presetWindow(preset: RangePreset, start: number, end: number): ChartWindow {
  if (preset === 'all') return { from: Math.min(start, end), to: end };
  const from =
    preset === '4w'
      ? end - 27 * DAY_MS
      : preset === '12w'
        ? end - 83 * DAY_MS
        : preset === '6m'
          ? addMonths(end, -6) + DAY_MS
          : addMonths(end, -12) + DAY_MS;
  return { from, to: end };
}

/**
 * Moves a window by its own length towards earlier (−1) or later (+1) data, clamped to the data
 * (the tap alternative to panning, NFR-A11Y-04).
 */
export function shiftWindow(
  frame: ChartWindow,
  direction: -1 | 1,
  start: number,
  end: number,
): ChartWindow {
  const span = frame.to - frame.from;
  if (direction < 0) {
    const from = Math.max(Math.min(start, end), frame.from - span);
    return { from, to: from + span };
  }
  const to = Math.min(end, frame.to + span);
  return { from: to - span, to };
}
