import {
  ENGINE_VERSION,
  toLocalDate,
  weekStartOf,
  addDays,
  type ExerciseId,
  type IsoWeekday,
  type PlannedSession,
  type PlannedSessionId,
  type Session,
  type SessionId,
} from '@powr/domain';
import {
  lowReadinessDays,
  reduceSession,
  sessionSummary,
  sessionView,
  startSession,
  type SessionEffect,
  type SessionEvent,
  type SessionPreferences,
  type SessionRejection,
  type SessionResult,
  type SessionState,
  type SessionSummary,
  type SessionView,
  type StartInput,
} from '@powr/domain/session';
import type { SettingsRecord } from '@powr/formats';

import type { Deps } from '../deps';
import type { Repositories, TableName } from '../ports';
import { sessionExerciseIds } from '../ports';
import { err, ok, type Result } from '../result';
import { idPool, prepare, readinessWindow, sessionContext, type Prepared } from './context';
import { deriveExercise, ensureDerived, rebuildExercises } from './derived';

/*
 * The workout use cases (technical concept §6.2, §8.5): each event runs the pure reducer inside
 * one strict transaction that reads the active session, its sets and the derived state of its
 * exercises, and writes the session and the changed set records (DAT-02, §8.2.4). Everything
 * asynchronous (rules, derived-data rebuilds) happens before the transaction. The application
 * runs the `persist`, `activeSession`, `plan.*` and `recompute` effects; the others are returned
 * for the app's effect runner (timer alerts, wake lock, haptics, sound, live region).
 */

/** Effects the application runs itself. */
const APPLICATION_EFFECTS: ReadonlySet<SessionEffect['kind']> = new Set([
  'persist',
  'activeSession',
  'plan.substitute',
  'plan.complete',
  'recompute',
]);

/** The effects for the app's effect runner (M3t): timers, wake lock, cues, celebrations. */
export type PlatformEffect = Exclude<
  SessionEffect,
  { readonly kind: 'persist' | 'activeSession' | 'plan.substitute' | 'plan.complete' | 'recompute' }
>;

function platformEffects(effects: readonly SessionEffect[]): PlatformEffect[] {
  return effects.filter(
    (effect): effect is PlatformEffect => !APPLICATION_EFFECTS.has(effect.kind),
  );
}

export interface WorkoutOutcome {
  readonly result: SessionResult;
  readonly effects: readonly PlatformEffect[];
  readonly view: SessionView;
  /** FINISH: the summary (WKT-13) and the low-readiness days for the reactive deload (PRG-12). */
  readonly summary?: SessionSummary;
  readonly lowReadinessDays?: number;
  /** READINESS: a lighter later session of the week to swap with (RDY-03), if any. */
  readonly swapWith?: PlannedSessionId | null;
}

export type StartWorkoutError =
  | { readonly kind: 'activeSession'; readonly sessionId: SessionId }
  | { readonly kind: 'unknownPlannedSession' }
  | { readonly kind: 'unknownSession' }
  | { readonly kind: 'noExercises' };

export type WorkoutError =
  | { readonly kind: 'noActiveSession' }
  | { readonly kind: 'rejected'; readonly rejection: SessionRejection };

export type StartSource =
  | { readonly kind: 'planned'; readonly plannedSessionId: PlannedSessionId }
  | { readonly kind: 'freestyle'; readonly exerciseIds: readonly ExerciseId[] }
  | { readonly kind: 'repeat'; readonly sessionId: SessionId };

const SESSION_TABLES: readonly TableName[] = [
  'sessions',
  'sets',
  'readiness',
  'dExerciseState',
  'plannedSessions',
  'plans',
];

async function persist(repos: Repositories, effects: readonly SessionEffect[]): Promise<void> {
  for (const effect of effects) {
    if (effect.kind !== 'persist') continue;
    await repos.sessions.put(effect.session);
    for (const id of effect.deleteSetIds) await repos.sets.delete(id);
    for (const set of effect.putSets) await repos.sets.put(set);
    if (effect.readiness) await repos.readiness.put(effect.readiness);
  }
}

