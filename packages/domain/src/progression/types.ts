import type { Implement, Rounding } from '../loading';
import type { Effort, MovementPattern, SetType } from '../model';
import type { Mass, RoundingMode } from '../units';

/** What the engine proposes for the next exposure; the user confirms or edits it (PRG-03). */
export interface LoadSuggestion {
  readonly action: 'increase' | 'hold' | 'decrease' | 'reset' | 'prescribe';
  /** Rounded through the achievable-load service; in the implement's unit. */
  readonly load: Mass;
  /** Target reps per working set. */
  readonly reps: number;
  readonly rounding: Rounding | null;
}

/** A performed working set, as progression reads it; `LoggedSet` satisfies it. */
export interface PerformedSet {
  readonly type: SetType;
  readonly state?: 'done' | 'skipped';
  readonly load: Mass | null;
  readonly reps: number | null;
  readonly effort: Effort;
}

/** Equipment for rounding a suggestion; every suggested load goes through it (WKT-07). */
export interface SuggestionEquipment {
  readonly implement: Implement;
  readonly mode?: RoundingMode;
}

export type BodyRegion = 'upper' | 'lower';

const LOWER_BODY: ReadonlySet<MovementPattern> = new Set<MovementPattern>([
  'squat',
  'hinge',
  'lunge',
  'kneeExtension',
  'kneeFlexion',
  'hipExtension',
  'hipAbduction',
  'hipAdduction',
  'calf',
  'carry',
]);

/** Lower-body patterns get the larger novice increment (EB §Progression › Increment sizing). */
export function bodyRegionOf(pattern: MovementPattern): BodyRegion {
  return LOWER_BODY.has(pattern) ? 'lower' : 'upper';
}

/** Working sets that count: done, not warm-ups, with load and reps. */
export function workingSets(sets: readonly PerformedSet[]): PerformedSet[] {
  return sets.filter(
    (set) =>
      set.type !== 'warmup' &&
      set.type !== 'timed' &&
      set.state !== 'skipped' &&
      set.load !== null &&
      set.reps !== null,
  );
}
