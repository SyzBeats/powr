import {
  ENGINE_VERSION,
  nextSetIndex,
  toLocalDate,
  validateSetValues,
  type ExerciseId,
  type LoggedSet,
  type Session,
  type SessionId,
  type SetId,
  type SetValueIssue,
  type SetValues,
} from '@powr/domain';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';

export interface LogSetCommand {
  readonly exerciseId: ExerciseId;
  readonly values: SetValues;
}

export type LogSetError =
  | { readonly kind: 'invalidValues'; readonly issues: SetValueIssue[] }
  | { readonly kind: 'unknownExercise' };

export interface LogSetResult {
  readonly set: LoggedSet;
  readonly session: Session;
  readonly startedSession: boolean;
}

/**
 * Logs one confirmed working set. Starts a session if none is active. The session and the set
 * are written in one strict transaction (DAT-02); "only one active session" is checked inside it.
 */
export async function logSet(
  deps: Deps,
  command: LogSetCommand,
): Promise<Result<LogSetResult, LogSetError>> {
  const issues = validateSetValues(command.values);
  if (issues.length > 0) return err({ kind: 'invalidValues', issues });
  if (!deps.content.exercise(command.exerciseId)) return err({ kind: 'unknownExercise' });

  // Everything that is not an IndexedDB call happens before the transaction (§8.2.4).
  const now = deps.clock.now();
  const localDate = toLocalDate(now);
  const newSessionId = deps.ids.next() as SessionId;
  const setId = deps.ids.next() as SetId;

  const result = await deps.uow.write(['sessions', 'sets'], async (repos) => {
    let session = await repos.sessions.getActive();
    const startedSession = session === undefined;
    if (!session) {
      session = {
        id: newSessionId,
        localDate,
        startedAt: now,
        status: 'active',
        versions: {
          engine: ENGINE_VERSION,
          rules: deps.rulesVersion,
          content: deps.content.version,
        },
      };
      await repos.sessions.put(session);
    }
    const sessionSets = await repos.sets.bySession(session.id);
    const set: LoggedSet = {
      id: setId,
      sessionId: session.id,
      exerciseId: command.exerciseId,
      index: nextSetIndex(sessionSets, command.exerciseId),
      type: 'working',
      load: command.values.load,
      reps: command.values.reps,
      effort:
        command.values.rir === null
          ? { rir: null, source: 'none' }
          : { rir: command.values.rir, source: 'entered' },
      state: 'done',
      performedAt: now,
      localDate,
    };
    await repos.sets.add(set);
    return { set, session, startedSession };
  });

  if (result.startedSession) {
    await deps.runtime.setActiveSession({ id: result.session.id, build: deps.app.build });
  }
  return ok(result);
}

export type FinishSessionError = { readonly kind: 'noActiveSession' };

/**
 * Finishes the active session. The runtime flag is cleared in a second step; if that is lost,
 * `reconcileRuntimeFlags` repairs it on the next start (§8.2.4).
 */
export async function finishSession(deps: Deps): Promise<Result<Session, FinishSessionError>> {
  const now = deps.clock.now();
  const finished = await deps.uow.write(['sessions'], async (repos) => {
    const active = await repos.sessions.getActive();
    if (!active) return undefined;
    const session: Session = { ...active, status: 'finished', endedAt: now };
    await repos.sessions.put(session);
    return session;
  });
  if (!finished) return err({ kind: 'noActiveSession' });
  await deps.runtime.setActiveSession(null);
  return ok(finished);
}

/** Boot step: make the service-worker install gate agree with the database. */
export async function reconcileRuntimeFlags(deps: Deps): Promise<void> {
  const active = await deps.uow.read(['sessions'], (repos) => repos.sessions.getActive());
  await deps.runtime.setActiveSession(active ? { id: active.id, build: deps.app.build } : null);
}
