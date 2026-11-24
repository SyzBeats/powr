/**
 * The pure session reducer (technical concept §8.5): `reduceSession(state, event, ctx)` returns
 * the next state, the effects the infrastructure must run and the event's result. It reads time
 * and new IDs from the context only, so it is deterministic; property tests replay random event
 * sequences through it (determinism, undo, PR and timer invariants, volume credits).
 *
 * Undo (WKT-12) is one level deep: an undoable event stores the session as it was and the set
 * records to restore and remove; `UNDO` writes them back, timers included, and the PRs follow
 * because they are computed from the sets. Timer, note, cursor and readiness events keep the
 * pending undo; finishing, discarding and a substitution for the whole mesocycle clear it.
 */
import type { ExerciseId, SessionId, SetId } from '../ids';
import {
  SET_LIMITS,
  nextSetIndex,
  type AdjustmentKind,
  type LoggedSet,
  type PlannedSession,
  type PlannedSet,
  type ReadinessEntry,
  type RirRange,
  type Session,
  type SessionChange,
  type SessionExercise,
  type TimerState,
} from '../model';
import { restSeconds as defaultRest } from '../rest';
import { toLocalDate } from '../time';
import type { VersionStamp } from '../version';
import { addedExercise, exercisesFromPlannedSession, repeatedExercises, warmupsFor } from './build';
import { setGuardrails } from './guardrails';
import { sortSets } from './history';
import { sessionPrs } from './live';
import type { PrRecord } from './prs';
import { assessReadiness, readinessProposals, returnProposals } from './readiness';
import {
  firstPending,
  freshKey,
  groupOf,
  isPending,
  isWorking,
  loggedOf,
  plannedSetOf,
  roundOf,
  settleCursor,
  slotOf,
} from './slots';
import { suggestSet } from './suggest';
import {
  STALE_SESSION_MS,
  UNDO_TTL_MS,
  adjustTimer,
  newTimer,
  restartTimer,
  timerView,
} from './timers';
import {
  READINESS_ITEMS,
  type Announcement,
  type Guardrail,
  type SessionContext,
  type SessionEffect,
  type SessionEvent,
  type SessionProposal,
  type SessionRejection,
  type SessionResult,
  type SessionState,
  type SetInput,
  type Transition,
} from './types';
import { NOTE_MAX, inputIssues, plausibilityIssues, setFields } from './values';

type UndoMode = 'record' | 'keep' | 'clear';

interface Change {
  readonly session: Session;
  readonly sets: readonly LoggedSet[];
  readonly undo: UndoMode;
  readonly effects?: readonly SessionEffect[];
  readonly result?: Partial<SessionResult>;
  readonly readiness?: ReadinessEntry;
}

const EMPTY_RESULT: SessionResult = {
  rejected: null,
  undoToken: null,
  setId: null,
  prs: [],
  next: null,
  hints: [],
  timer: null,
};

function reject(state: SessionState, rejected: SessionRejection): Transition {
  return { state, effects: [], result: { ...EMPTY_RESULT, rejected, timer: state.session.timer } };
}

/** A transition that changes nothing (RESUME, a stale TIMER_FIRED). */
function unchanged(
  state: SessionState,
  effects: readonly SessionEffect[],
  extra: Partial<SessionResult> = {},
): Transition {
  return { state, effects, result: { ...EMPTY_RESULT, timer: state.session.timer, ...extra } };
}

/** Fresh IDs from the context's pool, in order. */
function idPool(ids: readonly string[]): { next(): string | null } {
  let used = 0;
  return { next: () => ids[used++] ?? null };
}

const sameSchedule = (a: TimerState | null, b: TimerState | null) =>
  a !== null &&
  b !== null &&
  a.id === b.id &&
  a.startedAtEpochMs === b.startedAtEpochMs &&
  a.targetMs === b.targetMs &&
  a.adjustMs === b.adjustMs &&
  a.mode === b.mode &&
  a.softMinMs === b.softMinMs;

/** Timer alerts to arm and disarm when the session's timer changes. */
function timerEffects(before: TimerState | null, after: TimerState | null): SessionEffect[] {
  const effects: SessionEffect[] = [];
  if (before && before.id !== after?.id) effects.push({ kind: 'timer.disarm', timerId: before.id });
  if (after && !sameSchedule(before, after)) effects.push({ kind: 'timer.arm', timer: after });
  return effects;
}

/** Settles the cursor, bumps the revision, records undo and diffs the set records. */
function commit(before: SessionState, change: Change, ctx: SessionContext): Transition {
  const revision = before.session.revision + 1;
  const beforeById = new Map(before.sets.map((set) => [set.id, set]));
  const afterById = new Map(change.sets.map((set) => [set.id, set]));
  const putSets = change.sets.filter((set) => beforeById.get(set.id) !== set);
  const deleteSetIds = before.sets.filter((set) => !afterById.has(set.id)).map((set) => set.id);
  const token = `u${revision}`;
  const { undo: _ignored, ...core } = before.session;
  const undo =
    change.undo === 'record'
      ? {
          token,
          expiresAtEpochMs: ctx.now.epochMs + UNDO_TTL_MS,
          session: core,
          restoreSets: before.sets.filter((set) => afterById.get(set.id) !== set),
          removeSetIds: change.sets.filter((set) => !beforeById.has(set.id)).map((set) => set.id),
        }
      : change.undo === 'keep'
        ? before.session.undo
        : null;
  const draft: SessionState = { session: change.session, sets: change.sets };
  const active = change.session.status === 'active';
  const session: Session = {
    ...change.session,
    cursor: active ? settleCursor(draft) : null,
    revision,
    undo,
  };
  const state: SessionState = { session, sets: change.sets };
  const next =
    active && session.cursor
      ? suggestSet(state, session.cursor.slotKey, session.cursor.setKey, ctx)
      : null;
  return {
    state,
    effects: [
      {
        kind: 'persist',
        session,
        putSets,
        deleteSetIds,
        ...(change.readiness ? { readiness: change.readiness } : {}),
      },
      ...timerEffects(before.session.timer, session.timer),
      ...(change.effects ?? []),
    ],
    result: {
      ...EMPTY_RESULT,
      undoToken: change.undo === 'record' ? token : null,
      next,
      timer: session.timer,
      ...change.result,
    },
  };
}

