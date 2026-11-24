/**
 * Lookups over a session's planned side and its logged sets, and the cursor order (WKT-02,
 * WKT-05): exercises in list order, a superset or circuit as one unit at its first member, its
 * warm-ups first and then its working sets in rounds (A1 B1 A2 B2 …).
 */
import type { ExerciseId } from '../ids';
import type {
  LoggedSet,
  PlannedSet,
  Session,
  SessionCursor,
  SessionExercise,
  SessionGroup,
} from '../model';
import { sortSets } from './history';
import type { SessionState } from './types';

export function slotOf(session: Session, slotKey: string): SessionExercise | undefined {
  return session.exercises.find((exercise) => exercise.key === slotKey);
}

export function plannedSetOf(slot: SessionExercise, setKey: string): PlannedSet | undefined {
  return slot.sets.find((set) => set.key === setKey);
}

/** The logged record (done or skipped) of a planned set. */
export function loggedOf(
  sets: readonly LoggedSet[],
  slotKey: string,
  setKey: string,
): LoggedSet | undefined {
  return sets.find((set) => set.slotKey === slotKey && set.setKey === setKey);
}

export function isPending(state: SessionState, slot: SessionExercise, setKey: string): boolean {
  return !slot.skipped && loggedOf(state.sets, slot.key, setKey) === undefined;
}

export const isWorking = (set: Pick<PlannedSet, 'type'>): boolean => set.type !== 'warmup';

/** The slot's done working sets in this session, in order. */
export function doneWorkingSets(state: SessionState, slotKey: string): LoggedSet[] {
  return sortSets(
    state.sets.filter(
      (set) => set.slotKey === slotKey && set.state === 'done' && set.type !== 'warmup',
    ),
  );
}

/** An exercise's sets in this session (every slot, M0 quick-log sets included), in order. */
export function exerciseSetsOf(state: SessionState, exerciseId: ExerciseId): LoggedSet[] {
  return sortSets(state.sets.filter((set) => set.exerciseId === exerciseId));
}

export function groupOf(session: Session, slotKey: string): SessionGroup | undefined {
  return session.groups.find((group) => group.slotKeys.includes(slotKey));
}

/** Every planned set in cursor order. */
export function cursorOrder(session: Session): SessionCursor[] {
  const order: SessionCursor[] = [];
  const seen = new Set<string>();
  for (const exercise of session.exercises) {
    if (seen.has(exercise.key)) continue;
    const group = groupOf(session, exercise.key);
    const members = group
      ? session.exercises.filter((candidate) => group.slotKeys.includes(candidate.key))
      : [exercise];
    for (const member of members) seen.add(member.key);
    for (const member of members) {
      for (const set of member.sets) {
        if (!isWorking(set)) order.push({ slotKey: member.key, setKey: set.key });
      }
    }
    const rounds = Math.max(0, ...members.map((member) => member.sets.filter(isWorking).length));
    for (let round = 0; round < rounds; round++) {
      for (const member of members) {
        const set = member.sets.filter(isWorking)[round];
        if (set) order.push({ slotKey: member.key, setKey: set.key });
      }
    }
  }
  return order;
}

/** The first pending planned set in cursor order; null when the plan is done. */
export function firstPending(state: SessionState): SessionCursor | null {
  for (const cursor of cursorOrder(state.session)) {
    const slot = slotOf(state.session, cursor.slotKey);
    if (slot && isPending(state, slot, cursor.setKey)) return cursor;
  }
  return null;
}

/** The cursor after a change: kept while it points at a pending set, else the first pending. */
export function settleCursor(state: SessionState): SessionCursor | null {
  const current = state.session.cursor;
  if (current) {
    const slot = slotOf(state.session, current.slotKey);
    if (slot && plannedSetOf(slot, current.setKey) && isPending(state, slot, current.setKey)) {
      return current;
    }
  }
  return firstPending(state);
}

/** The working-set round of a planned set within its slot (0-based), or -1 for warm-ups. */
export function roundOf(slot: SessionExercise, setKey: string): number {
  return slot.sets.filter(isWorking).findIndex((set) => set.key === setKey);
}

/** A key not used yet: `prefix` + the next number. */
export function freshKey(used: readonly string[], prefix: string): string {
  let n = 1;
  while (used.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
