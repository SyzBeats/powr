import {
  toLocalDate,
  type ExerciseId,
  type LoggedSet,
  type Session,
  type SessionId,
} from '@powr/domain';
import {
  emptyExerciseState,
  exposuresOf,
  rebuildExerciseState,
  seedFromBaseline,
  type ExerciseState,
  type RebuildResult,
} from '@powr/domain/session';

import type { Deps } from '../deps';
import type { DerivedExercise } from '../ports';
import type { Prepared } from './context';

/*
 * Derived data (technical concept §8.2.8, §6.9): `dExerciseState`, `dSessionE1rm` and `dPrs` are
 * a function of the raw logs and the inputs `Prepared.keyOf` fingerprints. A missing or stale
 * state is rebuilt from the exercise's raw sets before a session reads it; finishing, editing or
 * deleting a session rebuilds the exercises it touched. The engine worker of §8.7.8 does not exist
 * yet (TD-32): the rebuild runs in the lazy session chunk, an exercise at a time.
 */

/** Sessions that count as history: finished and partial ones (never active or discarded). */
const COUNTS: ReadonlySet<Session['status']> = new Set(['finished', 'partial']);

function bySessionOrder(a: Session, b: Session): number {
  return (
    (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0) ||
    a.startedAt.epochMs - b.startedAt.epochMs ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** One exercise's derived data from its sets and their sessions (pure). */
export function deriveExercise(
  deps: Deps,
  prepared: Prepared,
  exerciseId: ExerciseId,
  sets: readonly LoggedSet[],
  sessions: readonly Session[],
): RebuildResult | null {
  const exercise = deps.content.exercise(exerciseId);
  if (!exercise) return null;
  const rules = prepared.rules(exerciseId);
  const input = { exercise, rules, level: prepared.level, bodyweightAt: prepared.bodyweightAt };
  let start = emptyExerciseState(exerciseId, prepared.keyOf(exerciseId));
  const baseline = prepared.baseline(exerciseId);
  if (baseline) {
    const created = prepared.profile ? toLocalDate(prepared.profile.createdAt) : null;
    const today = toLocalDate(deps.clock.now());
    start = seedFromBaseline(start, baseline, { today, fallback: created ?? today }, input);
  }
  const history = sessions.filter((session) => COUNTS.has(session.status)).toSorted(bySessionOrder);
  const notes = (session: Session) =>
    session.exercises.find((slot) => slot.exerciseId === exerciseId && slot.note)?.note;
  return rebuildExerciseState(
    start,
    exposuresOf(
      sets,
      history.map((session) => ({
        id: session.id,
        localDate: session.localDate,
        note: notes(session),
      })),
    ),
    input,
  );
}

/** Rebuilds the derived data of these exercises from the raw logs (§6.9). */
export async function rebuildExercises(
  deps: Deps,
  prepared: Prepared,
  exerciseIds: readonly ExerciseId[],
): Promise<ExerciseState[]> {
  if (exerciseIds.length === 0) return [];
  const raw = await deps.uow.read(['sets', 'sessions'], async (repos) => {
    const byExercise = new Map<ExerciseId, LoggedSet[]>();
    const sessionIds = new Set<SessionId>();
    for (const id of exerciseIds) {
      const sets = await repos.sets.byExercise(id);
      byExercise.set(id, sets);
      for (const set of sets) sessionIds.add(set.sessionId);
    }
    return { byExercise, sessions: await repos.sessions.byIds([...sessionIds]) };
  });
  const derived = new Map<ExerciseId, DerivedExercise>();
  for (const id of exerciseIds) {
    const result = deriveExercise(deps, prepared, id, raw.byExercise.get(id) ?? [], raw.sessions);
    if (result) derived.set(id, result);
  }
  await deps.uow.write(['dExerciseState', 'dSessionE1rm', 'dPrs'], async (repos) => {
    for (const [id, result] of derived) await repos.derived.replaceExercise(id, result);
  });
  return [...derived.values()].map((result) => result.state);
}

/** Rebuilds what is missing or stale among these exercises (version, override or input change). */
export async function ensureDerived(
  deps: Deps,
  prepared: Prepared,
  exerciseIds: readonly ExerciseId[],
): Promise<void> {
  const ids = [...new Set(exerciseIds)].filter((id) => deps.content.exercise(id) !== undefined);
  if (ids.length === 0) return;
  const states = await deps.uow.read(['dExerciseState'], (repos) =>
    repos.derived.exerciseStates(ids),
  );
  const fresh = new Set(
    states
      .filter((state) => state.key === prepared.keyOf(state.exerciseId))
      .map((state) => state.exerciseId),
  );
  await rebuildExercises(
    deps,
    prepared,
    ids.filter((id) => !fresh.has(id)),
  );
}