function updateSlot(
  session: Session,
  slotKey: string,
  update: (slot: SessionExercise) => SessionExercise,
): Session {
  return {
    ...session,
    exercises: session.exercises.map((slot) => (slot.key === slotKey ? update(slot) : slot)),
  };
}

const withNote = <T extends { readonly note?: string }>(record: T, note: string | null): T => {
  const { note: _old, ...rest } = record;
  const text = note?.trim() ?? '';
  return (text ? { ...rest, note: text } : rest) as T;
};

function lastDone(sets: readonly LoggedSet[]): LoggedSet | undefined {
  return sortSets(sets.filter((set) => set.state === 'done')).at(-1);
}

/** TMR-02/03: rest after a working set of a slot (per-exercise override > plan > default). */
export function restSecondsFor(slot: SessionExercise, ctx: SessionContext): number {
  const exercise = ctx.exercise(slot.exerciseId);
  const rules = ctx.rules(slot.exerciseId);
  if (exercise) {
    const param = rules[`session.rest.${exercise.defaults.restClass}`];
    if (param.meta.origin === 'exercise') return param.value;
  }
  if (slot.restSeconds !== null) return slot.restSeconds;
  return exercise ? defaultRest({ restClass: exercise.defaults.restClass }, rules).value : 120;
}

/**
 * TMR-01/02/13: the timer after a confirmed set. Warm-ups get their short rest; inside a
 * superset round the transition timer runs, after the round the longest rest of the group;
 * the last set of the session starts none. Count-up mode (TMR-07) keeps the suggested rest as
 * the target and adds the soft minimum.
 */
function timerAfter(
  after: SessionState,
  slot: SessionExercise,
  planned: PlannedSet,
  id: string,
  ctx: SessionContext,
): TimerState | null {
  const preference = ctx.preferences.exercises.find(
    (entry) => entry.exerciseId === slot.exerciseId,
  );
  if (!ctx.preferences.restAutoStart || preference?.restAutoStart === false) return null;
  const next = settleCursor(after);
  if (!next) return null;
  const rules = ctx.rules(null);
  let kind: TimerState['kind'] = 'rest';
  let seconds: number;
  if (planned.type === 'warmup') {
    seconds = planned.restSeconds ?? rules['session.rest.warmupLight'].value;
  } else {
    const group = groupOf(after.session, slot.key);
    const nextSlot = slotOf(after.session, next.slotKey);
    if (
      group &&
      nextSlot &&
      next.slotKey !== slot.key &&
      group.slotKeys.includes(next.slotKey) &&
      roundOf(nextSlot, next.setKey) === roundOf(slot, planned.key)
    ) {
      kind = 'transition';
      seconds = rules['session.rest.supersetTransition'].value;
    } else {
      const members = group
        ? after.session.exercises.filter((other) => group.slotKeys.includes(other.key))
        : [slot];
      seconds = Math.max(...members.map((member) => restSecondsFor(member, ctx)));
    }
  }
  const countUp = ctx.preferences.restMode === 'countup' && kind === 'rest';
  const exercise = ctx.exercise(slot.exerciseId);
  const softMin = rules['session.rest.countUpSoftMin'].value;
  return newTimer({
    id,
    kind,
    mode: countUp ? 'countup' : 'countdown',
    nowEpochMs: ctx.now.epochMs,
    targetMs: seconds * 1000,
    ...(countUp
      ? {
          softMinMs:
            (exercise?.mechanics === 'compound' ? softMin.compound : softMin.isolation) * 1000,
        }
      : {}),
    slotKey: kind === 'transition' ? next.slotKey : slot.key,
  });
}

function newPrs(before: SessionState, after: SessionState, ctx: SessionContext): PrRecord[] {
  const known = new Set(sessionPrs(before, ctx).prs.map((pr) => pr.id));
  return sessionPrs(after, ctx).prs.filter((pr) => !known.has(pr.id));
}

function shiftRir(range: RirRange | null, add: number): RirRange | null {
  return range === null ? null : [Math.min(10, range[0] + add), Math.min(10, range[1] + add)];
}

/** RDY-03 / PRG-13: one accepted change applied to the pending sets of its slots. */
function applyChange(
  state: SessionState,
  session: Session,
  change: SessionChange,
  ctx: SessionContext,
): Session {
  let next = session;
  for (const slotKey of change.slotKeys) {
    next = updateSlot(next, slotKey, (slot) => {
      const pending = (set: PlannedSet) => isPending(state, slot, set.key);
      let sets = slot.sets;
      const dropLast = (count: number, test: (set: PlannedSet) => boolean, keepWorking: number) => {
        let dropped = 0;
        const keep = [...sets];
        for (let index = keep.length - 1; index >= 0 && dropped < count; index--) {
          const set = keep[index]!;
          if (!test(set) || !pending(set)) continue;
          if (keep.filter(isWorking).length <= keepWorking) break;
          keep.splice(index, 1);
          dropped++;
        }
        sets = keep;
      };
      switch (change.kind) {
        case 'capTopSet': {
          const top = sets.some((set) => set.type === 'top');
          sets = sets.map((set) =>
            pending(set) && (top ? set.type === 'top' : isWorking(set))
              ? { ...set, rir: shiftRir(set.rir, change.rirAdd ?? 0) }
              : set,
          );
          break;
        }
        case 'easeCompounds':
          sets = sets.map((set) =>
            pending(set) && isWorking(set)
              ? { ...set, rir: shiftRir(set.rir, change.rirAdd ?? 0) }
              : set,
          );
          break;
        case 'dropBackoff':
          dropLast(change.dropSets ?? 0, (set) => set.type === 'backoff', 1);
          break;
        case 'trimVolume':
          dropLast(change.dropSets ?? 0, isWorking, 1);
          break;
        case 'returnFromBreak': {
          const working = sets.filter(isWorking).length;
          if (change.setsPct) {
            const share = (change.setsPct.min + change.setsPct.max) / 200;
            const keep = Math.max(1, Math.round(working * share));
            dropLast(working - keep, isWorking, keep);
          }
          const calibration = ctx.rules(slot.exerciseId)['progression.calibration'].value.targetRir;
          sets = sets.map((set) =>
            pending(set) && isWorking(set)
              ? {
                  ...set,
                  rir: change.calibrate
                    ? ([calibration.min, calibration.max] as const)
                    : shiftRir(set.rir, change.rirAdd ?? 0),
                }
              : set,
          );
          return { ...slot, sets, ...(change.loadPct ? { loadPct: change.loadPct } : {}) };
        }
      }
      return { ...slot, sets };
    });
  }
  return { ...next, changes: [...next.changes, change] };
}

