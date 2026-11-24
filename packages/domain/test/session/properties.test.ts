/**
 * Property tests of the session reducer (technical concept §8.5): random event sequences replayed
 * through `reduceSession`, with the clock moving forward and sometimes backwards (NFR-REL-05).
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { ExerciseId, LoggedSet } from '../../src';
import { TECHNIQUE_CREDIT_PARAM, TECHNIQUE_KINDS, type TechniqueKind } from '../../src/rules';
import {
  cursorOrder,
  emptyExerciseState,
  rebuildExerciseState,
  reduceSession,
  sessionMuscleVolume,
  sessionPrs,
  timerView,
  type SessionEvent,
  type SessionState,
  type Transition,
} from '../../src/session';
import { rules } from '../fixtures/rules';
import {
  T0,
  context,
  kg,
  libraryLookup,
  pastSet,
  plannedSession,
  slot,
  start,
  type ContextOptions,
} from '../fixtures/session';

const RUNS = Number(
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[
    'POWR_PROPERTY_RUNS'
  ] ?? 150,
);

const bench = 'ex.bench-press';
const RULES = rules();
const HISTORY = {
  [bench]: rebuildExerciseState(
    emptyExerciseState(bench as ExerciseId, 'k'),
    [
      {
        sessionId: 'p1' as never,
        localDate: '2026-11-20' as never,
        sets: [0, 1].map((index) =>
          pastSet('p1', bench, index, { load: 80, reps: 6, rir: 2 }, '2026-11-20'),
        ),
      },
    ],
    {
      exercise: libraryLookup(bench as ExerciseId)!,
      rules: RULES,
      level: 'intermediate',
      bodyweightAt: () => 80,
    },
  ).state,
};

const PLANNED = plannedSession([
  slot('b', bench, {
    prescription: {
      mode: 'topBackoff',
      top: { repRange: [5, 5], rir: [1, 2] },
      backoff: { sets: 2, repRange: [6, 8], rir: [2, 3] },
    },
    progression: 'rpe',
    restSeconds: 180,
  }),
  slot('r', 'ex.row', { restSeconds: 90 }),
  slot('c', 'ex.curl', { restSeconds: 60 }),
]);

interface Action {
  readonly kind:
    | 'confirm'
    | 'skip'
    | 'delete'
    | 'undo'
    | 'edit'
    | 'addSet'
    | 'removeSet'
    | 'skipExercise'
    | 'addExercise'
    | 'reorder'
    | 'group'
    | 'ungroup'
    | 'substitute'
    | 'note'
    | 'moveCursor'
    | 'change'
    | 'timerStart'
    | 'timerAdjust'
    | 'timerSkip'
    | 'timerRestart'
    | 'timerFired'
    | 'resume';
  readonly pick: number;
  readonly load: number;
  readonly reps: number;
  readonly rir: number | null;
  readonly technique: { readonly kind: TechniqueKind; readonly units: number } | null;
  readonly stepMs: number;
}

const action: fc.Arbitrary<Action> = fc.record({
  kind: fc.constantFrom<Action['kind']>(
    'confirm',
    'confirm',
    'confirm',
    'confirm',
    'skip',
    'delete',
    'undo',
    'undo',
    'edit',
    'addSet',
    'removeSet',
    'skipExercise',
    'addExercise',
    'reorder',
    'group',
    'ungroup',
    'substitute',
    'note',
    'moveCursor',
    'change',
    'timerStart',
    'timerAdjust',
    'timerSkip',
    'timerRestart',
    'timerFired',
    'resume',
  ),
  pick: fc.nat({ max: 50 }),
  load: fc.integer({ min: 0, max: 80 }).map((n) => n * 2.5),
  reps: fc.integer({ min: 1, max: 20 }),
  rir: fc.option(
    fc.integer({ min: 0, max: 10 }).map((n) => n / 2),
    { nil: null },
  ),
  technique: fc.option(
    fc.record({ kind: fc.constantFrom(...TECHNIQUE_KINDS), units: fc.integer({ min: 0, max: 5 }) }),
    { nil: null },
  ),
  // Mostly forward, sometimes a clock set backwards (NFR-REL-05).
  stepMs: fc.oneof(
    { weight: 8, arbitrary: fc.integer({ min: 0, max: 600_000 }) },
    { weight: 1, arbitrary: fc.integer({ min: -300_000, max: 0 }) },
    { weight: 1, arbitrary: fc.integer({ min: 600_000, max: 30_000_000 }) },
  ),
});

const at = <T>(items: readonly T[], pick: number): T | undefined =>
  items.length === 0 ? undefined : items[pick % items.length];

function pendingSets(state: SessionState) {
  return cursorOrder(state.session).filter(
    (cursor) =>
      !state.sets.some((set) => set.slotKey === cursor.slotKey && set.setKey === cursor.setKey) &&
      !state.session.exercises.find((entry) => entry.key === cursor.slotKey)?.skipped,
  );
}

/** Maps an abstract action onto a concrete event for the current state. */
function eventFor(state: SessionState, a: Action, lastUndo: string | null): SessionEvent | null {
  const { session } = state;
  const slots = session.exercises;
  const values = {
    load: kg(a.load),
    reps: a.reps,
    rir: a.rir,
    ...(a.technique ? { technique: { kind: a.technique.kind, units: a.technique.units } } : {}),
  };
  switch (a.kind) {
    case 'confirm': {
      const target = session.cursor ?? at(pendingSets(state), a.pick);
      return target
        ? {
            type: 'CONFIRM_SET',
            slotKey: target.slotKey,
            setKey: target.setKey,
            values,
            confirmImplausible: true,
          }
        : null;
    }
    case 'skip': {
      const target = at(pendingSets(state), a.pick);
      return target ? { type: 'SKIP_SET', ...target } : null;
    }
    case 'moveCursor': {
      const target = at(pendingSets(state), a.pick);
      return target ? { type: 'MOVE_CURSOR', ...target } : null;
    }
    case 'delete': {
      const set = at(state.sets, a.pick);
      return set ? { type: 'DELETE_SET', setId: set.id } : null;
    }
    case 'edit': {
      const set = at(state.sets, a.pick);
      return set ? { type: 'EDIT_SET', setId: set.id, values: { reps: a.reps, rir: a.rir } } : null;
    }
    case 'undo':
      return lastUndo ? { type: 'UNDO', token: lastUndo } : null;
    case 'addSet': {
      const target = at(slots, a.pick);
      return target ? { type: 'ADD_SET', slotKey: target.key } : null;
    }
    case 'removeSet': {
      const target = at(pendingSets(state), a.pick);
      return target ? { type: 'REMOVE_SET', ...target } : null;
    }
    case 'skipExercise': {
      const target = at(slots, a.pick);
      return target ? { type: 'SKIP_EXERCISE', slotKey: target.key } : null;
    }
    case 'addExercise':
      return {
        type: 'ADD_EXERCISE',
        exerciseId: at(
          ['ex.leg-extension', 'ex.curl', 'ex.push-up', 'ex.plank'],
          a.pick,
        ) as ExerciseId,
      };
    case 'reorder':
      return { type: 'REORDER', order: slots.map((s) => s.key).toReversed() };
    case 'group': {
      const free = slots.filter(
        (s) => !session.groups.some((group) => group.slotKeys.includes(s.key)),
      );
      return free.length >= 2
        ? { type: 'GROUP', kind: 'superset', slotKeys: [free[0]!.key, free[1]!.key] }
        : null;
    }
    case 'ungroup': {
      const group = at(session.groups, a.pick);
      return group ? { type: 'UNGROUP', groupKey: group.key } : null;
    }
    case 'substitute': {
      const target = at(slots, a.pick);
      return target
        ? {
            type: 'SUBSTITUTE',
            slotKey: target.key,
            exerciseId: 'ex.leg-extension' as ExerciseId,
            scope: 'session',
          }
        : null;
    }
    case 'note':
      return { type: 'SET_NOTE', target: { kind: 'session' }, note: `note ${a.pick}` };
    case 'change': {
      const target = at(slots, a.pick);
      return target
        ? {
            type: 'CHANGE_PRESCRIPTION',
            slotKey: target.key,
            change: { sets: 1 + (a.reps % 4), rir: [1, 2] },
          }
        : null;
    }
    case 'timerStart':
      return {
        type: 'TIMER_START',
        kind: a.pick % 2 === 0 ? 'rest' : 'set',
        targetMs: a.reps * 10_000,
      };
    case 'timerAdjust':
      return {
        type: 'TIMER_ADJUST',
        deltaMs: (a.pick % 2 === 0 ? 1 : -1) * 15_000 * (1 + (a.reps % 20)),
      };
    case 'timerSkip':
      return { type: 'TIMER_SKIP' };
    case 'timerRestart':
      return { type: 'TIMER_RESTART' };
    case 'timerFired':
      return session.timer
        ? {
            type: 'TIMER_FIRED',
            timerId: session.timer.id,
            which: a.pick % 2 === 0 ? 'end' : 'preAlert',
          }
        : null;
    default:
      return { type: 'RESUME' };
  }
}