/** WKT-08 "for the rest of the mesocycle": later planned sessions and the mesocycle's day. */
async function substituteInPlan(
  repos: Repositories,
  effect: Extract<SessionEffect, { readonly kind: 'plan.substitute' }>,
): Promise<void> {
  const planned = await repos.plannedSessions.get(effect.plannedSessionId);
  if (!planned) return;
  const swap = (slots: PlannedSession['slots']) =>
    slots.map((slot) =>
      slot.key === effect.planSlotKey ? { ...slot, exerciseId: effect.exerciseId } : slot,
    );
  const later = (await repos.plannedSessions.byPlan(planned.planId)).filter(
    (session) =>
      session.mesocycleIndex === planned.mesocycleIndex &&
      session.dayKey === planned.dayKey &&
      session.localDate >= planned.localDate &&
      (session.status === 'planned' || session.id === planned.id),
  );
  await repos.plannedSessions.putMany(
    later.map((session) => ({
      ...session,
      slots: swap(session.slots),
      revision: session.revision + 1,
    })),
  );
  const plan = await repos.plans.get(planned.planId);
  if (!plan) return;
  await repos.plans.put({
    ...plan,
    mesocycles: plan.mesocycles.map((mesocycle) =>
      mesocycle.index === planned.mesocycleIndex
        ? {
            ...mesocycle,
            days: mesocycle.days.map((day) =>
              day.key === planned.dayKey ? { ...day, slots: swap(day.slots) } : day,
            ),
          }
        : mesocycle,
    ),
    revision: plan.revision + 1,
  });
}

async function runPlanEffects(
  repos: Repositories,
  effects: readonly SessionEffect[],
): Promise<void> {
  for (const effect of effects) {
    if (effect.kind === 'plan.substitute') await substituteInPlan(repos, effect);
    if (effect.kind === 'plan.complete') {
      const planned = await repos.plannedSessions.get(effect.plannedSessionId);
      if (planned && planned.status !== 'done') {
        await repos.plannedSessions.putMany([
          { ...planned, status: 'done', revision: planned.revision + 1 },
        ]);
      }
    }
  }
}

/** After the commit: the service-worker gate and the derived data (§8.2.4, §8.2.8). */
async function runAfterCommit(
  deps: Deps,
  prepared: Prepared,
  effects: readonly SessionEffect[],
): Promise<void> {
  for (const effect of effects) {
    if (effect.kind === 'activeSession') {
      await deps.runtime.setActiveSession(
        effect.sessionId ? { id: effect.sessionId, build: deps.app.build } : null,
      );
    }
    if (effect.kind === 'recompute') await rebuildExercises(deps, prepared, effect.exerciseIds);
  }
}

function sourceExercises(source: StartInput['source']): ExerciseId[] {
  switch (source.kind) {
    case 'planned':
      return source.planned.slots.map((slot) => slot.exerciseId);
    case 'freestyle':
      return [...source.exerciseIds];
    default:
      return sessionExerciseIds(source.session, source.sets);
  }
}

/**
 * WKT-01: starts today's or another planned session, a freestyle session or a repeat of a past
 * one. "Only one session in progress" is checked inside the transaction that creates it.
 * The result carries the cursor's suggestion and the return-from-break proposals (PRG-13).
 */
