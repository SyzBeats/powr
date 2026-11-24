import type { PresetId } from '@powr/domain';

/*
 * Search-param validators of the M2 routes (§8.9.1): plain functions, because route definitions
 * are on the startup path and Zod is not (TD-17). Unknown parameters are dropped; an invalid value
 * is dropped too (none of these is required).
 */

/** `?next=/path`: where to go after onboarding or the legal gate (same-origin paths only). */
export function validateNextSearch(search: Record<string, unknown>): { next?: string } {
  const next = search['next'];
  return typeof next === 'string' && /^\/(?!\/)[\w\-/]*$/.test(next) ? { next } : {};
}

/** `?saved=equipment|plan`: the confirmation the equipment list shows after a save. */
export function validateSavedSearch(search: Record<string, unknown>): {
  saved?: 'equipment' | 'plan';
} {
  const saved = search['saved'];
  return saved === 'equipment' || saved === 'plan' ? { saved } : {};
}

/** `?preset=preset.<slug>`: the preset a new equipment profile starts from. */
export function validatePresetSearch(search: Record<string, unknown>): { preset?: PresetId } {
  const preset = search['preset'];
  return typeof preset === 'string' && /^preset\.[a-z0-9-]+$/.test(preset)
    ? { preset: preset as PresetId }
    : {};
}

/** `?week=YYYY-MM-DD`: the week the plan's week view shows. */
export function validateWeekSearch(search: Record<string, unknown>): { week?: string } {
  const week = search['week'];
  return typeof week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week) ? { week } : {};
}