interface Step {
  readonly event: SessionEvent;
  readonly before: SessionState;
  readonly transition: Transition;
  readonly options: ContextOptions;
}

const ctxOptions = (nowMs: number, index: number): ContextOptions => ({
  nowMs,
  history: HISTORY,
  idPrefix: `e${index}`,
});

function replay(actions: readonly Action[]): Step[] {
  let nowMs = T0;
  let state = start({ kind: 'planned', planned: PLANNED }, context(ctxOptions(nowMs, -1))).state;
  let lastUndo: string | null = null;
  const steps: Step[] = [];
  for (const [index, a] of actions.entries()) {
    const event = eventFor(state, a, lastUndo);
    nowMs = Math.max(0, nowMs + a.stepMs);
    if (!event) continue;
    const options = ctxOptions(nowMs, index);
    const transition = reduceSession(state, event, context(options));
    steps.push({ event, before: state, transition, options });
    if (
      transition.result.rejected === null &&
      event.type !== 'RESUME' &&
      event.type !== 'TIMER_FIRED'
    ) {
      lastUndo = transition.result.undoToken ?? (event.type === 'UNDO' ? null : lastUndo);
    }
    state = transition.state;
  }
  return steps;
}

const byId = (sets: readonly LoggedSet[]) => sets.toSorted((a, b) => (a.id < b.id ? -1 : 1));

