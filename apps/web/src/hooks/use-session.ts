import { useMemo } from 'react';

import type { SessionId } from '@powr/domain';

import { useContainer } from '../app/container-context';
import { useObservable } from './use-observable';

/** The active session record (M0's live query; cheap, so the shell can watch it at all times). */
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