export async function startWorkout(
  deps: Deps,
  input: { readonly source: StartSource; readonly warmups?: boolean },
): Promise<Result<WorkoutOutcome, StartWorkoutError>> {
  const prepared = await prepare(deps);
  const { source } = input;
  const loaded = await deps.uow.read(['plannedSessions', 'sessions', 'sets'], async (repos) => ({
    planned:
      source.kind === 'planned'
        ? await repos.plannedSessions.get(source.plannedSessionId)
        : undefined,
    past: source.kind === 'repeat' ? await repos.sessions.get(source.sessionId) : undefined,
    pastSets: source.kind === 'repeat' ? await repos.sets.bySession(source.sessionId) : [],
  }));
  let start: StartInput['source'];
  if (source.kind === 'planned') {
    if (!loaded.planned) return err({ kind: 'unknownPlannedSession' });
    start = { kind: 'planned', planned: loaded.planned };
  } else if (source.kind === 'repeat') {
    if (!loaded.past) return err({ kind: 'unknownSession' });
    start = { kind: 'repeat', session: loaded.past, sets: loaded.pastSets };
  } else {
    const known = source.exerciseIds.filter((id) => deps.content.exercise(id) !== undefined);
    start = { kind: 'freestyle', exerciseIds: known };
  }
  const exerciseIds = sourceExercises(start);
  await ensureDerived(deps, prepared, exerciseIds);

  const now = deps.clock.now();
  const today = toLocalDate(now);
  const sessionId = deps.ids.next() as SessionId;
  const ids = idPool(deps);
  const equipmentProfileId =
    (source.kind === 'planned' ? prepared.plan?.equipmentProfileId : undefined) ??
    prepared.equipmentProfiles.find((profile) => profile.isDefault)?.id ??
    null;
  const [from, to] = readinessWindow(prepared, today);
  const outcome = await deps.uow.write(SESSION_TABLES, async (repos) => {
    const active = await repos.sessions.getActive();
    if (active) return err({ kind: 'activeSession' as const, sessionId: active.id });
    const ctx = sessionContext(deps, prepared, {
      now,
      ids,
      states: await repos.derived.exerciseStates(exerciseIds),
      readiness: await repos.readiness.inRange(from, to),
      equipmentProfileId,
    });
    const transition = startSession(
      {
        sessionId,
        versions: {
          engine: ENGINE_VERSION,
          rules: deps.rules.version,
          content: deps.content.version,
        },
        equipmentProfileId,
        source: start,
        ...(input.warmups === undefined ? {} : { warmups: input.warmups }),
      },
      ctx,
    );
    await persist(repos, transition.effects);
    return ok({ transition, ctx });
  });
  if (!outcome.ok) return outcome;
  const { transition, ctx } = outcome.value;
  await runAfterCommit(deps, prepared, transition.effects);
  return ok({
    result: transition.result,
    effects: platformEffects(transition.effects),
    view: sessionView(transition.state, ctx),
  });
}

/** How heavy a planned session is: 0 heavy, 1 moderate, 2 light, 3 without lift intensities. */
function heaviness(candidate: PlannedSession): number {
  return Math.min(
    ...candidate.slots.map((slot) =>
      slot.intensity === 'heavy'
        ? 0
        : slot.intensity === 'moderate'
          ? 1
          : slot.intensity === 'light'
            ? 2
            : 3,
    ),
  );
}

/** A lighter later planned session of the same week (RDY-03 "swap the heavy day"). */
async function lighterLaterSession(
  repos: Repositories,
  session: Session,
  weekStartsOn: IsoWeekday,
): Promise<PlannedSessionId | null> {
  if (!session.plannedSessionId) return null;
  const planned = await repos.plannedSessions.get(session.plannedSessionId);
  if (!planned) return null;
  const weekStart = weekStartOf(planned.localDate, weekStartsOn);
  const today = heaviness(planned);
  const week = await repos.plannedSessions.inRange(planned.localDate, addDays(weekStart, 6));
  const lighter = week
    .filter(
      (candidate) =>
        candidate.id !== planned.id &&
        candidate.status === 'planned' &&
        candidate.localDate > planned.localDate,
    )
    .filter((candidate) => heaviness(candidate) > today)
    .toSorted((a, b) => (a.localDate < b.localDate ? -1 : 1));
  return lighter[0]?.id ?? null;
}

/**
 * Runs one event on the active session (WKT-02…16, TMR, RDY): one strict transaction, the
 * platform effects and the new view back. Rejected events change nothing.
 */
