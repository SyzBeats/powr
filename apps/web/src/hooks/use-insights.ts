import { useEffect, useMemo } from 'react';

import type { Deps, Observable } from '@powr/application';
import type * as InsightsEntry from '@powr/application/insights';

import { useContainer } from '../app/container-context';
import { useLazyLive, useLoad, type Loadable } from './use-load';

/**
 * The insight and motivation use cases (M4a: the analytics engine, the streak, bodyweight, the
 * scores) are a lazy chunk, so they stay off the startup path (§8.19); the service worker
 * precaches it, so the screens work offline from the first visit. Lint allows only type imports
 * of it elsewhere (`LAZY_INSIGHTS`).
 */
// oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the chunk
const loadInsights = () => import('@powr/application/insights');

export type Insights = typeof InsightsEntry;

/**
 * Runs insight use cases: `run((insights, deps) => insights.streakView(deps))`. Loads the chunk
 * on first use and passes the container's dependencies.
 */
export function useInsights() {
  const { deps } = useContainer();
  return useMemo(
    () =>
      async function run<T>(task: (insights: Insights, deps: Deps) => Promise<T> | T): Promise<T> {
        return task(await loadInsights(), deps);
      },
    [deps],
  );
}

/** One insight query per `key` (see `useLoad`): `useInsight(id, (i, deps) => i.prHistory(deps))`. */
export function useInsight<T>(
  key: string,
  task: (insights: Insights, deps: Deps) => Promise<T>,
): Loadable<T> & { readonly reload: () => void } {
  const run = useInsights();
  return useLoad(key, () => run(task));
}

/**
 * A live insight query (`observeHome`, `observeWeeklyVolume`, `observeBodyweight`): re-emits
 * when the data changes; `key` names its parameters.
 */
export function useLiveInsight<T>(
  key: string,
  open: (insights: Insights, deps: Deps) => Observable<T>,
): Loadable<T> {
  const { deps } = useContainer();
  return useLazyLive(key, async () => open(await loadInsights(), deps));
}

/** How long after start the warm-up waits before it asks for idle time. */
const WARMUP_DELAY_MS = 5000;
/** Containers whose warm-up has started (once per app run). */
const warmedUp = new WeakSet<Deps>();

/**
 * Brings the derived weeks and the streak up to date once, in idle time after the app started
 * (M4b): Home checks only the weeks it shows, so this catches older planned-session changes. It
 * waits a few seconds after the first screen, then for idle time, and never starts while a
 * workout is active (`enabled` false), so it never competes with logging (§6.9). It loads the
 * insights chunk only then.
 */
export function useInsightsWarmup(enabled: boolean): void {
  const { deps } = useContainer();
  useEffect(() => {
    if (!enabled || warmedUp.has(deps)) return undefined;
    let idleHandle: number | null = null;
    const work = () => {
      if (warmedUp.has(deps)) return;
      warmedUp.add(deps);
      loadInsights()
        .then((insights) => insights.ensureInsights(deps))
        .catch((error: unknown) => {
          queueMicrotask(() => {
            throw error;
          });
        });
    };
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window)
        idleHandle = window.requestIdleCallback(work, { timeout: 10_000 });
      else work();
    }, WARMUP_DELAY_MS);
    return () => {
      clearTimeout(timer);
      if (idleHandle !== null) window.cancelIdleCallback(idleHandle);
    };
  }, [deps, enabled]);
}
