import { Temporal } from 'temporal-polyfill';

import type {
  ExerciseDef,
  ExerciseId,
  LocalDate,
  LoggedSet,
  PlannedSession,
  PlannedSessionId,
  PlanSlot,
  ReadinessEntry,
  SessionId,
  SetId,
} from '../../src';
import { makeInstantTz } from '../../src';
import type { Implement } from '../../src/loading';
import type { ParamValues, RuleSet, TraineeLevel } from '../../src/rules';
import {
  DEFAULT_SESSION_PREFERENCES,
  emptyExerciseState,
  reduceSession,
  startSession,
  type ExerciseState,
  type SessionContext,
  type SessionEvent,
  type SessionPreferences,
  type SessionState,
  type StartInput,
  type Transition,
} from '../../src/session';
import { exercise } from './planning';
import { rules as ruleSet } from './rules';

/** A small library for the session tests (bodyweight-loaded and timed work included). */
const SESSION_LIBRARY: readonly ExerciseDef[] = [
  exercise('ex.back-squat', {
    pattern: 'squat',
    lift: 'squat',
    rest: 'strength',
    muscles: [
      ['mu.quads.vasti', 1],
      ['mu.glutes.max', 0.5],
      ['mu.adductors', 0.5],
    ],
  }),
  exercise('ex.bench-press', {
    pattern: 'horizontalPush',
    lift: 'bench',
    rest: 'strength',
    muscles: [
      ['mu.chest', 1],
      ['mu.triceps', 0.5],
      ['mu.front-delts', 0.5],
    ],
  }),
  exercise('ex.row', {
    pattern: 'horizontalPull',
    type: 'machine',
    muscles: [
      ['mu.lats', 0.5],
      ['mu.mid-back', 1],
      ['mu.biceps', 0.5],
    ],
  }),
  exercise('ex.curl', {
    pattern: 'elbowFlexion',
    mechanics: 'isolation',
    type: 'dumbbell',
    muscles: [['mu.biceps', 1]],
  }),
  exercise('ex.leg-extension', {
    pattern: 'kneeExtension',
    mechanics: 'isolation',
    type: 'machine',
    muscles: [['mu.quads', 1]],
  }),
  exercise('ex.push-up', {
    pattern: 'horizontalPush',
    type: 'bodyweightAdded',
    muscles: [
      ['mu.chest', 1],
      ['mu.triceps', 0.5],
    ],
  }),
  exercise('ex.plank', {
    pattern: 'core',
    mechanics: 'isolation',
    type: 'timed',
    muscles: [['mu.abs', 1]],
  }),
];

export const libraryLookup = (id: ExerciseId) => SESSION_LIBRARY.find((def) => def.id === id);

/** Bar 20 kg and pairs of 25/20/15/10/5/2.5/1.25 kg plates. */
const GYM_BAR: Implement = {
  kind: 'barbell',
  bar: { weight: 20, unit: 'kg' },
  plates: {
    unit: 'kg',
    plates: [
      { weight: 25, pairs: 4 },
      { weight: 20, pairs: 2 },
      { weight: 15, pairs: 1 },
      { weight: 10, pairs: 2 },
      { weight: 5, pairs: 2 },
      { weight: 2.5, pairs: 2 },
      { weight: 1.25, pairs: 1 },
    ],
  },
};

const STEPS_25: Implement = { kind: 'steps', unit: 'kg', start: 0, step: 2.5 };
const DUMBBELLS: Implement = {
  kind: 'list',
  unit: 'kg',
  weights: [2, 4, 6, 8, 10, 12, 12.5, 14, 15, 16, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35],
};

const ZONE = 'Europe/Zurich';
/** Epoch ms of an ISO instant (the domain never reads `Date`, not even in tests). */
export const epoch = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds;
export const T0 = epoch('2026-11-24T17:00:00Z');
export const at = (epochMs: number) => makeInstantTz(epochMs, ZONE);
export const kg = (value: number) => ({ value, unit: 'kg' as const });

export interface ContextOptions {
  readonly nowMs?: number;
  readonly history?: Readonly<Record<string, ExerciseState | null>>;
  readonly rules?: Partial<ParamValues>;
  readonly exerciseRules?: Readonly<Record<string, RuleSet>>;
  readonly level?: TraineeLevel;
  readonly preferences?: Partial<SessionPreferences>;
  readonly readiness?: readonly ReadinessEntry[];
  readonly bodyweightKg?: number | null;
  readonly idPrefix?: string;
}

let idSeed = 0;