export async function dispatch(
  deps: Deps,
  event: SessionEvent,
): Promise<Result<WorkoutOutcome, WorkoutError>> {
  const prepared = await prepare(deps);
  const current = await deps.uow.read(['sessions', 'sets'], async (repos) => {
    const session = await repos.sessions.getActive();
    return session ? { session, sets: await repos.sets.bySession(session.id) } : undefined;
  });
  if (!current) return err({ kind: 'noActiveSession' });
  const extra =
    event.type === 'ADD_EXERCISE' || event.type === 'SUBSTITUTE' ? [event.exerciseId] : [];
  const exerciseIds = [...sessionExerciseIds(current.session, current.sets), ...extra];
  await ensureDerived(deps, prepared, exerciseIds);

  const now = deps.clock.now();
  const ids = idPool(deps);
  const [from, to] = readinessWindow(prepared, toLocalDate(now));
  const weekStartsOn = (prepared.settings?.weekStart ?? 1) as IsoWeekday;
  const outcome = await deps.uow.write(SESSION_TABLES, async (repos) => {
    const session = await repos.sessions.getActive();
    if (!session) return err({ kind: 'noActiveSession' as const });
    const state: SessionState = { session, sets: await repos.sets.bySession(session.id) };
    const ctx = sessionContext(deps, prepared, {
      now,
      ids,
      states: await repos.derived.exerciseStates(exerciseIds),
      readiness: await repos.readiness.inRange(from, to),
      equipmentProfileId: session.equipmentProfileId,
    });
    const transition = reduceSession(state, event, ctx);
    if (transition.result.rejected) {
      return err({ kind: 'rejected' as const, rejection: transition.result.rejected });
    }
    await persist(repos, transition.effects);
    await runPlanEffects(repos, transition.effects);
    const flag = transition.result.readiness?.assessment?.value.flag;
    const swapWith =
      event.type === 'READINESS' && (flag === 'low' || flag === 'modify')
        ? await lighterLaterSession(repos, session, weekStartsOn)
        : undefined;
    return ok({ transition, ctx, swapWith });
  });
  if (!outcome.ok) return outcome;
  const { transition, ctx, swapWith } = outcome.value;
  const finished = event.type === 'FINISH';
  const summary = finished ? sessionSummary(transition.state, ctx) : undefined;
  await runAfterCommit(deps, prepared, transition.effects);
  let lowDays: number | undefined;
  if (finished) {
    const entries = await deps.uow.read(['readiness'], (repos) =>
      repos.readiness.inRange(from, to),
    );
    lowDays = lowReadinessDays(entries, toLocalDate(now), prepared.rules(null));
  }
  return ok({
    result: transition.result,
    effects: platformEffects(transition.effects),
    view: sessionView(transition.state, ctx),
    ...(summary ? { summary } : {}),
    ...(lowDays === undefined ? {} : { lowReadinessDays: lowDays }),
    ...(swapWith === undefined ? {} : { swapWith }),
  });
}

/** WKT-14: the app reopened; re-arms the running timer and says whether the session is stale. */
export function resumeWorkout(deps: Deps): Promise<Result<WorkoutOutcome, WorkoutError>> {
  return dispatch(deps, { type: 'RESUME' });
}

/** WKT-13: finish (or finish as partial); the summary comes back with the outcome. */
export function finishWorkout(
  deps: Deps,
  input: { readonly as: 'finished' | 'partial'; readonly endAt?: 'now' | 'lastSet' },
): Promise<Result<WorkoutOutcome, WorkoutError>> {
  return dispatch(deps, {
    type: 'FINISH',
    as: input.as,
    ...(input.endAt ? { endAt: input.endAt } : {}),
  });
}

/** WKT-13: discard the active session (the UI confirms first). */
export function discardWorkout(deps: Deps): Promise<Result<WorkoutOutcome, WorkoutError>> {
  return dispatch(deps, { type: 'DISCARD' });
}

async function updateSettings(
  deps: Deps,
  change: (settings: SettingsRecord) => SettingsRecord,
): Promise<SettingsRecord> {
  return deps.uow.write(['settings'], async (repos) => {
    const current = (await repos.settings.get()) ?? { id: 'me' as const, theme: 'system' as const };
    const next = change(current);
    await repos.settings.put(next);
    return next;
  });
}

