import type { ExerciseId } from '../ids';
import { toKg, type Mass } from '../units';
import type { LoggedSet } from './session';

export interface SetValues {
  readonly load: Mass | null;
  readonly reps: number | null;
  readonly rir: number | null;
}

export type SetValueIssue =
  | { readonly field: 'reps'; readonly kind: 'notInteger' | 'outOfRange' }
  | { readonly field: 'load'; readonly kind: 'notFinite' | 'outOfRange' | 'tooPrecise' }
  | { readonly field: 'rir'; readonly kind: 'outOfRange' | 'notHalfStep' };

/** Ranges shared with the persisted record schemas (§8.3.5). */
export const SET_LIMITS = {
  repsMax: 1000,
  loadMinKg: -500,
  loadMaxKg: 2000,
  loadDecimals: 3,
  rirMax: 10,
} as const;

/** Checks the values a user is about to confirm. An empty list means they can be stored. */
export function validateSetValues(values: SetValues): SetValueIssue[] {
  const issues: SetValueIssue[] = [];
  const { reps, load, rir } = values;

  if (reps !== null) {
    if (!Number.isInteger(reps)) issues.push({ field: 'reps', kind: 'notInteger' });
    else if (reps < 0 || reps > SET_LIMITS.repsMax)
      issues.push({ field: 'reps', kind: 'outOfRange' });
  }

  if (load !== null) {
    const kg = toKg(load);
    if (!Number.isFinite(load.value)) issues.push({ field: 'load', kind: 'notFinite' });
    else if (kg < SET_LIMITS.loadMinKg || kg > SET_LIMITS.loadMaxKg)
      issues.push({ field: 'load', kind: 'outOfRange' });
    else if (!hasAtMostDecimals(load.value, SET_LIMITS.loadDecimals))
      issues.push({ field: 'load', kind: 'tooPrecise' });
  }

  if (rir !== null) {
    if (rir < 0 || rir > SET_LIMITS.rirMax) issues.push({ field: 'rir', kind: 'outOfRange' });
    else if (!Number.isInteger(rir * 2)) issues.push({ field: 'rir', kind: 'notHalfStep' });
  }

  return issues;
}

/** The index the next set of `exerciseId` gets within a session. */
export function nextSetIndex(sessionSets: readonly LoggedSet[], exerciseId: ExerciseId): number {
  let next = 0;
  for (const set of sessionSets) {
    if (set.exerciseId === exerciseId && set.index >= next) next = set.index + 1;
  }
  return next;
}

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(Math.round(value * factor) - value * factor) < 1e-6;
}
