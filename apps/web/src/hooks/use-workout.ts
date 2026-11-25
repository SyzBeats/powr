import { useMemo, useSyncExternalStore } from 'react';

import type { Deps } from '@powr/application';
import type * as SessionEntryModule from '@powr/application/session';
import type { SessionView } from '@powr/domain/session';

import { useContainer } from '../app/container-context';
import type { LiveValue } from './use-observable';

/**
 * The workout session use cases (M3a: the reducer, the engine in the session, past sessions) are
 * a lazy chunk, so they stay off the startup path (§8.19); the service worker precaches it, so
 * the session works offline from the first visit. Lint allows only type imports of it elsewhere.
 */
// oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the chunk
const loadSessionEntry = () => import('@powr/application/session');

export type SessionEntry = typeof SessionEntryModule;

/**
 * Runs session use cases: `run((session, deps) => session.dispatch(deps, event))`. Loads the
 * chunk on first use and passes the container's dependencies.
 */
export function useSessionUseCases() {
  const { deps } = useContainer();
  return useMemo(
    () =>
      async function run<T>(
        task: (session: SessionEntry, deps: Deps) => Promise<T> | T,
      ): Promise<T> {
        return task(await loadSessionEntry(), deps);
      },
    [deps],
  );
}

interface ViewStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => LiveValue<SessionView | null>;
}

const LOADING: LiveValue<never> = { loaded: false };
const stores = new WeakMap<Deps, ViewStore>();

/**
 * One live subscription per container, shared by every reader (the session screen, the shell's
 * session runtime and the mini timer) and closed when the last one unmounts.
 */
function viewStore(deps: Deps): ViewStore {
  const existing = stores.get(deps);
  if (existing) return existing;
  const listeners = new Set<() => void>();
  let snapshot: LiveValue<SessionView | null> = LOADING;
  let unsubscribe: (() => void) | null = null;
  let generation = 0;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const start = () => {
    const current = ++generation;
    void loadSessionEntry().then((entry) => {
      if (current !== generation) return;
      const subscription = entry.observeActiveSession(deps).subscribe({
        next(value) {
          snapshot = { loaded: true, value };
          notify();
        },
        error(error) {
          // Rethrown outside React so it reaches the global error logging (§8.16).
          queueMicrotask(() => {
            throw error;
          });
        },
      });
      unsubscribe = () => subscription.unsubscribe();
    });
  };
  const store: ViewStore = {
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        generation++;
        unsubscribe?.();
        unsubscribe = null;
        snapshot = LOADING;
      };
    },
    getSnapshot: () => snapshot,
  };
  stores.set(deps, store);
  return store;
}

/**
 * The live session view (WKT-02, §8.5): every planned set with its logged record or its
 * suggestion and "Why?", the last-time panel, the timer, the clock and the PRs so far. `null`
 * without an active session; not loaded while the chunk or the first query is on its way.
 */
export function useSessionView(): LiveValue<SessionView | null> {
  const { deps } = useContainer();
  const store = viewStore(deps);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
