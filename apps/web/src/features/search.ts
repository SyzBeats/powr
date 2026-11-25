import type { PresetId } from '@powr/domain';

/*
 * Search-param validators of the M2 routes (§8.9.1): plain functions without Zod (TD-17), run by
 * the route's lazy component (TD-63, `app/route-search.ts`). Unknown parameters are dropped; an
 * invalid value is dropped too (none of these is required).
 */

export interface NextSearch {
  readonly next?: string;
}

/** `?next=/path`: where to go after onboarding or the legal gate (same-origin paths only). */
export function validateNextSearch(search: Record<string, unknown>): NextSearch {
  const next = search['next'];
  return typeof next === 'string' && /^\/(?!\/)[\w\-/]*$/.test(next) ? { next } : {};
}

export interface SavedSearch {
  readonly saved?: 'equipment' | 'plan';
}

/** `?saved=equipment|plan`: the confirmation the equipment list shows after a save. */
export function validateSavedSearch(search: Record<string, unknown>): SavedSearch {
  const saved = search['saved'];
  return saved === 'equipment' || saved === 'plan' ? { saved } : {};
}

export interface PresetSearch {
  readonly preset?: PresetId;
}

/** `?preset=preset.<slug>`: the preset a new equipment profile starts from. */
export function validatePresetSearch(search: Record<string, unknown>): PresetSearch {
  const preset = search['preset'];
  return typeof preset === 'string' && /^preset\.[a-z0-9-]+$/.test(preset)
    ? { preset: preset as PresetId }
    : {};
}

export interface WeekSearch {
  readonly week?: string;
}

/** `?week=YYYY-MM-DD`: the week the plan's week view shows. */
export function validateWeekSearch(search: Record<string, unknown>): WeekSearch {
  const week = search['week'];
  return typeof week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week) ? { week } : {};
}
