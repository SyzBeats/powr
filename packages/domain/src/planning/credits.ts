import type { ExerciseId, MuscleId } from '../ids';
import type { CompetitionLift, ExerciseDef } from '../model';
import { parentMuscle } from '../volume';

/** Looks up an exercise of the library (built-in or custom). */
export type ExerciseLookup = (id: ExerciseId) => ExerciseDef | undefined;

/** Whether a muscle ID is a display group (`mu.<group>`) rather than a sub-region. */
export function isGroup(muscle: MuscleId): boolean {
  return parentMuscle(muscle) === muscle;
}

/**
 * The credit an exercise gives `muscle` (EXL-05). For a display group: the largest credit of the
 * group or any of its sub-regions (the roll-up). For a sub-region: its own credit, or the group's
 * credit, which covers every sub-region. Content and engine use the same rule (§8.12).
 */
export function creditFor(exercise: ExerciseDef, muscle: MuscleId): number {
  const group = isGroup(muscle);
  let best = 0;
  for (const credit of exercise.muscles) {
    const matches = group
      ? parentMuscle(credit.muscle) === muscle
      : credit.muscle === muscle || credit.muscle === parentMuscle(muscle);
    if (matches && credit.credit > best) best = credit.credit;
  }
  return best;
}

/** The mapping evidence behind `creditFor` (the strongest of the matching credits). */
export function evidenceFor(exercise: ExerciseDef, muscle: MuscleId): 'H' | 'EMG' | 'C' | null {
  const credit = creditFor(exercise, muscle);
  if (credit === 0) return null;
  const group = isGroup(muscle);
  const order = { H: 0, EMG: 1, C: 2 } as const;
  let best: 'H' | 'EMG' | 'C' | null = null;
  for (const entry of exercise.muscles) {
    const matches = group
      ? parentMuscle(entry.muscle) === muscle
      : entry.muscle === muscle || entry.muscle === parentMuscle(muscle);
    if (
      matches &&
      entry.credit === credit &&
      (best === null || order[entry.evidence] < order[best])
    )
      best = entry.evidence;
  }
  return best;
}

/** Display-group credits of an exercise (sub-regions rolled up), credit > 0 only. */
export function groupCredits(exercise: ExerciseDef): ReadonlyMap<MuscleId, number> {
  const table = new Map<MuscleId, number>();
  for (const { muscle, credit } of exercise.muscles) {
    if (credit === 0) continue;
    const group = parentMuscle(muscle);
    table.set(group, Math.max(table.get(group) ?? 0, credit));
  }
  return table;
}

/** The competition lift an exercise is, or is a close variant of (EXL-07). */
export function liftOf(exercise: ExerciseDef, lookup: ExerciseLookup): CompetitionLift | undefined {
  if (exercise.competitionLift !== undefined) return exercise.competitionLift;
  if (exercise.variantOf === undefined) return undefined;
  return lookup(exercise.variantOf)?.competitionLift;
}

/** Code-unit order, independent of locale (§8.7.1: ties are broken by ID). */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
