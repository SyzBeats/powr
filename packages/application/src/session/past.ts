import {
  ENGINE_VERSION,
  addDays,
  instantAt,
  toLocalDate,
  type ExerciseId,
  type LocalDate,
  type LoggedSet,
  type Session,
  type SessionId,
} from '@powr/domain';
import {
  applyPastEdits,
  pastSession,
  type PastEdit,
  type PastError,
  type PastExerciseInput,
  type PrRecord,
  type SessionState,
} from '@powr/domain/session';

import type { Deps } from '../deps';
import { scheduleInsightsRefresh } from '../insights/derived';
import type { Repositories } from '../ports';
import { sessionExerciseIds } from '../ports';
import { err, ok, type Result } from '../result';
import { idPool, prepare, type Prepared } from './context';
import { deriveExercise, rebuildExercises } from './derived';

/*
 * Past sessions (WKT-15, technical concept §6.9): logging a session for a past date, editing and
 * deleting finished sessions. The raw change is one strict transaction; the derived data of every
 * exercise it touched is rebuilt right after (on the main thread until the engine worker exists,
 * TD-32). `previewPastEdit` tells the UI which PRs an edit removes or adds ("this will remove a
 * PR") before anything is written.
 */

export type PastSessionError =
  | PastError
  | { readonly kind: 'futureDate' }
  | { readonly kind: 'unknownSession' }
  | { readonly kind: 'activeSession' }
  | { readonly kind: 'unknownExercise'; readonly exerciseId: ExerciseId };

/** WKT-15: logs a finished session for a past day (or earlier today). */
export async function logPastSession(
  deps: Deps,
  input: {
    readonly localDate: LocalDate;
    /** 'HH:MM' on that day in the device's zone; noon by default. */
    readonly startTime?: string;
    readonly exercises: readonly PastExerciseInput[];
    readonly note?: string;
  },
): Promise<Result<SessionState, PastSessionError>> {
  const now = deps.clock.now();
  if (input.localDate > toLocalDate(now)) return err({ kind: 'futureDate' });
  const unknown = input.exercises.find((exercise) => !deps.content.exercise(exercise.exerciseId));
  if (unknown) return err({ kind: 'unknownExercise', exerciseId: unknown.exerciseId });
  const startTime =
    input.startTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)
      ? input.startTime
      : '12:00';
  const startedAt = instantAt(input.localDate, startTime, now.zone);
  const prepared = await prepare(deps);
  const built = pastSession(
    {
      sessionId: deps.ids.next() as SessionId,
      localDate: input.localDate,
      startedAt: startedAt.epochMs > now.epochMs ? now : startedAt,
      versions: {
        engine: ENGINE_VERSION,
        rules: deps.rules.version,
        content: deps.content.version,
      },
      equipmentProfileId:
        prepared.equipmentProfiles.find((profile) => profile.isDefault)?.id ?? null,
      exercises: input.exercises,
      ...(input.note ? { note: input.note } : {}),
    },
    idPool(
      deps,
      input.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    ),
  );
  if ('error' in built) return err(built.error);
  await deps.uow.write(['sessions', 'sets'], async (repos) => {
    await repos.sessions.put(built.state.session);
    for (const set of built.state.sets) await repos.sets.put(set);
  });
  await rebuildExercises(deps, prepared, sessionExerciseIds(built.state.session, built.state.sets));
  scheduleInsightsRefresh(deps, [built.state.session.localDate]);
  return ok(built.state);
}

async function loadFinished(
  repos: Repositories,
  sessionId: SessionId,
): Promise<Result<SessionState, PastSessionError>> {
  const session = await repos.sessions.get(sessionId);
  if (!session) return err({ kind: 'unknownSession' });
  if (session.status === 'active') return err({ kind: 'activeSession' });
  return ok({ session, sets: await repos.sets.bySession(sessionId) });
}

/** One finished session in the past-sessions list (WKT-15, WKT-01 "repeat"). */
export interface PastSessionSummary {
  readonly session: Session;
  /** Logged sets (done), warm-ups included. */
  readonly doneSets: number;
  /** The exercises in the order they were logged. */
  readonly exerciseIds: readonly ExerciseId[];
}

/**
 * WKT-15 and WKT-01: finished and partial sessions of the last `days` days, newest first
 * (discarded and active ones are left out). A minimal list until the history screens (M4).
 */
export async function listPastSessions(
  deps: Deps,
  input: { readonly days?: number; readonly limit?: number } = {},
): Promise<readonly PastSessionSummary[]> {
  const today = toLocalDate(deps.clock.now());
  const from = addDays(today, -(input.days ?? 120));
  return deps.uow.read(['sessions', 'sets'], async (repos) => {
    const sessions = (await repos.sessions.inRange(from, today))
      .filter((session) => session.status === 'finished' || session.status === 'partial')
      .toSorted((a, b) => b.startedAt.epochMs - a.startedAt.epochMs)
      .slice(0, input.limit ?? 50);
    return Promise.all(
      sessions.map(async (session) => {
        const sets = (await repos.sets.bySession(session.id)).filter((set) => set.state === 'done');
        return {
          session,
          doneSets: sets.length,
          exerciseIds: sessionExerciseIds(session, sets),
        };
      }),
    );
  });
}

/** One finished session with its sets, for the past-session editor (WKT-15). */
export async function pastSessionDetail(
  deps: Deps,
  sessionId: SessionId,
): Promise<Result<SessionState, PastSessionError>> {
  return deps.uow.read(['sessions', 'sets'], (repos) => loadFinished(repos, sessionId));
}

