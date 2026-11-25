import {
  MOVEMENT_PATTERNS,
  SETUP_FIELDS,
  toKg,
  type ExerciseId,
  type ExerciseUserData,
  type Mass,
  type MovementPattern,
  type Profile,
  type SetupEntry,
} from '@powr/domain';

import type { Deps } from '../deps';
import type { Observable } from '../ports';
import { err, ok, type Result } from '../result';

/*
 * The user's marks and notes per exercise: favourites, hidden and avoided exercises and avoided
 * patterns (EXL-08, in the profile as M2 keeps them: favourites are preferred by the generator and
 * the rankings, hidden ones leave the lists, avoided ones are never generated or suggested), and
 * the setup memory (EXL-09: "seat 4, pin 3, wide grip", shown whenever the exercise appears in a
 * session) with the user-set training max (ANL-04), in the raw table `exerciseUserData`.
 */

export type ExerciseMarkError =
  | { readonly kind: 'noProfile' }
  | { readonly kind: 'unknownExercise' };

async function updateProfile(
  deps: Deps,
  change: (profile: Profile) => Profile,
): Promise<Result<Profile, { readonly kind: 'noProfile' }>> {
  const now = deps.clock.now();
  return deps.uow.write(['profile'], async (repos) => {
    const profile = await repos.profile.get();
    if (!profile) return err({ kind: 'noProfile' as const });
    const next = { ...change(profile), updatedAt: now };
    await repos.profile.put(next);
    return ok(next);
  });
}

const toggle = <T>(list: readonly T[], value: T, on: boolean): T[] =>
  on ? [...new Set([...list, value])] : list.filter((entry) => entry !== value);

/** EXL-08: marks or unmarks a favourite (the generator and the rankings prefer it). */
export async function setFavourite(
  deps: Deps,
  input: { readonly exerciseId: ExerciseId; readonly on: boolean },
): Promise<Result<Profile, ExerciseMarkError>> {
  if (!deps.content.exercise(input.exerciseId)) return err({ kind: 'unknownExercise' });
  return updateProfile(deps, (profile) => ({
    ...profile,
    preferredExercises: toggle(profile.preferredExercises, input.exerciseId, input.on),
  }));
}

/** EXL-08: hides or shows an exercise in the library, rankings and substitution lists. */
export async function setHidden(
  deps: Deps,
  input: { readonly exerciseId: ExerciseId; readonly on: boolean },
): Promise<Result<Profile, ExerciseMarkError>> {
  if (!deps.content.exercise(input.exerciseId)) return err({ kind: 'unknownExercise' });
  return updateProfile(deps, (profile) => ({
    ...profile,
    hiddenExercises: toggle(profile.hiddenExercises ?? [], input.exerciseId, input.on),
  }));
}

/** EXL-08, ONB-07: avoids an exercise or a whole movement pattern (never generated or suggested). */
export async function setAvoided(
  deps: Deps,
  input:
    | { readonly exerciseId: ExerciseId; readonly on: boolean }
    | { readonly pattern: MovementPattern; readonly on: boolean },
): Promise<Result<Profile, ExerciseMarkError>> {
  if ('exerciseId' in input) {
    if (!deps.content.exercise(input.exerciseId)) return err({ kind: 'unknownExercise' });
    return updateProfile(deps, (profile) => ({
      ...profile,
      avoid: {
        ...profile.avoid,
        exercises: toggle(profile.avoid.exercises, input.exerciseId, input.on),
      },
    }));
  }
  if (!(MOVEMENT_PATTERNS as readonly string[]).includes(input.pattern))
    return err({ kind: 'unknownExercise' });
  return updateProfile(deps, (profile) => ({
    ...profile,
    avoid: { ...profile.avoid, patterns: toggle(profile.avoid.patterns, input.pattern, input.on) },
  }));
}

// --- Setup memory and training max (EXL-09, ANL-04) ---------------------------------------

export type SetupError =
  | { readonly kind: 'unknownExercise' }
  | { readonly kind: 'invalidEntry'; readonly index: number }
  | { readonly kind: 'tooMany' }
  | { readonly kind: 'invalidTrainingMax' };