/** A context over the session library; IDs are fresh per call unless `idPrefix` is given. */
export function context(options: ContextOptions = {}): SessionContext {
  const base = ruleSet(options.rules ?? {});
  const prefix = options.idPrefix ?? `id${++idSeed}`;
  return {
    now: at(options.nowMs ?? T0),
    ids: Array.from({ length: 64 }, (_, index) => `${prefix}-${index}`),
    exercise: libraryLookup,
    rules: (id) => (id ? (options.exerciseRules?.[id] ?? base) : base),
    equipment: (id) => {
      const def = libraryLookup(id);
      const implement =
        def?.load.type === 'barbell'
          ? GYM_BAR
          : def?.load.type === 'dumbbell'
            ? DUMBBELLS
            : def?.load.type === 'machine'
              ? STEPS_25
              : def?.load.type === 'bodyweightAdded'
                ? {
                    kind: 'loosePlates' as const,
                    plates:
                      GYM_BAR.kind === 'barbell'
                        ? GYM_BAR.plates
                        : { unit: 'kg' as const, plates: [] },
                  }
                : null;
      return { implement, mode: 'nearestTiesDown' };
    },
    history: (id) => options.history?.[id] ?? null,
    bodyweightKg: options.bodyweightKg ?? 80,
    level: options.level ?? 'intermediate',
    preferences: { ...DEFAULT_SESSION_PREFERENCES, ...options.preferences },
    readiness: options.readiness ?? [],
  };
}

/** A plan slot of the session library. */
export function slot(key: string, exerciseId: string, extra: Partial<PlanSlot> = {}): PlanSlot {
  const def = libraryLookup(exerciseId as ExerciseId)!;
  return {
    key,
    exerciseId: def.id,
    pattern: def.pattern,
    targets: [],
    priority: 'primary',
    goal: 'hypertrophy',
    prescription: { mode: 'doubleProgression', sets: 3, repRange: [8, 12], rir: [1, 2] },
    progression: 'doubleProgression',
    restSeconds: 120,
    ...extra,
  };
}

export function plannedSession(
  slots: readonly PlanSlot[],
  extra: Partial<PlannedSession> = {},
): PlannedSession {
  return {
    id: 'ps-1' as PlannedSessionId,
    planId: 'plan-1' as never,
    mesocycleIndex: 0,
    week: 1,
    dayKey: 'a',
    name: { en: 'A' },
    kind: 'regular',
    localDate: '2026-11-24' as LocalDate,
    scheduledDate: '2026-11-24' as LocalDate,
    status: 'planned',
    slots,
    adjustments: [],
    revision: 0,
    ...extra,
  };
}

const VERSIONS = { engine: '0.0.0', rules: 'test', content: 'test' } as const;

export function start(
  source: StartInput['source'],
  ctx: SessionContext,
  extra: Partial<StartInput> = {},
): Transition {
  return startSession(
    {
      sessionId: 'session-1' as SessionId,
      versions: VERSIONS,
      equipmentProfileId: null,
      source,
      ...extra,
    },
    ctx,
  );
}

/** Applies events in order with a fresh context per event (time advancing by `stepMs`). */
export function run(
  initial: SessionState,
  events: readonly SessionEvent[],
  options: ContextOptions & { readonly stepMs?: number } = {},
): { readonly state: SessionState; readonly transitions: readonly Transition[] } {
  let state = initial;
  let nowMs = options.nowMs ?? T0;
  const transitions: Transition[] = [];
  for (const event of events) {
    nowMs += options.stepMs ?? 60_000;
    const transition = reduceSession(state, event, context({ ...options, nowMs }));
    transitions.push(transition);
    state = transition.state;
  }
  return { state, transitions };
}

/** A logged working set of a past session (history folds). */
export function pastSet(
  sessionId: string,
  exerciseId: string,
  index: number,
  values: { load: number | null; reps: number; rir: number | null; type?: LoggedSet['type'] },
  localDate: string,
  extra: Partial<LoggedSet> = {},
): LoggedSet {
  return {
    id: `${sessionId}-${exerciseId}-${index}` as SetId,
    sessionId: sessionId as SessionId,
    exerciseId: exerciseId as ExerciseId,
    index,
    type: values.type ?? 'working',
    load: values.load === null ? null : kg(values.load),
    reps: values.reps,
    effort:
      values.rir === null ? { rir: null, source: 'none' } : { rir: values.rir, source: 'entered' },
    state: 'done',
    performedAt: at(epoch(`${localDate}T17:00:00Z`) + index * 60_000),
    localDate: localDate as LocalDate,
    ...extra,
  };
}

export const empty = (id: string) => emptyExerciseState(id as ExerciseId, 'k');
