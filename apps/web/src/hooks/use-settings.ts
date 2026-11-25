import { useMemo } from 'react';

import { setTheme } from '@powr/application';
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
