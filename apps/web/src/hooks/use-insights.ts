import { useMemo } from 'react';

import type { Deps, Observable } from '@powr/application';

import { useContainer } from '../app/container-context';
import { loadInsights, type Insights } from './insights-loader';
import { useLazyLive, useLoad, type Loadable } from './use-load';

export type { Insights } from './insights-loader';

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
