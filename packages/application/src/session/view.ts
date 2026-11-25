import type { ExerciseId, MuscleId, RoundingMode } from '@powr/domain';
import { itemsOf } from '@powr/domain/equipment';
import type { Implement } from '@powr/domain/loading';
import { rankCandidates, type SlotCandidate } from '@powr/domain/planning';
import { implementOf, loadless, sessionView, type SessionView } from '@powr/domain/session';

import type { Deps } from '../deps';
import type { Observable } from '../ports';
import { equipmentProfileFor, prepare, sessionContext } from './context';

/**
 * The live session screen (WKT-02, §8.5): the active session, its sets and the derived state
 * of its exercises from one live query, mapped to the domain's view (every planned set with its
 * logged record or its suggestion and "Why?", the last-time panel, timer, clock and PRs).
 * Emits null when no session is active. Emissions keep their order: a slow mapping never
 * overwrites a newer one.
 */
export function observeActiveSession(deps: Deps): Observable<SessionView | null> {
  return {
    subscribe(observer) {
      let latest = 0;
      let closed = false;
      const subscription = deps.queries.activeSessionData().subscribe({
        next: (data) => {
          const sequence = ++latest;
          if (!data) {
            observer.next(null);
            return;
          }
          prepare(deps).then(
            (prepared) => {
              if (closed || sequence !== latest) return;
              const ctx = sessionContext(deps, prepared, {
                now: deps.clock.now(),
                ids: [],
                states: data.states,
                readiness: [],
                equipmentProfileId: data.session.equipmentProfileId,
              });
              observer.next(sessionView({ session: data.session, sets: data.sets }, ctx));
            },
            (error: unknown) => observer.error?.(error),
          );
        },
        error: (error) => observer.error?.(error),
      });
      return {
        unsubscribe() {
          closed = true;
          subscription.unsubscribe();
        },
      };
    },
  };
}

/**
 * WKT-08: alternatives for a slot of the active session, best first (MAP-03 ranking): the same
 * movement pattern first, then exercises that train one of its primary muscles directly; only
 * equipment-valid and not avoided exercises (EQP-04, EXL-08).
 */
export async function substitutionOptions(
  deps: Deps,
  slotKey: string,
): Promise<readonly SlotCandidate[]> {
  const prepared = await prepare(deps);
  const session = await deps.uow.read(['sessions'], (repos) => repos.sessions.getActive());
  const slot = session?.exercises.find((entry) => entry.key === slotKey);
  const exercise = slot && deps.content.exercise(slot.exerciseId);
  const equipment = equipmentProfileFor(prepared, session?.equipmentProfileId);
  if (!slot || !exercise || !equipment) return [];
  const planned =
    session?.plannedSessionId && slot.planSlotKey
      ? (
          await deps.uow.read(['plannedSessions'], (repos) =>
            repos.plannedSessions.get(session.plannedSessionId!),
          )
        )?.slots.find((entry) => entry.key === slot.planSlotKey)
      : undefined;
  const targets: readonly MuscleId[] =
    planned?.targets ??
    exercise.muscles.filter((credit) => credit.credit === 1).map((credit) => credit.muscle);
  // A swap for this session may leave the competition lift (the rack is taken, a sore joint):
  // the slot's pattern and primary muscles decide, not the plan's lift rule.
  const shape = { pattern: planned?.pattern ?? exercise.pattern, targets };
  const request = {
    equipment: itemsOf(equipment),
    avoid: prepared.profile?.avoid ?? { exercises: [], patterns: [] },
    preferred: prepared.profile?.preferredExercises ?? [],
  };
  const lookup = (id: ExerciseId) => deps.content.exercise(id);
  const all = deps.content.exercises();
  const rules = prepared.rules(null);
  const strict = rankCandidates(shape, all, request, lookup, rules);
  const relaxed = rankCandidates(shape, all, request, lookup, rules, true);
  const seen = new Set<string>([slot.exerciseId]);
  return [...strict, ...relaxed].filter((candidate) => {
    if (seen.has(candidate.exerciseId)) return false;
    seen.add(candidate.exerciseId);
    return true;
  });
}

/**
 * WKT-07, WKT-03: the implement each exercise's loads are rounded to (the session's equipment
 * profile, else the exercise's default increment), for the load stepper's next and previous
 * achievable load and the plate calculator. Exercises without a loadable implement are left out.
 */
export async function loadImplements(
  deps: Deps,
  exerciseIds: readonly ExerciseId[],
): Promise<
  ReadonlyMap<ExerciseId, { readonly implement: Implement; readonly mode: RoundingMode }>
> {
  const prepared = await prepare(deps);
  const session = await deps.uow.read(['sessions'], (repos) => repos.sessions.getActive());
  const ctx = sessionContext(deps, prepared, {
    now: deps.clock.now(),
    ids: [],
    states: [],
    readiness: [],
    equipmentProfileId: session?.equipmentProfileId ?? null,
  });
  const result = new Map<ExerciseId, { implement: Implement; mode: RoundingMode }>();
  for (const id of exerciseIds) {
    const exercise = deps.content.exercise(id);
    if (!exercise || loadless(exercise)) continue;
    const equipment = ctx.equipment(id);
    result.set(id, {
      implement: equipment.bodyweight?.added ?? implementOf(equipment, exercise),
      mode: equipment.mode,
    });
  }
  return result;
}
