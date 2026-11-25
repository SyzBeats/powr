import { useEffect, useEffectEvent, useState } from 'react';

import type { Observable } from '@powr/application';

/**
 * A value that loads asynchronously. `stale` is true while a newer load (another key, or a
 * `reload()`) is under way and the previous value is still shown, so a chart or a list keeps its
 * place instead of flashing a loading state on every filter change.
 */
export type Loadable<T> =
  | { readonly loaded: false }
  | { readonly loaded: true; readonly value: T; readonly stale: boolean };

/**
 * Loads `load()` once per `key` (and again after `reload()`), keeping the last value while the
 * next one loads. `key` names everything the load depends on (for example
 * `${exerciseId}|${range}`); `load` may be a new closure on every render.
 */
export function useLoad<T>(
  key: string,
  load: () => Promise<T>,
): Loadable<T> & { readonly reload: () => void } {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ readonly id: string; readonly value: T } | null>(null);
  const run = useEffectEvent(() => load());
  const id = `${version}:${key}`;
  useEffect(() => {
    let cancelled = false;
    run().then(
      (value) => {
        if (!cancelled) setState({ id, value });
      },
      (error: unknown) => {
        // Rethrown outside React so it reaches the global error logging (§8.16).
        queueMicrotask(() => {
          throw error;
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);
  const reload = () => setVersion((current) => current + 1);
  return state === null
    ? { loaded: false, reload }
    : { loaded: true, value: state.value, stale: state.id !== id, reload };
}

/**
 * Subscribes to a live query that comes from a lazy chunk (`observeHome`, `observeWeeklyVolume`,
 * …): `open()` loads the chunk and returns the observable. Re-subscribes when `key` changes and
 * keeps the last value (`stale`) until the new query emits.
 */
export function useLazyLive<T>(key: string, open: () => Promise<Observable<T>>): Loadable<T> {
  const [state, setState] = useState<{ readonly key: string; readonly value: T } | null>(null);
  const start = useEffectEvent(() => open());
  useEffect(() => {
    let closed = false;
    let unsubscribe: (() => void) | null = null;
    start().then(
      (observable) => {
        if (closed) return;
        const subscription = observable.subscribe({
          next(value) {
            if (!closed) setState({ key, value });
          },
          error(error) {
            queueMicrotask(() => {
              throw error;
            });
          },
        });
        unsubscribe = () => subscription.unsubscribe();
      },
      (error: unknown) => {
        queueMicrotask(() => {
          throw error;
        });
      },
    );
    return () => {
      closed = true;
      unsubscribe?.();
    };
  }, [key]);
  return state === null
    ? { loaded: false }
    : { loaded: true, value: state.value, stale: state.key !== key };
}
