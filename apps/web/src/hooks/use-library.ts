import { useMemo } from 'react';

import type { Deps } from '@powr/application';
import type * as LibraryEntry from '@powr/application/library';

import { useContainer } from '../app/container-context';
import { useLoad, type Loadable } from './use-load';

/**
 * The exercise library and the body map's lists and actions (M4a: search, detail, custom
 * exercises, marks, setup memory, a muscle's ranked exercises) are a lazy chunk like the other
 * use-case entries (§8.19, `LAZY_INSIGHTS`); the service worker precaches it.
 */
// oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the chunk
const loadLibrary = () => import('@powr/application/library');

export type Library = typeof LibraryEntry;

/**
 * Runs library use cases: `run((library, deps) => library.searchExercises(deps, query))`. Loads
 * the chunk on first use and passes the container's dependencies.
 */
export function useLibrary() {
  const { deps } = useContainer();
  return useMemo(
    () =>
      async function run<T>(task: (library: Library, deps: Deps) => Promise<T> | T): Promise<T> {
        return task(await loadLibrary(), deps);
      },
    [deps],
  );
}

/** One library query per `key` (see `useLoad`). */
export function useLibraryQuery<T>(
  key: string,
  task: (library: Library, deps: Deps) => Promise<T>,
): Loadable<T> & { readonly reload: () => void } {
  const run = useLibrary();
  return useLoad(key, () => run(task));
}
