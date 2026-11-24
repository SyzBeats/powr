/**
 * Past sessions (WKT-15, technical concept §6.9): logging a session for a past date and editing
 * or deleting the sets and exercises of a finished one. Pure: the application writes the result
 * in one strict transaction and recomputes the derived data of every exercise it touched.
 */
import type { ExerciseId, LocalDate, SessionId, SetId } from '../ids';
import {
  nextSetIndex,
  type LoggedSet,
  type PlannedSet,
  type Session,
  type SessionExercise,
  type SetType,
} from '../model';
import type { InstantTz } from '../time';
import type { VersionStamp } from '../version';
import { sortSets } from './history';
import { freshKey } from './slots';
import type { SessionState, SetInput } from './types';
import { NOTE_MAX, inputIssues, setFields } from './values';

/** Logged sets of a past session are spaced this far apart (their order is what matters). */
export const PAST_SET_SPACING_MS = 60_000;

export interface PastExerciseInput {
  readonly exerciseId: ExerciseId;
  readonly sets: readonly (SetInput & { readonly state?: 'done' | 'skipped' })[];
  readonly note?: string;
}

export interface PastSessionInput {
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  /** When it started (the chosen time on that day, with the device's offset and zone). */
  readonly startedAt: InstantTz;
  readonly versions: VersionStamp;
  readonly equipmentProfileId: string | null;
  readonly exercises: readonly PastExerciseInput[];
  readonly note?: string;
}

export type PastError =
  | { readonly kind: 'invalidValues'; readonly issues: readonly string[] }
  | { readonly kind: 'unknownSet'; readonly setId: SetId }
  | { readonly kind: 'empty' }
  | { readonly kind: 'idsExhausted' };

function plannedFrom(
  set: SetInput & { readonly state?: 'done' | 'skipped' },
  key: string,
): PlannedSet {
  return {
    key,
    type: set.type ?? 'working',
    reps: set.reps === null ? null : [set.reps, set.reps],
    rir: set.rir === null ? null : [set.rir, set.rir],
    load: null,
  };
}

/** WKT-15: a finished session for a past date, its sets in the order given. */
export function pastSession(
  input: PastSessionInput,
  ids: readonly string[],
): { readonly state: SessionState } | { readonly error: PastError } {
  const issues = input.exercises.flatMap((exercise, index) => [
    ...exercise.sets.flatMap((set, setIndex) =>
      inputIssues(set).map((issue) => `exercises[${index}].sets[${setIndex}].${issue}`),
    ),
    ...((exercise.note?.length ?? 0) > NOTE_MAX ? [`exercises[${index}].note.tooLong`] : []),
  ]);
  if ((input.note?.length ?? 0) > NOTE_MAX) issues.push('note.tooLong');
  if (issues.length > 0) return { error: { kind: 'invalidValues', issues } };
  if (input.exercises.every((exercise) => exercise.sets.length === 0))
    return { error: { kind: 'empty' } };
  let next = 0;
  const sets: LoggedSet[] = [];
  const exercises: SessionExercise[] = [];
  let at = input.startedAt.epochMs;
  for (const [index, exercise] of input.exercises.entries()) {
    const key = `p${index + 1}`;
    const planned = exercise.sets.map((set, setIndex) => plannedFrom(set, `s${setIndex + 1}`));
    exercises.push({
      key,
      exerciseId: exercise.exerciseId,
      origin: 'added',
      goal: 'hypertrophy',
      priority: 'secondary',
      progression: 'manual',
      prescription: null,
      sets: planned,
      restSeconds: null,
      skipped: false,
      ...(exercise.note?.trim() ? { note: exercise.note.trim() } : {}),
    });
    for (const [setIndex, values] of exercise.sets.entries()) {
      const id = ids[next++];
      if (id === undefined) return { error: { kind: 'idsExhausted' } };
      const skipped = values.state === 'skipped';
      sets.push({
        id: id as SetId,
        sessionId: input.sessionId,
        exerciseId: exercise.exerciseId,
        index: nextSetIndex(sets, exercise.exerciseId),
        type: values.type ?? 'working',
        state: skipped ? 'skipped' : 'done',
        performedAt: { ...input.startedAt, epochMs: at },
        localDate: input.localDate,
        slotKey: key,
        setKey: planned[setIndex]!.key,
        ...(skipped
          ? { load: null, reps: null, effort: { rir: null, source: 'none' } }
          : setFields(values, false)),
      });
      at += PAST_SET_SPACING_MS;
    }
  }
  const session: Session = {
    id: input.sessionId,
    localDate: input.localDate,
    startedAt: input.startedAt,
    endedAt: { ...input.startedAt, epochMs: Math.max(at, input.startedAt.epochMs) },
    status: 'finished',
    versions: input.versions,
    origin: 'freestyle',
    backdated: true,
    equipmentProfileId: input.equipmentProfileId,
    exercises,
    groups: [],
    cursor: null,
    timer: null,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    readiness: null,
    changes: [],
    revision: 0,
    undo: null,
  };
  return { state: { session, sets } };
}

/** WKT-15 edits of a finished session. */
export type PastEdit =
  | { readonly kind: 'editSet'; readonly setId: SetId; readonly values: Partial<SetInput> }
  | { readonly kind: 'deleteSet'; readonly setId: SetId }
  | {
      readonly kind: 'addSet';
      readonly exerciseId: ExerciseId;
      readonly values: SetInput;
      readonly setType?: SetType;
    }
  | { readonly kind: 'deleteExercise'; readonly exerciseId: ExerciseId }
  | { readonly kind: 'note'; readonly note: string | null };