function validChange(session: Session, change: SessionChange): boolean {
  return (
    change.slotKeys.length > 0 &&
    change.slotKeys.every((key) => slotOf(session, key) !== undefined) &&
    (change.rirAdd === undefined || (change.rirAdd >= 0 && change.rirAdd <= 5)) &&
    (change.dropSets === undefined ||
      (Number.isInteger(change.dropSets) && change.dropSets >= 0 && change.dropSets <= 10))
  );
}

function readinessIssues(items: ReadinessEntry['items']): string[] {
  const issues: string[] = [];
  for (const item of READINESS_ITEMS) {
    const value = items[item];
    if (value === undefined || value === null) continue;
    const [min, max, step] =
      item === 'sleepHours' ? [0, 24, 0.25] : item === 'prs' ? [0, 10, 1] : [1, 5, 1];
    if (!(value >= min && value <= max) || !Number.isInteger(value / step))
      issues.push(`${item}.outOfRange`);
  }
  return issues;
}

/** The engine model a slot falls back to when manual mode is switched off (WKT-09). */
function engineModel(slot: SessionExercise): SessionExercise['progression'] {
  const mode = slot.prescription?.mode;
  return mode === 'topBackoff' || mode === 'rpe' || mode === 'percent'
    ? 'rpe'
    : 'doubleProgression';
}

