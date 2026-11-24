import { useMemo } from 'react';

import { finishSession, logSet, type LogSetCommand } from '@powr/application';
import type { SessionId } from '@powr/domain';

import { useContainer } from '../app/container-context';
import { useObservable } from './use-observable';

export function useActiveSession() {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.activeSession(), [deps]);
  return useObservable(observable);
}

export function useSessionSets(sessionId: SessionId) {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.sessionSets(sessionId), [deps, sessionId]);
  return useObservable(observable);
}

/** Command hook: logs a set durably and records the commit latency (NFR-PERF-03). */
export function useLogSet() {
  const { deps, diagnostics } = useContainer();
  return async (command: LogSetCommand) => {
    const startedAt = performance.now();
    const result = await logSet(deps, command);
    if (result.ok) {
      diagnostics.log('info', 'set.logged', {
        commitMs: Math.round(performance.now() - startedAt),
        startedSession: result.value.startedSession,
      });
    }
    return result;
  };
}

/** Finishes the session, then checks for an app update the gate may have deferred (§6.3). */
export function useFinishSession() {
  const { deps, diagnostics, serviceWorker } = useContainer();
  return async () => {
    const result = await finishSession(deps);
    if (result.ok) {
      diagnostics.log('info', 'session.finished');
      void serviceWorker.checkForUpdate();
    }
    return result;
  };
}
