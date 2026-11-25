import { isCustomizable } from '@powr/content';
import type { CustomExercise } from '@powr/domain';

import type { Deps } from '../deps';

/**
 * EXL-04: merges the stored custom exercises into the container's catalog, so sessions, plans,
 * volume, e1RM and the body map see them like built-in ones. The app calls it at boot (before the
 * first screen); saving, deleting and restoring call it again. A catalog that cannot merge (a
 * plain built-in catalog) is left alone. Small and Zod-free: it is on the startup path.
 */
export async function loadCustomExercises(deps: Deps): Promise<readonly CustomExercise[]> {
  const custom = await deps.uow.read(['customExercises'], (repos) => repos.customExercises.list());
  syncCustomExercises(deps, custom);
  return custom;
}

/** Replaces the catalog's custom exercises (no read). */
export function syncCustomExercises(deps: Deps, custom: readonly CustomExercise[]): void {
  if (isCustomizable(deps.content)) deps.content.setCustomExercises(custom);
}