/** Applies edits to a finished session; the exercises they touch need a recompute. */
export function applyPastEdits(
  state: SessionState,
  edits: readonly PastEdit[],
  ids: readonly string[],
):
  | { readonly state: SessionState; readonly touched: readonly ExerciseId[] }
  | { readonly error: PastError } {
  let { session } = state;
  let sets = [...state.sets];
  const touched = new Set<ExerciseId>();
  let next = 0;
  for (const edit of edits) {
    switch (edit.kind) {
      case 'editSet': {
        const current = sets.find((set) => set.id === edit.setId);
        if (!current) return { error: { kind: 'unknownSet', setId: edit.setId } };
        const issues = inputIssues(edit.values);
        if (issues.length > 0) return { error: { kind: 'invalidValues', issues } };
        const merged: SetInput = {
          load: edit.values.load === undefined ? current.load : edit.values.load,
          reps: edit.values.reps === undefined ? current.reps : edit.values.reps,
          rir: edit.values.rir === undefined ? current.effort.rir : edit.values.rir,
          openEnded: edit.values.openEnded ?? current.effort.openEnded ?? false,
          ...((edit.values.durationMs ?? current.durationMs) === undefined
            ? {}
            : { durationMs: edit.values.durationMs ?? current.durationMs }),
          technique:
            edit.values.technique === undefined
              ? (current.technique ?? null)
              : edit.values.technique,
          flags: edit.values.flags ?? current.flags ?? {},
          note: edit.values.note === undefined ? (current.note ?? null) : edit.values.note,
        };
        const {
          durationMs: _d,
          technique: _t,
          flags: _f,
          note: _n,
          repsLeft: _l,
          repsRight: _r,
          ...kept
        } = current;
        const edited: LoggedSet = {
          ...kept,
          ...setFields(merged, false),
          type: edit.values.type ?? current.type,
          state: 'done',
        };
        sets = sets.map((set) => (set.id === current.id ? edited : set));
        touched.add(current.exerciseId);
        break;
      }
      case 'deleteSet': {
        const current = sets.find((set) => set.id === edit.setId);
        if (!current) return { error: { kind: 'unknownSet', setId: edit.setId } };
        sets = sets.filter((set) => set.id !== edit.setId);
        touched.add(current.exerciseId);
        break;
      }
      case 'addSet': {
        const issues = inputIssues(edit.values);
        if (issues.length > 0) return { error: { kind: 'invalidValues', issues } };
        const id = ids[next++];
        if (id === undefined) return { error: { kind: 'idsExhausted' } };
        let slot = session.exercises.find((exercise) => exercise.exerciseId === edit.exerciseId);
        if (!slot) {
          slot = {
            key: freshKey(
              session.exercises.map((exercise) => exercise.key),
              'p',
            ),
            exerciseId: edit.exerciseId,
            origin: 'added',
            goal: 'hypertrophy',
            priority: 'secondary',
            progression: 'manual',
            prescription: null,
            sets: [],
            restSeconds: null,
            skipped: false,
          };
          session = { ...session, exercises: [...session.exercises, slot] };
        }
        const setKey = freshKey(
          slot.sets.map((set) => set.key),
          'x',
        );
        const planned = plannedFrom({ ...edit.values, type: edit.setType ?? 'working' }, setKey);
        const slotKey = slot.key;
        session = {
          ...session,
          exercises: session.exercises.map((exercise) =>
            exercise.key === slotKey
              ? { ...exercise, sets: [...exercise.sets, planned] }
              : exercise,
          ),
        };
        const last = sortSets(sets).at(-1);
        const epochMs =
          (last?.performedAt.epochMs ?? session.startedAt.epochMs) + PAST_SET_SPACING_MS;
        sets.push({
          id: id as SetId,
          sessionId: session.id,
          exerciseId: edit.exerciseId,
          index: nextSetIndex(sets, edit.exerciseId),
          type: edit.setType ?? 'working',
          state: 'done',
          performedAt: { ...session.startedAt, epochMs },
          localDate: session.localDate,
          slotKey,
          setKey,
          ...setFields(edit.values, false),
        });
        touched.add(edit.exerciseId);
        break;
      }
      case 'deleteExercise': {
        sets = sets.filter((set) => set.exerciseId !== edit.exerciseId);
        session = {
          ...session,
          exercises: session.exercises.filter(
            (exercise) => exercise.exerciseId !== edit.exerciseId,
          ),
          groups: session.groups
            .map((group) => ({
              ...group,
              slotKeys: group.slotKeys.filter((key) =>
                session.exercises.some(
                  (exercise) => exercise.key === key && exercise.exerciseId !== edit.exerciseId,
                ),
              ),
            }))
            .filter((group) => group.slotKeys.length >= 2),
        };
        touched.add(edit.exerciseId);
        break;
      }
      case 'note': {
        if ((edit.note?.length ?? 0) > NOTE_MAX)
          return { error: { kind: 'invalidValues', issues: ['note.tooLong'] } };
        const { note: _old, ...rest } = session;
        const text = edit.note?.trim() ?? '';
        session = text ? { ...rest, note: text } : rest;
        break;
      }
    }
  }
  return {
    state: { session: { ...session, revision: session.revision + 1 }, sets },
    touched: [...touched],
  };
}
