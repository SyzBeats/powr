import type { SettingsRecord, ThemePreference } from '@powr/formats';

import type { Deps } from '../deps';

export async function setTheme(deps: Deps, theme: ThemePreference): Promise<void> {
  await deps.uow.write(['settings'], async (repos) => {
    const current = await repos.settings.get();
    await repos.settings.put({ ...current, id: 'me', theme });
  });
}

/** Every alert setting, with M4v's optional switches resolved (SET-03, SET-04, SET-10). */
export type AlertSettings = Required<NonNullable<SettingsRecord['alerts']>>;

/**
 * The alert defaults (product-owner decision 2026-11-24: pre-alert on at 10 s, 3-2-1 off, the
 * "Resting – ends at" notice on, volume 80%, keep the screen on; M4v: the timed set's lead-in,
 * its stop at the target and the tempo cues off). The first eight fields are always stored
 * (the strict v2 record requires them); the last three only once changed. Part of the root
 * entry because the startup hooks read them; `setAlertSettings` (the lazy settings entry,
 * TD-42) writes them.
 */
export const ALERT_DEFAULTS: AlertSettings = {
  sound: true,
  volume: 0.8,
  vibration: true,
  preAlert: true,
  preAlertSeconds: 10,
  countdown: false,
  restingNotice: true,
  keepScreenOn: true,
  setTimerLeadIn: false,
  setTimerAutoStop: false,
  tempoCues: false,
};

/** SET-05 training preferences: effort as RIR or RPE, the RIR entry style, warm-up sets. */
export type TrainingPreferences = Required<NonNullable<SettingsRecord['training']>>;

export const TRAINING_DEFAULTS: TrainingPreferences = {
  effortScale: 'rir',
  rirInput: 'chips',
  warmups: true,
};

/** SET-10 workout display: larger logging controls, celebrations. */
export type DisplayPreferences = Required<NonNullable<SettingsRecord['display']>>;

export const DISPLAY_DEFAULTS: DisplayPreferences = { largeControls: false, celebrations: true };
