/**
 * The body map's exercise lists (MAP-02, MAP-03): for a selected muscle (display group or
 * sub-region, MAP-07), the exercises that credit it, filtered to the active equipment profile
 * (EQP-04) and without avoided or hidden ones (EXL-08), ranked by Effectiveness (the M2a MAP-03
 * composite from `ranking.yaml`, with its factors as the "why") or by Focus (primary credit first,
 * then the muscle's share of the exercise's total credit: more isolated ranks higher). Ties go to
 * favourites, then to exercises with history (most recent first), then to the ID. With
 * "include unavailable", the other exercises follow, each naming the missing equipment.
 */
import { isAvailable, missingEquipment, type MissingEquipment } from '../equipment';
import { explained, type Explained } from '../explain';
import type { ExerciseId, LocalDate, MuscleId } from '../ids';
import type { AvoidList, ExerciseDef } from '../model';
import { creditFor, evidenceFor, groupCredits } from '../planning/credits';
import { compareStandard, effectiveness, type RankingRules } from '../planning/rank';
import type { ExposureSummary } from '../session/history';

export type RankMode = 'effectiveness' | 'focus';

export interface RankedExercise {
  readonly exerciseId: ExerciseId;
  /** 1-based position in the list. */
  readonly rank: number;
  /** The exercise's credit for the muscle (EXL-05) and what it means. */
  readonly credit: number;
  readonly role: 'primary' | 'secondary' | 'minor';
  readonly evidence: 'H' | 'EMG' | 'C' | null;
  /** MAP-03 effectiveness, 0…1, with its factors as children. */
  readonly effectiveness: Explained<number>;
  /** MAP-03 Focus: the muscle's share of the exercise's total credit, 0…1. */
  readonly focus: Explained<number>;
  readonly available: boolean;
  /** What is missing when it is not available (MAP-02 "include unavailable"). */
  readonly missing: MissingEquipment | null;
  readonly favourite: boolean;
  readonly custom: boolean;
  /** The user's last performance (MAP-02), if any. */
  readonly last: ExposureSummary | null;
}

export interface MuscleRankingInput {
  readonly muscle: MuscleId;
  readonly mode: RankMode;
  readonly exercises: readonly ExerciseDef[];
  /** The active equipment profile's items; null: no profile (everything counts as available). */
  readonly equipment: ReadonlySet<string> | null;
  readonly avoid: AvoidList;
  readonly hidden: readonly ExerciseId[];
  readonly favourites: readonly ExerciseId[];
  readonly history: (id: ExerciseId) => {
    readonly lastDate: LocalDate | null;
    readonly last: ExposureSummary | null;
  } | null;
  readonly includeUnavailable: boolean;
}

/** MAP-02/03: the ranked exercise list of one muscle. */
export function muscleRanking(input: MuscleRankingInput, rules: RankingRules): RankedExercise[] {
  const favourites = new Set<string>(input.favourites);
  const hidden = new Set<string>(input.hidden);
  const candidates = input.exercises
    .filter(
      (exercise) =>
        exercise.status === 'active' &&
        !hidden.has(exercise.id) &&
        !input.avoid.exercises.includes(exercise.id) &&
        !input.avoid.patterns.includes(exercise.pattern) &&
        creditFor(exercise, input.muscle) > 0,
    )
    .map((exercise) => {
      const credit = creditFor(exercise, input.muscle);
      const available = input.equipment === null || isAvailable(exercise, input.equipment);
      const history = input.history(exercise.id);
      return {
        exercise,
        credit,
        available,
        effectiveness: effectiveness(exercise, input.muscle, rules),
        focus: focusScore(exercise, input.muscle, credit),
        favourite: favourites.has(exercise.id),
        lastDate: history?.lastDate ?? null,
        last: history?.last ?? null,
      };
    })
    .filter((entry) => entry.available || input.includeUnavailable);

  const primary = (entry: (typeof candidates)[number]) =>
    input.mode === 'effectiveness' ? entry.effectiveness.value : entry.focus.value;
  const ordered = candidates.toSorted(
    (a, b) =>
      Number(b.available) - Number(a.available) ||
      (input.mode === 'focus' ? b.credit - a.credit : 0) ||
      primary(b) - primary(a) ||
      Number(b.favourite) - Number(a.favourite) ||
      compareDates(b.lastDate, a.lastDate) ||
      // M5z: among equal scores the standard variant first, then the ID.
      compareStandard(a.exercise, b.exercise) ||
      (a.exercise.id < b.exercise.id ? -1 : a.exercise.id > b.exercise.id ? 1 : 0),
  );
  return ordered.map((entry, index) => ({
    exerciseId: entry.exercise.id,
    rank: index + 1,
    credit: entry.credit,
    role: entry.credit >= 1 ? 'primary' : entry.credit >= 0.5 ? 'secondary' : 'minor',
    evidence: evidenceFor(entry.exercise, input.muscle),
    effectiveness: entry.effectiveness,
    focus: entry.focus,
    available: entry.available,
    missing:
      entry.available || input.equipment === null
        ? null
        : missingEquipment(entry.exercise, input.equipment).value,
    favourite: entry.favourite,
    custom: entry.exercise.custom,
    last: entry.last,
  }));
}

/** MAP-03 Focus: the muscle's share of the exercise's credits over display groups. */
function focusScore(exercise: ExerciseDef, muscle: MuscleId, credit: number): Explained<number> {
  const total = [...groupCredits(exercise).values()].reduce((sum, value) => sum + value, 0);
  const share = total > 0 ? Math.min(1, credit / total) : 0;
  return explained(share, 'ranking.focus', {
    args: { exercise: exercise.id, muscle, credit, share },
  });
}

function compareDates(a: LocalDate | null, b: LocalDate | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

/** MAP-01/MAP-06: the display groups visible in a view, with their region IDs. */
export function regionsOf(
  groups: readonly {
    readonly id: MuscleId;
    readonly bodyMap: Readonly<Partial<Record<'front' | 'back', string>>>;
  }[],
  view: 'front' | 'back',
): { readonly muscle: MuscleId; readonly region: string }[] {
  return groups.flatMap((group) => {
    const region = group.bodyMap[view];
    return region === undefined ? [] : [{ muscle: group.id, region }];
  });
}
