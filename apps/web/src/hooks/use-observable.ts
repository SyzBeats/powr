import { useMemo, useSyncExternalStore } from 'react';

import type { Observable } from '@powr/application';

export type LiveValue<T> =
  | { readonly loaded: false }
  | { readonly loaded: true; readonly value: T };

const LOADING: LiveValue<never> = { loaded: false };

/**
 * Subscribes to a repository observable (Dexie liveQuery) via useSyncExternalStore (§8.5).
 * `observable` must be stable across renders, e.g. created in useMemo.
 */
export function useObservable<T>(observable: Observable<T>): LiveValue<T> {
  const store = useMemo(() => createObservableStore(observable), [observable]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

function createObservableStore<T>(observable: Observable<T>) {
  let snapshot: LiveValue<T> = LOADING;
  return {
    subscribe: (onChange: () => void) => {
      const subscription = observable.subscribe({
        next(value) {
          snapshot = { loaded: true, value };
          onChange();
        },
        error(error) {
          // Rethrown outside React so it reaches the global error logging (§8.16).
          queueMicrotask(() => {
            throw error;
          });
        },
      });
      return () => subscription.unsubscribe();
    },
    getSnapshot: () => snapshot,
  };
}