const SETUP_MAX = 12;

/** EXL-09 setup memory and the ANL-04 training max of an exercise; null when nothing is stored. */
export async function exerciseUserData(
  deps: Deps,
  exerciseId: ExerciseId,
): Promise<ExerciseUserData | null> {
  return (
    (await deps.uow.read(['exerciseUserData'], (repos) =>
      repos.exerciseUserData.get(exerciseId),
    )) ?? null
  );
}

/** The setup memory of several exercises (the session screen shows it for each, EXL-09). */
export async function exerciseUserDataFor(
  deps: Deps,
  exerciseIds: readonly ExerciseId[],
): Promise<ReadonlyMap<ExerciseId, ExerciseUserData>> {
  const entries = await deps.uow.read(['exerciseUserData'], async (repos) =>
    Promise.all([...new Set(exerciseIds)].map((id) => repos.exerciseUserData.get(id))),
  );
  return new Map(entries.flatMap((entry) => (entry ? [[entry.exerciseId, entry] as const] : [])));
}

/** EXL-09 for the active session's exercises, live (the session screen's setup notes). */
export function observeSessionSetups(
  deps: Deps,
): Observable<ReadonlyMap<ExerciseId, ExerciseUserData>> {
  return deps.queries.observe(['sessions', 'exerciseUserData'], async (repos) => {
    const session = await repos.sessions.getActive();
    const ids = [...new Set(session?.exercises.map((slot) => slot.exerciseId) ?? [])];
    const entries = await Promise.all(ids.map((id) => repos.exerciseUserData.get(id)));
    return new Map(entries.flatMap((entry) => (entry ? [[entry.exerciseId, entry] as const] : [])));
  });
}

/**
 * EXL-09, ANL-04: saves the setup memory, note and training max (`trainingMax: null` removes it).
 * Nothing left to store deletes the record.
 */
export async function saveExerciseUserData(
  deps: Deps,
  input: {
    readonly exerciseId: ExerciseId;
    readonly setup: readonly SetupEntry[];
    readonly note?: string;
    readonly trainingMax?: Mass | null;
  },
): Promise<Result<ExerciseUserData | null, SetupError>> {
  if (!deps.content.exercise(input.exerciseId)) return err({ kind: 'unknownExercise' });
  if (input.setup.length > SETUP_MAX) return err({ kind: 'tooMany' });
  const setup: SetupEntry[] = [];
  for (const [index, entry] of input.setup.entries()) {
    const value = entry.value.trim();
    const label = entry.label?.trim();
    const valid =
      (SETUP_FIELDS as readonly string[]).includes(entry.field) &&
      value.length > 0 &&
      value.length <= 60 &&
      (entry.field === 'other'
        ? label !== undefined && label.length > 0 && label.length <= 40
        : true);
    if (!valid) return err({ kind: 'invalidEntry', index });
    setup.push({
      field: entry.field,
      ...(entry.field === 'other' && label ? { label } : {}),
      value,
    });
  }
  if (input.trainingMax) {
    const kg = toKg(input.trainingMax);
    if (!(kg > 0 && kg <= 1000)) return err({ kind: 'invalidTrainingMax' });
  }
  const now = deps.clock.now();
  return deps.uow.write(['exerciseUserData'], async (repos) => {
    const current = await repos.exerciseUserData.get(input.exerciseId);
    const note = (input.note === undefined ? current?.note : input.note)?.trim().slice(0, 2000);
    const trainingMax =
      input.trainingMax === undefined ? current?.trainingMax : (input.trainingMax ?? undefined);
    if (setup.length === 0 && !note && !trainingMax) {
      if (current) await repos.exerciseUserData.delete(input.exerciseId);
      return ok(null);
    }
    const next: ExerciseUserData = {
      exerciseId: input.exerciseId,
      setup,
      ...(note ? { note } : {}),
      ...(trainingMax ? { trainingMax } : {}),
      updatedAt: now,
    };
    await repos.exerciseUserData.put(next);
    return ok(next);
  });
}