/** Applies one event. Rejected events return the state unchanged with the reason. */
export function reduceSession(
  state: SessionState,
  event: SessionEvent,
  ctx: SessionContext,
): Transition {
  const { session } = state;
  const ids = idPool(ctx.ids);
  const nowMs = ctx.now.epochMs;
  if (session.status !== 'active' && event.type !== 'RESUME')
    return reject(state, { kind: 'notActive' });

  switch (event.type) {
    case 'CONFIRM_SET': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      const planned = plannedSetOf(slot, event.setKey);
      if (!planned) return reject(state, { kind: 'unknownSet', key: event.setKey });
      if (loggedOf(state.sets, slot.key, planned.key))
        return reject(state, { kind: 'alreadyLogged', setKey: planned.key });
      const issues = inputIssues(event.values);
      if (issues.length > 0) return reject(state, { kind: 'invalidValues', issues });
      const fields = setFields(event.values, slot.perSide === true);
      const implausible = plausibilityIssues(fields, slot.exerciseId, ctx);
      if (implausible.length > 0 && !event.confirmImplausible)
        return reject(state, { kind: 'implausible', issues: implausible });
      const id = ids.next();
      if (id === null) return reject(state, { kind: 'idsExhausted' });
      const suggested = suggestSet(state, slot.key, planned.key, ctx)?.value;
      const previous = lastDone(state.sets);
      const set: LoggedSet = {
        id: id as SetId,
        sessionId: session.id,
        exerciseId: slot.exerciseId,
        index: nextSetIndex(state.sets, slot.exerciseId),
        type: event.values.type ?? planned.type,
        state: 'done',
        performedAt: ctx.now,
        localDate: session.localDate,
        slotKey: slot.key,
        setKey: planned.key,
        ...fields,
        ...(previous ? { restBeforeMs: Math.max(0, nowMs - previous.performedAt.epochMs) } : {}),
        ...(suggested
          ? {
              prescription: {
                load: suggested.load,
                reps: suggested.reps,
                rir: suggested.rir,
                ...(suggested.durationS === null ? {} : { durationS: suggested.durationS }),
              },
            }
          : {}),
      };
      const sets = [...state.sets, set];
      const draft = updateSlot(session, slot.key, (current) => ({ ...current, skipped: false }));
      const after: SessionState = { session: draft, sets };
      const timerId = ids.next();
      const timer = timerId ? timerAfter(after, slot, planned, timerId, ctx) : null;
      const prs = newPrs(state, after, ctx);
      const hints: Guardrail[] = setGuardrails(state, after, set, slot, ctx);
      const nextCursor = settleCursor(after);
      const announcements: Announcement[] = [
        { kind: 'setLogged', slotKey: slot.key, setKey: planned.key },
      ];
      const slotDone = !slot.sets.some(
        (other) => other.key !== planned.key && isPending(after, slot, other.key),
      );
      if (slotDone) announcements.push({ kind: 'exerciseDone', slotKey: slot.key });
      if (!nextCursor) announcements.push({ kind: 'sessionDone' });
      if (timer) {
        announcements.push(
          timer.kind === 'transition'
            ? {
                kind: 'transition',
                toSlotKey: timer.slotKey ?? slot.key,
                seconds: timer.targetMs / 1000,
              }
            : { kind: 'restStarted', seconds: timer.targetMs / 1000 },
        );
      }
      return commit(
        state,
        {
          session: { ...draft, timer },
          sets,
          undo: 'record',
          effects: [
            { kind: 'cue', cue: 'setConfirmed' },
            ...(prs.length > 0 ? [{ kind: 'celebrate', prs } as const] : []),
            ...announcements.map((announcement) => ({ kind: 'announce', announcement }) as const),
          ],
          result: { setId: set.id, prs, hints },
        },
        ctx,
      );
    }

    case 'EDIT_SET': {
      const current = state.sets.find((set) => set.id === event.setId);
      if (!current) return reject(state, { kind: 'unknownSet', key: event.setId });
      const issues = inputIssues(event.values);
      if (issues.length > 0) return reject(state, { kind: 'invalidValues', issues });
      const slot = current.slotKey ? slotOf(session, current.slotKey) : undefined;
      const merged: SetInput = {
        load: event.values.load === undefined ? current.load : event.values.load,
        reps: event.values.reps === undefined ? current.reps : event.values.reps,
        rir: event.values.rir === undefined ? current.effort.rir : event.values.rir,
        openEnded: event.values.openEnded ?? current.effort.openEnded ?? false,
        ...((event.values.repsLeft ?? current.repsLeft) !== undefined
          ? { repsLeft: event.values.repsLeft ?? current.repsLeft }
          : {}),
        ...((event.values.repsRight ?? current.repsRight) !== undefined
          ? { repsRight: event.values.repsRight ?? current.repsRight }
          : {}),
        ...((event.values.durationMs ?? current.durationMs) === undefined
          ? {}
          : { durationMs: event.values.durationMs ?? current.durationMs }),
        technique:
          event.values.technique === undefined
            ? (current.technique ?? null)
            : event.values.technique,
        flags: event.values.flags ?? current.flags ?? {},
        note: event.values.note === undefined ? (current.note ?? null) : event.values.note,
      };
      const fields = setFields(
        event.values.reps === undefined && current.repsLeft !== undefined
          ? { ...merged, reps: null }
          : merged,
        slot?.perSide === true,
      );
      const {
        repsLeft: _l,
        repsRight: _r,
        durationMs: _d,
        technique: _t,
        flags: _f,
        note: _n,
        ...kept
      } = current;
      const edited: LoggedSet = {
        ...kept,
        ...fields,
        type: event.values.type ?? current.type,
        state: 'done',
      };
      const sets = state.sets.map((set) => (set.id === current.id ? edited : set));
      const after: SessionState = { session, sets };
      const prs = newPrs(state, after, ctx);
      return commit(
        state,
        {
          session,
          sets,
          undo: 'record',
          effects: prs.length > 0 ? [{ kind: 'celebrate', prs }] : [],
          result: { setId: edited.id, prs },
        },
        ctx,
      );
    }

    case 'SKIP_SET': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      const planned = plannedSetOf(slot, event.setKey);
      if (!planned) return reject(state, { kind: 'unknownSet', key: event.setKey });
      if (loggedOf(state.sets, slot.key, planned.key))
        return reject(state, { kind: 'alreadyLogged', setKey: planned.key });
      const id = ids.next();
      if (id === null) return reject(state, { kind: 'idsExhausted' });
      const set: LoggedSet = skippedSet(id, session, slot, planned, state.sets, ctx);
      return commit(
        state,
        {
          session,
          sets: [...state.sets, set],
          undo: 'record',
          effects: [
            { kind: 'cue', cue: 'setSkipped' },
            {
              kind: 'announce',
              announcement: { kind: 'setSkipped', slotKey: slot.key, setKey: planned.key },
            },
          ],
          result: { setId: set.id },
        },
        ctx,
      );
    }

    case 'DELETE_SET': {
      if (!state.sets.some((set) => set.id === event.setId))
        return reject(state, { kind: 'unknownSet', key: event.setId });
      return commit(
        state,
        { session, sets: state.sets.filter((set) => set.id !== event.setId), undo: 'record' },
        ctx,
      );
    }

    case 'ADD_SET': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      const warmup = event.setType === 'warmup';
      const template = warmup
        ? slot.sets.filter((set) => !isWorking(set)).at(-1)
        : slot.sets.filter(isWorking).at(-1);
      const key = freshKey(
        slot.sets.map((set) => set.key),
        warmup ? 'w' : 'x',
      );
      const type =
        event.setType ?? (template?.type === 'top' ? 'backoff' : (template?.type ?? 'working'));
      const added: PlannedSet = {
        key,
        type,
        reps: template?.reps ?? null,
        rir: warmup ? null : (template?.rir ?? null),
        load: warmup || slot.prescription?.mode === 'fixed' ? (template?.load ?? null) : null,
        ...(template?.durationS === undefined ? {} : { durationS: template.durationS }),
        ...(template?.technique && !warmup ? { technique: template.technique } : {}),
        ...(template?.restSeconds === undefined || !warmup
          ? {}
          : { restSeconds: template.restSeconds }),
      };
      const sets = warmup
        ? [...slot.sets.filter((set) => !isWorking(set)), added, ...slot.sets.filter(isWorking)]
        : [...slot.sets, added];
      return commit(
        state,
        {
          session: updateSlot(session, slot.key, (current) => ({
            ...current,
            sets,
            skipped: false,
          })),
          sets: state.sets,
          undo: 'record',
        },
        ctx,
      );
    }

    case 'REMOVE_SET': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      if (!plannedSetOf(slot, event.setKey))
        return reject(state, { kind: 'unknownSet', key: event.setKey });
      if (loggedOf(state.sets, slot.key, event.setKey))
        return reject(state, { kind: 'notPending', setKey: event.setKey });
      return commit(
        state,
        {
          session: updateSlot(session, slot.key, (current) => ({
            ...current,
            sets: current.sets.filter((set) => set.key !== event.setKey),
          })),
          sets: state.sets,
          undo: 'record',
        },
        ctx,
      );
    }

    case 'SKIP_EXERCISE': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      const skipped: LoggedSet[] = [];
      let sets = state.sets;
      for (const planned of slot.sets.filter(isWorking)) {
        if (!isPending(state, slot, planned.key)) continue;
        const id = ids.next();
        if (id === null) return reject(state, { kind: 'idsExhausted' });
        const set = skippedSet(id, session, slot, planned, sets, ctx);
        skipped.push(set);
        sets = [...sets, set];
      }
      const timer = session.timer?.slotKey === slot.key ? null : session.timer;
      return commit(
        state,
        {
          session: {
            ...updateSlot(session, slot.key, (current) => ({ ...current, skipped: true })),
            timer,
          },
          sets,
          undo: 'record',
          effects: [{ kind: 'cue', cue: 'setSkipped' }],
        },
        ctx,
      );
    }

    case 'ADD_EXERCISE': {
      const exercise = ctx.exercise(event.exerciseId);
      if (!exercise)
        return reject(state, { kind: 'unknownExercise', exerciseId: event.exerciseId });
      const sets = event.sets ?? undefined;
      if (sets !== undefined && (!Number.isInteger(sets) || sets < 1 || sets > 20))
        return reject(state, { kind: 'invalidValues', issues: ['sets.outOfRange'] });
      const key = freshKey(
        session.exercises.map((slot) => slot.key),
        'x',
      );
      const added = addedExercise(exercise, key, ctx.rules(exercise.id), ctx.level, sets);
      const position = Math.max(
        0,
        Math.min(event.position ?? session.exercises.length, session.exercises.length),
      );
      const exercises = [...session.exercises];
      exercises.splice(position, 0, added);
      let next: Session = { ...session, exercises };
      const warmups = warmupsFor({ session: next, sets: state.sets }, key, ctx);
      if (warmups)
        next = updateSlot(next, key, (slot) => ({ ...slot, sets: [...warmups, ...slot.sets] }));
      return commit(state, { session: next, sets: state.sets, undo: 'record' }, ctx);
    }

    case 'REMOVE_EXERCISE': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      if (state.sets.some((set) => set.slotKey === slot.key))
        return reject(state, { kind: 'hasLoggedSets', slotKey: slot.key });
      const groups = session.groups
        .map((group) => ({ ...group, slotKeys: group.slotKeys.filter((key) => key !== slot.key) }))
        .filter((group) => group.slotKeys.length >= 2);
      return commit(
        state,
        {
          session: {
            ...session,
            exercises: session.exercises.filter((other) => other.key !== slot.key),
            groups,
            timer: session.timer?.slotKey === slot.key ? null : session.timer,
          },
          sets: state.sets,
          undo: 'record',
        },
        ctx,
      );
    }

    case 'REORDER': {
      const keys = session.exercises.map((slot) => slot.key);
      if (
        event.order.length !== keys.length ||
        new Set(event.order).size !== keys.length ||
        !event.order.every((key) => keys.includes(key))
      ) {
        return reject(state, { kind: 'invalidOrder' });
      }
      const exercises = event.order.map((key) => slotOf(session, key)!);
      return commit(
        state,
        { session: { ...session, exercises }, sets: state.sets, undo: 'record' },
        ctx,
      );
    }

    case 'SUBSTITUTE': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      const exercise = ctx.exercise(event.exerciseId);
      if (!exercise)
        return reject(state, { kind: 'unknownExercise', exerciseId: event.exerciseId });
      const loggedWarmups = slot.sets.some(
        (set) => !isWorking(set) && loggedOf(state.sets, slot.key, set.key),
      );
      const kept = slot.sets.filter(
        (set) => isWorking(set) || loggedWarmups || !isPending(state, slot, set.key),
      );
      let next = updateSlot(session, slot.key, (current) => ({
        ...current,
        exerciseId: exercise.id,
        substitutedFrom: {
          exerciseId: current.substitutedFrom?.exerciseId ?? current.exerciseId,
          scope: event.scope,
        },
        sets: kept.map((set) =>
          isWorking(set) &&
          isPending(state, slot, set.key) &&
          current.prescription?.mode !== 'fixed'
            ? { ...set, load: null }
            : set,
        ),
        skipped: false,
      }));
      if (!loggedWarmups) {
        const warmups = warmupsFor({ session: next, sets: state.sets }, slot.key, ctx);
        if (warmups)
          next = updateSlot(next, slot.key, (current) => ({
            ...current,
            sets: [...warmups, ...current.sets],
          }));
      }
      const plan: SessionEffect[] =
        event.scope === 'mesocycle' && session.plannedSessionId && slot.planSlotKey
          ? [
              {
                kind: 'plan.substitute',
                plannedSessionId: session.plannedSessionId,
                planSlotKey: slot.planSlotKey,
                exerciseId: exercise.id,
              },
            ]
          : [];
      return commit(
        state,
        {
          session: next,
          sets: state.sets,
          undo: event.scope === 'mesocycle' ? 'clear' : 'record',
          effects: plan,
        },
        ctx,
      );
    }

    case 'CHANGE_PRESCRIPTION': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      if (event.setKey !== undefined) {
        if (!plannedSetOf(slot, event.setKey))
          return reject(state, { kind: 'unknownSet', key: event.setKey });
        if (!isPending(state, slot, event.setKey))
          return reject(state, { kind: 'notPending', setKey: event.setKey });
      }
      const { change } = event;
      const issues = [
        ...inputIssues({ load: change.load ?? null }),
        ...(change.reps &&
        !(
          Number.isInteger(change.reps[0]) &&
          change.reps[0] >= 0 &&
          change.reps[0] <= change.reps[1] &&
          change.reps[1] <= SET_LIMITS.repsMax
        )
          ? ['reps.outOfRange']
          : []),
        ...(change.rir &&
        !(change.rir[0] >= 0 && change.rir[0] <= change.rir[1] && change.rir[1] <= 10)
          ? ['rir.outOfRange']
          : []),
        ...(change.sets !== undefined &&
        !(Number.isInteger(change.sets) && change.sets >= 1 && change.sets <= 20)
          ? ['sets.outOfRange']
          : []),
        ...(change.restSeconds != null &&
        !(
          Number.isInteger(change.restSeconds) &&
          change.restSeconds >= 0 &&
          change.restSeconds <= 1800
        )
          ? ['restSeconds.outOfRange']
          : []),
        ...(change.durationS !== undefined &&
        !(Number.isInteger(change.durationS) && change.durationS >= 1 && change.durationS <= 3600)
          ? ['durationS.outOfRange']
          : []),
      ];
      if (issues.length > 0) return reject(state, { kind: 'invalidValues', issues });
      const targets = (set: PlannedSet) =>
        (event.setKey === undefined ? isWorking(set) : set.key === event.setKey) &&
        isPending(state, slot, set.key);
      let sets: PlannedSet[] = slot.sets.map((set) => {
        if (!targets(set)) return set;
        const { technique, ...rest } = set;
        const nextTechnique = change.technique === undefined ? technique : change.technique;
        return {
          ...rest,
          ...(change.reps ? { reps: change.reps } : {}),
          ...(change.rir !== undefined ? { rir: change.rir } : {}),
          ...(change.load !== undefined ? { load: change.load } : {}),
          ...(change.durationS !== undefined ? { durationS: change.durationS } : {}),
          ...(nextTechnique ? { technique: nextTechnique } : {}),
        };
      });
      if (change.sets !== undefined) {
        const working = sets.filter(isWorking);
        if (change.sets > working.length) {
          const template = working.at(-1);
          const used = sets.map((set) => set.key);
          for (let count = working.length; count < change.sets; count++) {
            const key = freshKey(used, 'x');
            used.push(key);
            sets = [
              ...sets,
              template
                ? { ...template, key, type: template.type === 'top' ? 'backoff' : template.type }
                : { key, type: 'working', reps: null, rir: null, load: null },
            ];
          }
        } else {
          let excess = working.length - change.sets;
          for (let index = sets.length - 1; index >= 0 && excess > 0; index--) {
            const set = sets[index]!;
            if (isWorking(set) && isPending(state, slot, set.key)) {
              sets = sets.filter((_, at) => at !== index);
              excess--;
            }
          }
        }
      }
      return commit(
        state,
        {
          session: updateSlot(session, slot.key, (current) => ({
            ...current,
            sets,
            ...(change.restSeconds !== undefined ? { restSeconds: change.restSeconds } : {}),
            ...(change.progression === 'manual'
              ? { progression: 'manual' }
              : change.progression === 'engine' && current.progression === 'manual'
                ? { progression: engineModel(current) }
                : {}),
          })),
          sets: state.sets,
          undo: 'record',
        },
        ctx,
      );
    }

    case 'SET_NOTE': {
      if ((event.note?.length ?? 0) > NOTE_MAX)
        return reject(state, { kind: 'invalidValues', issues: ['note.tooLong'] });
      const { target } = event;
      if (target.kind === 'session') {
        return commit(
          state,
          { session: withNote(session, event.note), sets: state.sets, undo: 'keep' },
          ctx,
        );
      }
      if (target.kind === 'exercise') {
        if (!slotOf(session, target.slotKey))
          return reject(state, { kind: 'unknownSlot', slotKey: target.slotKey });
        return commit(
          state,
          {
            session: updateSlot(session, target.slotKey, (slot) => withNote(slot, event.note)),
            sets: state.sets,
            undo: 'keep',
          },
          ctx,
        );
      }
      if (!state.sets.some((set) => set.id === target.setId))
        return reject(state, { kind: 'unknownSet', key: target.setId });
      return commit(
        state,
        {
          session,
          sets: state.sets.map((set) =>
            set.id === target.setId ? withNote(set, event.note) : set,
          ),
          undo: 'keep',
        },
        ctx,
      );
    }

    case 'GROUP': {
      const keys = [...new Set(event.slotKeys)];
      if (keys.length < 2) return reject(state, { kind: 'invalidOrder' });
      for (const key of keys) {
        if (!slotOf(session, key)) return reject(state, { kind: 'unknownSlot', slotKey: key });
        if (groupOf(session, key)) return reject(state, { kind: 'alreadyGrouped', slotKey: key });
      }
      const ordered = session.exercises.map((slot) => slot.key).filter((key) => keys.includes(key));
      const group = {
        key: freshKey(
          session.groups.map((other) => other.key),
          'g',
        ),
        kind: event.kind,
        slotKeys: ordered,
      };
      return commit(
        state,
        {
          session: { ...session, groups: [...session.groups, group] },
          sets: state.sets,
          undo: 'record',
        },
        ctx,
      );
    }

    case 'UNGROUP': {
      if (!session.groups.some((group) => group.key === event.groupKey))
        return reject(state, { kind: 'unknownGroup', groupKey: event.groupKey });
      return commit(
        state,
        {
          session: {
            ...session,
            groups: session.groups.filter((group) => group.key !== event.groupKey),
          },
          sets: state.sets,
          undo: 'record',
        },
        ctx,
      );
    }

    case 'GENERATE_WARMUPS': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      const logged = slot.sets.find(
        (set) => !isWorking(set) && loggedOf(state.sets, slot.key, set.key),
      );
      if (logged) return reject(state, { kind: 'alreadyLogged', setKey: logged.key });
      const warmups = warmupsFor(state, slot.key, ctx, event.includeOptional ?? false);
      if (!warmups) return reject(state, { kind: 'noWorkingLoad', slotKey: slot.key });
      return commit(
        state,
        {
          session: updateSlot(session, slot.key, (current) => ({
            ...current,
            sets: [...warmups, ...current.sets.filter(isWorking)],
          })),
          sets: state.sets,
          undo: 'record',
        },
        ctx,
      );
    }

    case 'SET_PER_SIDE': {
      if (!slotOf(session, event.slotKey))
        return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      return commit(
        state,
        {
          session: updateSlot(session, event.slotKey, (slot) => ({
            ...slot,
            perSide: event.perSide,
          })),
          sets: state.sets,
          undo: 'keep',
        },
        ctx,
      );
    }

    case 'MOVE_CURSOR': {
      const slot = slotOf(session, event.slotKey);
      if (!slot) return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      if (!plannedSetOf(slot, event.setKey))
        return reject(state, { kind: 'unknownSet', key: event.setKey });
      if (!isPending(state, slot, event.setKey))
        return reject(state, { kind: 'notPending', setKey: event.setKey });
      return commit(
        state,
        {
          session: { ...session, cursor: { slotKey: slot.key, setKey: event.setKey } },
          sets: state.sets,
          undo: 'keep',
        },
        ctx,
      );
    }

    case 'SET_REST': {
      if (!slotOf(session, event.slotKey))
        return reject(state, { kind: 'unknownSlot', slotKey: event.slotKey });
      if (
        event.seconds !== null &&
        !(Number.isInteger(event.seconds) && event.seconds >= 0 && event.seconds <= 1800)
      )
        return reject(state, { kind: 'invalidValues', issues: ['restSeconds.outOfRange'] });
      return commit(
        state,
        {
          session: updateSlot(session, event.slotKey, (slot) => ({
            ...slot,
            restSeconds: event.seconds,
          })),
          sets: state.sets,
          undo: 'keep',
        },
        ctx,
      );
    }

    case 'READINESS': {
      if (event.items === null) {
        return commit(
          state,
          {
            session: { ...session, readiness: { status: 'skipped' } },
            sets: state.sets,
            undo: 'keep',
          },
          ctx,
        );
      }
      const issues = readinessIssues(event.items);
      const sore = event.soreMuscles ?? [];
      if (
        sore.length > 40 ||
        sore.some(
          (entry) => !(Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5),
        )
      )
        issues.push('soreMuscles.outOfRange');
      if (issues.length > 0) return reject(state, { kind: 'invalidValues', issues });
      const id = ids.next();
      if (id === null) return reject(state, { kind: 'idsExhausted' });
      const entry: ReadinessEntry = {
        id,
        localDate: toLocalDate(ctx.now),
        recordedAt: ctx.now,
        sessionId: session.id,
        items: event.items,
        ...(sore.length > 0 ? { soreMuscles: sore } : {}),
      };
      const assessment = assessReadiness(entry, ctx.readiness, ctx.rules(null));
      const proposals: SessionProposal[] = [
        ...readinessProposals(assessment.value, state, ctx),
        ...returnProposals(state, ctx, { plannedAdjusted: plannedAdjusted(session) }),
      ];
      return commit(
        state,
        {
          session: {
            ...session,
            readiness: {
              status: 'done',
              entryId: id,
              flag: assessment.value.flag,
              composite: assessment.value.composite,
            },
          },
          sets: state.sets,
          undo: 'keep',
          readiness: entry,
          result: { readiness: { entryId: id, assessment, proposals } },
        },
        ctx,
      );
    }

    case 'APPLY_CHANGES': {
      if (
        event.changes.length === 0 ||
        !event.changes.every((change) => validChange(session, change))
      )
        return reject(state, { kind: 'invalidValues', issues: ['changes.invalid'] });
      let next = session;
      for (const change of event.changes) next = applyChange(state, next, change, ctx);
      return commit(state, { session: next, sets: state.sets, undo: 'record' }, ctx);
    }

    case 'TIMER_START': {
      const id = ids.next();
      if (id === null) return reject(state, { kind: 'idsExhausted' });
      const cursorSlot = event.slotKey ?? session.cursor?.slotKey;
      const slot = cursorSlot ? slotOf(session, cursorSlot) : undefined;
      const planned =
        slot && session.cursor && session.cursor.slotKey === slot.key
          ? plannedSetOf(slot, session.cursor.setKey)
          : undefined;
      const targetMs =
        event.targetMs ??
        (event.kind === 'set'
          ? (planned?.durationS ?? 0) * 1000
          : (slot
              ? restSecondsFor(slot, ctx)
              : ctx.rules(null)['session.rest.hypertrophyCompound'].value) * 1000);
      if (!(Number.isFinite(targetMs) && targetMs >= 0 && targetMs <= 3_600_000))
        return reject(state, { kind: 'invalidValues', issues: ['targetMs.outOfRange'] });
      const mode =
        event.mode ??
        (event.kind === 'set'
          ? targetMs > 0
            ? 'countdown'
            : 'countup'
          : ctx.preferences.restMode);
      const timer = newTimer({
        id,
        kind: event.kind,
        mode,
        nowEpochMs: nowMs,
        targetMs,
        ...(slot ? { slotKey: slot.key } : {}),
      });
      return commit(state, { session: { ...session, timer }, sets: state.sets, undo: 'keep' }, ctx);
    }

    case 'TIMER_STOP': {
      if (!session.timer) return reject(state, { kind: 'noTimer' });
      const elapsedMs = timerView(session.timer, nowMs).elapsedMs;
      return commit(
        state,
        {
          session: { ...session, timer: null },
          sets: state.sets,
          undo: 'keep',
          result: { elapsedMs },
        },
        ctx,
      );
    }

    case 'TIMER_ADJUST': {
      if (!session.timer) return reject(state, { kind: 'noTimer' });
      if (!Number.isFinite(event.deltaMs) || Math.abs(event.deltaMs) > 3_600_000)
        return reject(state, { kind: 'invalidValues', issues: ['deltaMs.outOfRange'] });
      return commit(
        state,
        {
          session: { ...session, timer: adjustTimer(session.timer, event.deltaMs, nowMs) },
          sets: state.sets,
          undo: 'keep',
        },
        ctx,
      );
    }

    case 'TIMER_SKIP': {
      if (!session.timer) return reject(state, { kind: 'noTimer' });
      return commit(
        state,
        { session: { ...session, timer: null }, sets: state.sets, undo: 'keep' },
        ctx,
      );
    }

    case 'TIMER_RESTART': {
      if (!session.timer) return reject(state, { kind: 'noTimer' });
      return commit(
        state,
        {
          session: { ...session, timer: restartTimer(session.timer, nowMs) },
          sets: state.sets,
          undo: 'keep',
        },
        ctx,
      );
    }

    case 'TIMER_FIRED': {
      const timer = session.timer;
      if (!timer || timer.id !== event.timerId) return unchanged(state, []);
      const fired = { ...timer.fired, [event.which]: true };
      return commit(
        state,
        { session: { ...session, timer: { ...timer, fired } }, sets: state.sets, undo: 'keep' },
        ctx,
      );
    }

    case 'UNDO': {
      const undo = session.undo;
      if (!undo || undo.token !== event.token || nowMs > undo.expiresAtEpochMs)
        return reject(state, { kind: 'undoExpired' });
      const removed = new Set<SetId>(undo.removeSetIds);
      const restored = new Map(undo.restoreSets.map((set) => [set.id, set]));
      const sets = [
        ...state.sets.filter((set) => !removed.has(set.id) && !restored.has(set.id)),
        ...undo.restoreSets,
      ];
      return commit(
        state,
        {
          session: { ...undo.session, undo: null },
          sets,
          undo: 'clear',
          effects: [
            { kind: 'cue', cue: 'undone' },
            { kind: 'announce', announcement: { kind: 'undone' } },
          ],
        },
        ctx,
      );
    }

    case 'FINISH': {
      const last = lastDone(state.sets);
      const endedAt =
        event.endAt === 'lastSet' ? (last?.performedAt ?? session.startedAt) : ctx.now;
      const exerciseIds = [
        ...new Set(state.sets.filter((set) => set.state === 'done').map((set) => set.exerciseId)),
      ];
      return commit(
        state,
        {
          session: { ...session, status: event.as, endedAt, cursor: null, timer: null },
          sets: state.sets,
          undo: 'clear',
          effects: [
            { kind: 'wakeLock', action: 'release' },
            { kind: 'activeSession', sessionId: null },
            ...(session.plannedSessionId
              ? [{ kind: 'plan.complete', plannedSessionId: session.plannedSessionId } as const]
              : []),
            ...(exerciseIds.length > 0
              ? [{ kind: 'recompute', exerciseIds, fromDate: session.localDate } as const]
              : []),
            { kind: 'announce', announcement: { kind: 'sessionDone' } },
          ],
        },
        ctx,
      );
    }

    case 'DISCARD':
      return commit(
        state,
        {
          session: { ...session, status: 'discarded', endedAt: ctx.now, cursor: null, timer: null },
          sets: state.sets,
          undo: 'clear',
          effects: [
            { kind: 'wakeLock', action: 'release' },
            { kind: 'activeSession', sessionId: null },
          ],
        },
        ctx,
      );

    case 'RESUME': {
      if (session.status !== 'active') return unchanged(state, []);
      const last = lastDone(state.sets);
      const activity = Math.max(session.startedAt.epochMs, last?.performedAt.epochMs ?? 0);
      const next = session.cursor
        ? suggestSet(state, session.cursor.slotKey, session.cursor.setKey, ctx)
        : null;
      return unchanged(
        state,
        [
          ...(session.timer ? [{ kind: 'timer.arm', timer: session.timer } as const] : []),
          { kind: 'wakeLock', action: 'acquire' },
          { kind: 'activeSession', sessionId: session.id },
        ],
        {
          next,
          stale: nowMs - activity > STALE_SESSION_MS,
          undoToken:
            session.undo && nowMs <= session.undo.expiresAtEpochMs ? session.undo.token : null,
        },
      );
    }
    default:
      return unknownEvent(state, event);
  }
}

