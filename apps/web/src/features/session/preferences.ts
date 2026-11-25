import type { ExerciseId } from '@powr/domain';
import { DEFAULT_SESSION_PREFERENCES, type SessionPreferences } from '@powr/domain/session';

import { useSettingsRecord } from '../../hooks/use-settings';

/**
 * The session preferences (settings `session`: TMR-01 rest auto-start, TMR-07 count-up, RDY-01
 * check-in, WKT-16 hints, SET-05 rounding, per-exercise choices) with the defaults for what is
 * not set; `loaded` is false until the settings record was read.
 */
export function useSessionPreferences(): SessionPreferences & { readonly loaded: boolean } {
  const settings = useSettingsRecord();
  const stored = settings.loaded ? settings.value?.session : undefined;
  return {
    restAutoStart: stored?.restAutoStart ?? DEFAULT_SESSION_PREFERENCES.restAutoStart,
    restMode: stored?.restMode ?? DEFAULT_SESSION_PREFERENCES.restMode,
    readinessCheckIn: stored?.readinessCheckIn ?? DEFAULT_SESSION_PREFERENCES.readinessCheckIn,
    hintsOff: stored?.hintsOff ?? [],
    rounding: stored?.rounding ?? DEFAULT_SESSION_PREFERENCES.rounding,
    exercises: (stored?.exercises ?? []).map((entry) => ({
      ...entry,
      exerciseId: entry.exerciseId as ExerciseId,
    })),
    loaded: settings.loaded,
  };
}
