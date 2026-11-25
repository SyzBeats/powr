import { addDays, toLocalDate, type ExerciseId } from '@powr/domain';
import type { ExercisePreference } from '@powr/domain/session';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { changeSettings } from './preferences';

/** Logged exercises from this far back are listed with the plan's (SET-05 per-exercise list). */
const RECENT_DAYS = 90;

/** One exercise's own choices as Settings lists them (TMR-01, PRG-03, TMR-03). */
export interface ExerciseChoices {
  readonly exerciseId: ExerciseId;
  /** PRG-03 manual mode: "keep as last time" (last performance, no progression). */
  readonly manual: boolean;
  /** TMR-01: the rest timer starts after a set; null follows the workout-wide switch. */
  readonly restAutoStart: boolean | null;
  /** TMR-03: a rest remembered for this exercise, seconds. */
  readonly restSeconds: number | null;
  /** Where it comes from, for grouping: the active plan, recent workouts, or only a choice. */
  readonly source: 'plan' | 'recent' | 'choice';
}

/**
 * SET-05 / TD-49: the exercises a user may want per-exercise choices for: those in the active
 * plan's current block, those logged in the last 90 days and those with a choice already
 * stored, each once (plan first), with their choices.
 */
export async function exerciseChoices(deps: Deps): Promise<readonly ExerciseChoices[]> {
  const today = toLocalDate(deps.clock.now());
  const loaded = await deps.uow.read(['settings', 'plans', 'sets'], async (repos) => ({
    settings: await repos.settings.get(),
    plan: await repos.plans.getActive(),
    sets: await repos.sets.inRange(addDays(today, -RECENT_DAYS), today),
  }));
  const preferences = loaded.settings?.session?.exercises ?? [];
  const rests = new Map(
    (loaded.settings?.overrides ?? []).flatMap((entry) =>
      entry.exerciseId !== undefined &&
      entry.paramId.startsWith('session.rest.') &&
      typeof entry.value === 'number'
        ? [[entry.exerciseId, entry.value] as const]
        : [],
    ),
  );
  const order = new Map<ExerciseId, ExerciseChoices['source']>();
  const mesocycle =
    loaded.plan?.mesocycles.find((entry) => entry.status === 'active') ??
    loaded.plan?.mesocycles.at(-1);
  for (const day of mesocycle?.days ?? [])
    for (const slot of day.slots)
      if (!order.has(slot.exerciseId)) order.set(slot.exerciseId, 'plan');
  for (const set of loaded.sets)
    if (!order.has(set.exerciseId)) order.set(set.exerciseId, 'recent');
  for (const entry of preferences)
    if (!order.has(entry.exerciseId as ExerciseId))
      order.set(entry.exerciseId as ExerciseId, 'choice');
  for (const id of rests.keys())
    if (!order.has(id as ExerciseId)) order.set(id as ExerciseId, 'choice');
  return [...order]
    .filter(([id]) => deps.content.exercise(id) !== undefined)
    .map(([exerciseId, source]) => {
      const own = preferences.find((entry) => entry.exerciseId === exerciseId);
      return {
        exerciseId,
        manual: own?.manual ?? false,
        restAutoStart: own?.restAutoStart ?? null,
        restSeconds: rests.get(exerciseId) ?? null,
        source,
      };
    });
}

/**
 * TMR-01 / PRG-03: stores one exercise's choices (manual mode, rest auto-start; `null` follows
 * the workout-wide switch again). An exercise without any choice left is removed from the list.
 */
export async function setExerciseChoice(
  deps: Deps,
  input: {
    readonly exerciseId: ExerciseId;
    readonly manual?: boolean;
    readonly restAutoStart?: boolean | null;
  },
): Promise<Result<void, { readonly kind: 'unknownExercise' }>> {
  if (!deps.content.exercise(input.exerciseId)) return err({ kind: 'unknownExercise' });
  await changeSettings(deps, (settings) => {
    const list = settings.session?.exercises ?? [];
    const current = list.find((entry) => entry.exerciseId === input.exerciseId);
    const merged: { -readonly [K in keyof ExercisePreference]: ExercisePreference[K] } = {
      exerciseId: input.exerciseId,
      ...(current?.manual === undefined ? {} : { manual: current.manual }),
      ...(current?.restAutoStart === undefined ? {} : { restAutoStart: current.restAutoStart }),
      ...(current?.perSide === undefined ? {} : { perSide: current.perSide }),
    };
    if (input.manual !== undefined) {
      if (input.manual) merged.manual = true;
      else delete merged.manual;
    }
    if (input.restAutoStart !== undefined) {
      if (input.restAutoStart === null) delete merged.restAutoStart;
      else merged.restAutoStart = input.restAutoStart;
    }
    const others = list.filter((entry) => entry.exerciseId !== input.exerciseId);
    const keep = Object.keys(merged).length > 1;
    return {
      ...settings,
      session: { ...settings.session, exercises: keep ? [...others, merged] : others },
    };
  });
  return ok(undefined);
}