describe('reduceSession properties', () => {
  it('is deterministic: the same events and contexts give the same transitions', () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (actions) => {
        expect(replay(actions)).toEqual(replay(actions));
      }),
      { numRuns: RUNS },
    );
  });

  it('keeps the cursor on a pending planned set (or null) and persists every accepted change', () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (actions) => {
        for (const { transition, event, before } of replay(actions)) {
          const { state } = transition;
          const cursor = state.session.cursor;
          expect(
            cursor === null ||
              pendingSets(state).some(
                (entry) => entry.slotKey === cursor.slotKey && entry.setKey === cursor.setKey,
              ),
          ).toBe(true);
          const accepted = transition.result.rejected === null;
          const persisted = transition.effects.some((effect) => effect.kind === 'persist');
          // Every accepted change is persisted; RESUME and a stale TIMER_FIRED change nothing.
          const changes = accepted && event.type !== 'RESUME' && transition.state !== before;
          expect(!changes || persisted).toBe(true);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('undo restores the previous state: the session (fresh revision) and every set record', () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 25 }), fc.nat(), (actions, pick) => {
        // RESUME hands back a still-valid token of an earlier event; every other token is new.
        const steps = replay(actions).filter(
          (step) => step.transition.result.undoToken !== null && step.event.type !== 'RESUME',
        );
        const step = at(steps, pick);
        if (!step) return;
        const { before, transition, options } = step;
        const undone = reduceSession(
          transition.state,
          { type: 'UNDO', token: transition.result.undoToken! },
          context({ ...options, nowMs: (options.nowMs ?? T0) + 5_000, idPrefix: 'undo' }),
        );
        expect(undone.result.rejected).toBeNull();
        const { revision: _r1, undo: _u1, ...restored } = undone.state.session;
        const { revision: _r2, undo: _u2, ...previous } = before.session;
        expect(restored).toEqual(previous);
        expect(byId(undone.state.sets)).toEqual(byId(before.sets));
        // The timer comes back with its alerts (TMR-04).
        const lost =
          before.session.timer !== null &&
          before.session.timer.id !== transition.state.session.timer?.id;
        const rearmed = undone.effects.some(
          (effect) => effect.kind === 'timer.arm' && effect.timer === before.session.timer,
        );
        expect(!lost || rearmed).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('never creates an e1RM PR from a set without entered effort (E-1)', () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (actions) => {
        for (const { transition, options } of replay(actions)) {
          const { state } = transition;
          const prs = [
            ...sessionPrs(state, context(options)).prs,
            ...transition.effects.flatMap((effect) =>
              effect.kind === 'celebrate' ? effect.prs : [],
            ),
          ];
          for (const pr of prs.filter((record) => record.type === 'e1rm')) {
            const set = state.sets.find((candidate) => candidate.id === pr.setId);
            expect(set?.effort.source).toBe('entered');
          }
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('never shows a negative timer after a recovery, whatever the clock says', () => {
    fc.assert(
      fc.property(
        fc.array(action, { maxLength: 25 }),
        fc.integer({ min: -86_400_000, max: 86_400_000 * 3 }),
        (actions, offsetMs) => {
          const steps = replay(actions);
          const last = steps.at(-1)?.transition.state;
          if (!last) return;
          const recoveredAt = Math.max(0, T0 + offsetMs);
          const resumed = reduceSession(
            last,
            { type: 'RESUME' },
            context({ nowMs: recoveredAt, history: HISTORY }),
          );
          for (const effect of resumed.effects) {
            if (effect.kind !== 'timer.arm') continue;
            const view = timerView(effect.timer, recoveredAt);
            expect(view.elapsedMs).toBeGreaterThanOrEqual(0);
            expect(view.remainingMs).toBeGreaterThanOrEqual(0);
            expect(view.overMs).toBeGreaterThanOrEqual(0);
            expect(effect.timer.targetMs + effect.timer.adjustMs).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('credits technique sets by the registry table (WKT-04)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom(...TECHNIQUE_KINDS),
            units: fc.integer({ min: 0, max: 6 }),
            rir: fc.option(fc.integer({ min: 0, max: 6 }), { nil: null }),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        (techniques) => {
          const curl = plannedSession([
            slot('c', 'ex.curl', {
              prescription: {
                mode: 'doubleProgression',
                sets: techniques.length,
                repRange: [8, 12],
                rir: [1, 2],
              },
            }),
          ]);
          let state = start({ kind: 'planned', planned: curl }, context(), {
            warmups: false,
          }).state;
          techniques.forEach((technique, index) => {
            state = reduceSession(
              state,
              {
                type: 'CONFIRM_SET',
                slotKey: 'c',
                setKey: `s${index + 1}`,
                values: {
                  load: kg(10),
                  reps: 10,
                  rir: technique.rir,
                  technique: { kind: technique.kind, units: technique.units },
                },
              },
              context({ nowMs: T0 + (index + 1) * 60_000 }),
            ).state;
          });
          const expected = techniques.reduce((sum, technique) => {
            const hard =
              technique.rir === null || technique.rir <= RULES['volume.hardSet.maxRir'].value;
            if (!hard) return sum;
            const { base, perUnit, cap } = RULES[TECHNIQUE_CREDIT_PARAM[technique.kind]].value;
            return sum + Math.min(cap, base + perUnit * technique.units);
          }, 0);
          const volume = sessionMuscleVolume(state, context()).get('mu.biceps' as never);
          expect(volume?.fractional ?? 0).toBeCloseTo(expected, 9);
          expect(volume?.direct ?? 0).toBeCloseTo(expected, 9);
        },
      ),
      { numRuns: RUNS },
    );
  });
});