/** Session preferences (TMR-01/07, RDY-01, WKT-16, SET-05, PRG-03 manual mode, WKT-11). */
export async function updateSessionPreferences(
  deps: Deps,
  patch: Partial<SessionPreferences>,
): Promise<void> {
  await updateSettings(deps, (settings) => ({
    ...settings,
    session: {
      ...settings.session,
      ...(patch.restAutoStart === undefined ? {} : { restAutoStart: patch.restAutoStart }),
      ...(patch.restMode === undefined ? {} : { restMode: patch.restMode }),
      ...(patch.readinessCheckIn === undefined ? {} : { readinessCheckIn: patch.readinessCheckIn }),
      ...(patch.hintsOff === undefined ? {} : { hintsOff: [...patch.hintsOff] }),
      ...(patch.rounding === undefined ? {} : { rounding: patch.rounding }),
      ...(patch.exercises === undefined
        ? {}
        : { exercises: patch.exercises.map((entry) => ({ ...entry })) }),
    },
  }));
}

/**
 * TMR-03 "remember for this exercise": the rest becomes the exercise's own value (a parameter
 * override with the exercise ID, §8.6.3) and applies to its slots in the active session.
 */
export async function rememberRest(
  deps: Deps,
  input: { readonly exerciseId: ExerciseId; readonly seconds: number },
): Promise<Result<void, { readonly kind: 'unknownExercise' | 'invalidSeconds' }>> {
  const exercise = deps.content.exercise(input.exerciseId);
  if (!exercise) return err({ kind: 'unknownExercise' });
  if (!Number.isInteger(input.seconds) || input.seconds < 0 || input.seconds > 1800)
    return err({ kind: 'invalidSeconds' });
  const paramId = `session.rest.${exercise.defaults.restClass}`;
  await updateSettings(deps, (settings) => ({
    ...settings,
    overrides: [
      ...(settings.overrides ?? []).filter(
        (override) => !(override.paramId === paramId && override.exerciseId === input.exerciseId),
      ),
      { paramId, value: input.seconds, exerciseId: input.exerciseId },
    ],
  }));
  const active = await deps.uow.read(['sessions'], (repos) => repos.sessions.getActive());
  for (const slot of active?.exercises.filter((entry) => entry.exerciseId === input.exerciseId) ??
    []) {
    await dispatch(deps, { type: 'SET_REST', slotKey: slot.key, seconds: input.seconds });
  }
  return ok(undefined);
}

/** The summary of any session (WKT-13), from its records and the history before it. */
export async function workoutSummary(
  deps: Deps,
  sessionId: SessionId,
): Promise<SessionSummary | null> {
  const prepared = await prepare(deps);
  const loaded = await deps.uow.read(['sessions', 'sets'], async (repos) => ({
    session: await repos.sessions.get(sessionId),
    sets: await repos.sets.bySession(sessionId),
  }));
  if (!loaded.session) return null;
  const session = loaded.session;
  const ids = sessionExerciseIds(session, loaded.sets);
  // The history before this session: rebuilt in memory without it and the sessions after it.
  const raw = await deps.uow.read(['sets', 'sessions'], async (repos) => {
    const sets = new Map(
      await Promise.all(ids.map(async (id) => [id, await repos.sets.byExercise(id)] as const)),
    );
    const sessionIds = new Set([...sets.values()].flat().map((set) => set.sessionId));
    return { sets, sessions: await repos.sessions.byIds([...sessionIds]) };
  });
  const before = raw.sessions.filter(
    (other) =>
      other.id !== session.id &&
      (other.localDate < session.localDate ||
        (other.localDate === session.localDate &&
          other.startedAt.epochMs < session.startedAt.epochMs)),
  );
  const states = ids.flatMap(
    (id) => deriveExercise(deps, prepared, id, raw.sets.get(id) ?? [], before)?.state ?? [],
  );
  const ctx = sessionContext(deps, prepared, {
    now: session.endedAt ?? deps.clock.now(),
    ids: [],
    states,
    readiness: [],
    equipmentProfileId: session.equipmentProfileId,
  });
  return sessionSummary({ session, sets: loaded.sets }, ctx);
}
