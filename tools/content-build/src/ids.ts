import type { ContentBundle } from '@powr/content';

/**
 * Every published content ID: exercises, muscles, equipment, presets, templates and substitution
 * groups. IDs are permanent (technical concept §8.1): a retired exercise is deprecated, never
 * removed, so `packages/content/ids.lock.json` only ever grows (§8.12 step 4).
 */
export function publishedIds(bundle: ContentBundle): string[] {
  return [
    ...bundle.exercises.map((exercise) => exercise.id),
    ...bundle.exercises.flatMap((exercise) => exercise.substitutionGroups),
    ...bundle.muscles.flatMap((group) => [group.id, ...group.subRegions.map((sub) => sub.id)]),
    ...bundle.equipment.map((item) => item.id),
    ...bundle.presets.map((preset) => preset.id),
    ...bundle.templates.map((template) => template.id),
  ];
}

/** One issue per locked ID that disappeared from the content. */
export function checkIdLock(locked: readonly string[], current: readonly string[]): string[] {
  const present = new Set(current);
  return locked
    .filter((id) => !present.has(id))
    .map((id) => `${id}: published in ids.lock.json but gone; deprecate it instead (§8.1)`);
}

/** The lock after this build: every locked ID plus every current one, sorted. */
export function nextIdLock(locked: readonly string[], current: readonly string[]): string[] {
  return [...new Set([...locked, ...current])].toSorted();
}