function unknownEvent(state: SessionState, _event: never): Transition {
  return reject(state, { kind: 'invalidValues', issues: ['event.unknown'] });
}

function skippedSet(
  id: string,
  session: Session,
  slot: SessionExercise,
  planned: PlannedSet,
  sets: readonly LoggedSet[],
  ctx: SessionContext,
): LoggedSet {
  return {
    id: id as SetId,
    sessionId: session.id,
    exerciseId: slot.exerciseId,
    index: nextSetIndex(sets, slot.exerciseId),
    type: planned.type,
    load: null,
    reps: null,
    effort: { rir: null, source: 'none' },
    state: 'skipped',
    performedAt: ctx.now,
    localDate: session.localDate,
    slotKey: slot.key,
    setKey: planned.key,
  };
}

function plannedAdjusted(session: Session): boolean {
  return (session.plannedAdjustments ?? []).some(
    (kind) => kind === 'deload' || kind === 'returnFromBreak' || kind === 'recalibrate',
  );
}

// --- Start -----------------------------------------------------------------------------------

export interface StartInput {
  readonly sessionId: SessionId;
  readonly versions: VersionStamp;
  readonly equipmentProfileId: string | null;
  readonly source:
    | { readonly kind: 'planned'; readonly planned: PlannedSession }
    | { readonly kind: 'freestyle'; readonly exerciseIds: readonly ExerciseId[] }
    | {
        readonly kind: 'repeat';
        readonly session: Session;
        readonly sets: readonly LoggedSet[];
      };
  /** WKT-06: generate the warm-up ramps now (default true). */
  readonly warmups?: boolean;
}

