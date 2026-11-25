import { useMemo, useSyncExternalStore } from 'react';

import {
  DISPLAY_DEFAULTS,
  TRAINING_DEFAULTS,
  setTheme,
  type Deps,
  type DisplayPreferences,
  type TrainingPreferences,
} from '@powr/application';
import type * as SettingsEntry from '@powr/application/settings';
import type { SettingsRecord, ThemePreference } from '@powr/formats';

import { useContainer } from '../app/container-context';
import { useObservable, type LiveValue } from './use-observable';

/** The settings record, live (undefined until the first change is saved). */
export function useSettingsRecord(): LiveValue<SettingsRecord | undefined> {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.settings(), [deps]);
  return useObservable(observable);
}

export function useThemePreference(): ThemePreference | null {
  const settings = useSettingsRecord();
  if (!settings.loaded) return null;
  return settings.value?.theme ?? 'system';
}

/** Applies the theme immediately (no reload, SET-01) and persists it. */
export function useSetTheme() {
  const { deps, platform } = useContainer();
  return async (theme: ThemePreference) => {
    platform.applyTheme(theme);
    await setTheme(deps, theme);
  };
}

/** Checks for an app update after a workout (the install gate may have deferred one, §6.3). */
export function useCheckForUpdate() {
  const { serviceWorker } = useContainer();
  return () => void serviceWorker.checkForUpdate();
}

/**
 * The Settings use cases (M5s: rest times, training and display preferences, per-exercise
 * choices, units, the alert settings of TD-42) are a lazy chunk, loaded on the first change.
 */
// oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the chunk
const loadSettingsEntry = () => import('@powr/application/settings');

export type Settings = typeof SettingsEntry;

/** Runs settings use cases: `run((settings, deps) => settings.setRestTime(deps, …))`. */
export function useSettingsUseCases() {
  const { deps } = useContainer();
  return useMemo(
    () =>
      async function run<T>(task: (settings: Settings, deps: Deps) => Promise<T> | T): Promise<T> {
        return task(await loadSettingsEntry(), deps);
      },
    [deps],
  );
}

/**
 * The shipped rules registry and content (LEG-05 "How POWR decides", About): their version
 * stamps and every parameter with its evidence, sources and "verified" flag (resolved for no
 * particular context; the resolver is a lazy chunk).
 */
export function useRegistryInfo() {
  const { deps } = useContainer();
  return useMemo(
    () => ({
      rulesVersion: deps.rules.version,
      contentVersion: deps.content.version,
      parameters: async () => (await deps.rules.resolve({})).rules,
    }),
    [deps],
  );
}

interface SettingsStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => LiveValue<SettingsRecord | undefined>;
}

const LOADING: LiveValue<never> = { loaded: false };
const sharedStores = new WeakMap<Deps, SettingsStore>();

/**
 * One settings subscription per container, shared by every reader of it (M5s): the effort words
 * are read by each set row of a workout, which must not open a live query each.
 */
function sharedSettings(deps: Deps): SettingsStore {
  const existing = sharedStores.get(deps);
  if (existing) return existing;
  const listeners = new Set<() => void>();
  let snapshot: LiveValue<SettingsRecord | undefined> = LOADING;
  let unsubscribe: (() => void) | null = null;
  const store: SettingsStore = {
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        const subscription = deps.queries.settings().subscribe({
          next(value) {
            snapshot = { loaded: true, value };
            for (const each of listeners) each();
          },
          error(error) {
            // Rethrown outside React so it reaches the global error logging (§8.16).
            queueMicrotask(() => {
              throw error;
            });
          },
        });
        unsubscribe = () => subscription.unsubscribe();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        unsubscribe?.();
        unsubscribe = null;
        snapshot = LOADING;
      };
    },
    getSnapshot: () => snapshot,
  };
  sharedStores.set(deps, store);
  return store;
}

/** SET-05: effort scale, RIR entry style, warm-ups, with the defaults for what is not set. */
export function useTrainingPreferences(): TrainingPreferences & { readonly loaded: boolean } {
  const { deps } = useContainer();
  const store = sharedSettings(deps);
  const settings = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const stored = settings.loaded ? settings.value?.training : undefined;
  return useMemo(
    () => ({ ...TRAINING_DEFAULTS, ...stored, loaded: settings.loaded }),
    [stored, settings.loaded],
  );
}

/** SET-10: large controls and celebrations, with the defaults for what is not set. */
export function useDisplayPreferences(): DisplayPreferences & { readonly loaded: boolean } {
  const { deps } = useContainer();
  const store = sharedSettings(deps);
  const settings = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const stored = settings.loaded ? settings.value?.display : undefined;
  return useMemo(
    () => ({ ...DISPLAY_DEFAULTS, ...stored, loaded: settings.loaded }),
    [stored, settings.loaded],
  );
}