/** A PR and its value: an edit that changes the value replaces the PR. */
const prKey = (pr: PrRecord) => `${pr.id}|${pr.valueKg}`;

/** The PRs these edits would remove and add (WKT-15 "this will remove a PR"). */
export async function previewPastEdit(
  deps: Deps,
  input: { readonly sessionId: SessionId; readonly edits: readonly PastEdit[] },
): Promise<
  Result<
    { readonly removed: readonly PrRecord[]; readonly added: readonly PrRecord[] },
    PastSessionError
  >
> {
  const prepared = await prepare(deps);
  const loaded = await deps.uow.read(['sessions', 'sets'], (repos) =>
    loadFinished(repos, input.sessionId),
  );
  if (!loaded.ok) return loaded;
  const edited = applyPastEdits(loaded.value, input.edits, idPool(deps, input.edits.length));
  if ('error' in edited) return err(edited.error);
  const before = await recomputedPrs(deps, prepared, edited.touched, null);
  const after = await recomputedPrs(deps, prepared, edited.touched, edited.state);
  const beforeKeys = new Set(before.map(prKey));
  const afterKeys = new Set(after.map(prKey));
  return ok({
    removed: before.filter((pr) => !afterKeys.has(prKey(pr))),
    added: after.filter((pr) => !beforeKeys.has(prKey(pr))),
  });
}

/** The PRs of these exercises from the raw logs, with one session replaced (or as stored). */
async function recomputedPrs(
  deps: Deps,
  prepared: Prepared,
  exerciseIds: readonly ExerciseId[],
  replacement: SessionState | null,
): Promise<PrRecord[]> {
  const raw = await deps.uow.read(['sets', 'sessions'], async (repos) => {
    const sets = new Map<ExerciseId, LoggedSet[]>();
    for (const id of exerciseIds) sets.set(id, await repos.sets.byExercise(id));
    const sessionIds = new Set([...sets.values()].flat().map((set) => set.sessionId));
    return { sets, sessions: await repos.sessions.byIds([...sessionIds]) };
  });
  const prs: PrRecord[] = [];
  for (const id of exerciseIds) {
    let sets = raw.sets.get(id) ?? [];
    let sessions: readonly Session[] = raw.sessions;
    if (replacement) {
      sets = [
        ...sets.filter((set) => set.sessionId !== replacement.session.id),
        ...replacement.sets.filter((set) => set.exerciseId === id),
      ];
      sessions = [
        ...sessions.filter((session) => session.id !== replacement.session.id),
        replacement.session,
      ];
    }
    prs.push(...(deriveExercise(deps, prepared, id, sets, sessions)?.prs ?? []));
  }
  return prs;
}

/** WKT-15: edits a finished session and recomputes everything derived from it. */
export async function editPastSession(
  deps: Deps,
  input: { readonly sessionId: SessionId; readonly edits: readonly PastEdit[] },
): Promise<Result<SessionState, PastSessionError>> {
  const prepared = await prepare(deps);
  const ids = idPool(deps, input.edits.length);
  const unknown = input.edits.find(
    (edit) => edit.kind === 'addSet' && !deps.content.exercise(edit.exerciseId),
  );
  if (unknown?.kind === 'addSet')
    return err({ kind: 'unknownExercise', exerciseId: unknown.exerciseId });
  const result = await deps.uow.write(['sessions', 'sets'], async (repos) => {
    const loaded = await loadFinished(repos, input.sessionId);
    if (!loaded.ok) return loaded;
    const edited = applyPastEdits(loaded.value, input.edits, ids);
    if ('error' in edited) return err(edited.error);
    const keep = new Set(edited.state.sets.map((set) => set.id));
    for (const set of loaded.value.sets) if (!keep.has(set.id)) await repos.sets.delete(set.id);
    for (const set of edited.state.sets) await repos.sets.put(set);
    await repos.sessions.put(edited.state.session);
    return ok({ state: edited.state, touched: edited.touched });
  });
  if (!result.ok) return result;
  await rebuildExercises(deps, prepared, result.value.touched);
  scheduleInsightsRefresh(deps, [result.value.state.session.localDate]);
  return ok(result.value.state);
}

/** WKT-15: deletes a finished session with its sets; its check-in stays, unlinked. */
export async function deletePastSession(
  deps: Deps,
  sessionId: SessionId,
): Promise<Result<void, PastSessionError>> {
  const prepared = await prepare(deps);
  const result = await deps.uow.write(
    ['sessions', 'sets', 'readiness', 'plannedSessions'],
    async (repos) => {
      const loaded = await loadFinished(repos, sessionId);
      if (!loaded.ok) return loaded;
      const { session, sets } = loaded.value;
      for (const set of sets) await repos.sets.delete(set.id);
      await repos.sessions.delete(sessionId);
      for (const entry of await repos.readiness.bySession(sessionId)) {
        const { sessionId: _unlinked, ...rest } = entry;
        await repos.readiness.put(rest);
      }
      if (session.plannedSessionId) {
        const planned = await repos.plannedSessions.get(session.plannedSessionId);
        if (planned?.status === 'done') {
          await repos.plannedSessions.putMany([
            { ...planned, status: 'planned', revision: planned.revision + 1 },
          ]);
        }
      }
      return ok({ ids: sessionExerciseIds(session, sets), localDate: session.localDate });
    },
  );
  if (!result.ok) return result;
  await rebuildExercises(deps, prepared, result.value.ids);
  scheduleInsightsRefresh(deps, [result.value.localDate]);
  return ok(undefined);
}
