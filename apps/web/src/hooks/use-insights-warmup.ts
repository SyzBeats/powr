import { useEffect } from 'react';

import type { Deps } from '@powr/application';

import { useContainer } from '../app/container-context';
import { loadInsights } from './insights-loader';

/** How long after start the warm-up waits before it asks for idle time. */
const WARMUP_DELAY_MS = 5000;
/** Containers whose warm-up has started (once per app run). */
const warmedUp = new WeakSet<Deps>();

/**
 * Brings the derived weeks and the streak up to date once, in idle time after the app started
 * (M4b): Home checks only the weeks it shows, so this catches older planned-session changes. It
 * waits a few seconds after the first screen, then for idle time, and never starts while a
 * workout is active (`enabled` false), so it never competes with logging (§6.9). It loads the
 * insights chunk only then. The shell's only insight hook, so its own module (TD-63): the other
 * insight hooks load with the screens.
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
