import { useMemo } from 'react';

import { setTheme } from '@powr/application';
import type { ThemePreference } from '@powr/formats';

import { useContainer } from '../app/container-context';
import { useObservable } from './use-observable';

export function useThemePreference(): ThemePreference | null {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.settings(), [deps]);
  const settings = useObservable(observable);
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
