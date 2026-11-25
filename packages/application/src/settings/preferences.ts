import type { Profile } from '@powr/domain';
import type { SettingsRecord } from '@powr/formats';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import {
  ALERT_DEFAULTS,
  DISPLAY_DEFAULTS,
  TRAINING_DEFAULTS,
  type AlertSettings,
  type DisplayPreferences,
  type TrainingPreferences,
} from '../usecases/settings';

/** The settings record with a change applied; a missing record starts from the defaults. */
export async function changeSettings(
  deps: Deps,
  change: (settings: SettingsRecord) => SettingsRecord,
): Promise<SettingsRecord> {
  return deps.uow.write(['settings'], async (repos) => {
    const current = (await repos.settings.get()) ?? { id: 'me' as const, theme: 'system' as const };
    const next = change(current);
    await repos.settings.put(next);
    return next;
  });
}

/**
 * TD-42 (M5s): the alert settings (SET-03 pre-alert and its timing, 3-2-1; SET-04 sound, volume,
 * vibration; SET-10 keep the screen on; §8.8.4 the "Resting until" notice; TMR-09/10 switches).
 * The stored object always carries the eight required fields; values outside their range are
 * clamped (volume 0–1) or refused (the pre-alert timing is 5, 10 or 15 s).
 */
export async function setAlertSettings(
  deps: Deps,
  patch: Partial<AlertSettings>,
): Promise<Result<AlertSettings, { readonly kind: 'invalidPreAlertSeconds' }>> {
  if (patch.preAlertSeconds !== undefined && ![5, 10, 15].includes(patch.preAlertSeconds))
    return err({ kind: 'invalidPreAlertSeconds' });
  const clean = {
    ...patch,
    ...(patch.volume === undefined ? {} : { volume: Math.min(1, Math.max(0, patch.volume)) }),
  };
  const next = await changeSettings(deps, (settings) => ({
    ...settings,
    alerts: { ...REQUIRED_ALERTS, ...settings.alerts, ...clean },
  }));
  return ok({ ...ALERT_DEFAULTS, ...next.alerts });
}

/** The fields the strict record requires; M4v's switches are stored only once changed. */
const {
  setTimerLeadIn: _leadIn,
  setTimerAutoStop: _autoStop,
  tempoCues: _tempo,
  ...REQUIRED_ALERTS
} = ALERT_DEFAULTS;

/** SET-05: stores the changed training preferences (the rest stay as they are). */
export async function setTrainingPreferences(
  deps: Deps,
  patch: Partial<TrainingPreferences>,
): Promise<TrainingPreferences> {
  const next = await changeSettings(deps, (settings) => ({
    ...settings,
    training: { ...settings.training, ...patch },
  }));
  return { ...TRAINING_DEFAULTS, ...next.training };
}

/** SET-10: stores the changed display preferences. */
export async function setDisplayPreferences(
  deps: Deps,
  patch: Partial<DisplayPreferences>,
): Promise<DisplayPreferences> {
  const next = await changeSettings(deps, (settings) => ({
    ...settings,
    display: { ...settings.display, ...patch },
  }));
  return { ...DISPLAY_DEFAULTS, ...next.display };
}

/**
 * SET-02: the units for weights, body weight and lengths. Display only: stored values keep their
 * own unit and are converted when shown, so switching back and forth never drifts
 * (NFR-REL-07). Equipment keeps the unit of each plate set.
 */
export async function setUnits(
  deps: Deps,
  units: Profile['units'],
): Promise<Result<Profile['units'], { readonly kind: 'noProfile' }>> {
  const now = deps.clock.now();
  return deps.uow.write(['profile'], async (repos) => {
    const profile = await repos.profile.get();
    if (!profile) return err({ kind: 'noProfile' as const });
    await repos.profile.put({ ...profile, units: { ...units }, updatedAt: now });
    return ok(units);
  });
}