/**
 * WKT-01: a new active session from a planned session, a past session (repeat) or freestyle
 * exercises, with warm-up ramps where a working load is known, the cursor on the first set and
 * the return-from-break proposals (PRG-13) for lifts last trained more than a week ago.
 */
export function startSession(input: StartInput, ctx: SessionContext): Transition {
  const { source } = input;
  let exercises: SessionExercise[];
  let adjustments: AdjustmentKind[] = [];
  if (source.kind === 'planned') {
    exercises = exercisesFromPlannedSession(source.planned);
    adjustments = [...new Set(source.planned.adjustments.map((adjustment) => adjustment.kind))];
  } else if (source.kind === 'repeat') {
    exercises = repeatedExercises(source.session, source.sets).map((exercise) => {
      const { loadPct: _p, note: _n, substitutedFrom: _s, ...rest } = exercise;
      return rest;
    });
  } else {
    exercises = [];
    for (const exerciseId of source.exerciseIds) {
      const exercise = ctx.exercise(exerciseId);
      if (!exercise) continue;
      const key = freshKey(
        exercises.map((slot) => slot.key),
        'x',
      );
      exercises.push(addedExercise(exercise, key, ctx.rules(exercise.id), ctx.level));
    }
  }
  let session: Session = {
    id: input.sessionId,
    localDate: toLocalDate(ctx.now),
    startedAt: ctx.now,
    status: 'active',
    versions: input.versions,
    origin: source.kind,
    ...(source.kind === 'planned' ? { plannedSessionId: source.planned.id } : {}),
    ...(adjustments.length > 0 ? { plannedAdjustments: adjustments } : {}),
    ...(source.kind === 'repeat' ? { repeatOf: source.session.id } : {}),
    equipmentProfileId: input.equipmentProfileId,
    exercises,
    groups:
      source.kind === 'repeat'
        ? source.session.groups.filter((group) =>
            group.slotKeys.every((key) => exercises.some((slot) => slot.key === key)),
          )
        : [],
    cursor: null,
    timer: null,
    readiness: null,
    changes: [],
    revision: 0,
    undo: null,
  };
  if (input.warmups !== false) {
    for (const slot of session.exercises) {
      const warmups = warmupsFor({ session, sets: [] }, slot.key, ctx);
      if (warmups)
        session = updateSlot(session, slot.key, (current) => ({
          ...current,
          sets: [...warmups, ...current.sets],
        }));
    }
  }
  const draft: SessionState = { session, sets: [] };
  session = { ...session, cursor: firstPending(draft) };
  const state: SessionState = { session, sets: [] };
  const proposals = returnProposals(state, ctx, { plannedAdjusted: plannedAdjusted(session) });
  return {
    state,
    effects: [
      { kind: 'persist', session, putSets: [], deleteSetIds: [] },
      { kind: 'wakeLock', action: 'acquire' },
      { kind: 'activeSession', sessionId: session.id },
    ],
    result: {
      ...EMPTY_RESULT,
      next: session.cursor
        ? suggestSet(state, session.cursor.slotKey, session.cursor.setKey, ctx)
        : null,
      readiness: { entryId: null, assessment: null, proposals },
    },
  };
}
