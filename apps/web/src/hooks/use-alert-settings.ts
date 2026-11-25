import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { NotificationPermissionState } from '@powr/application';
import type { SettingsRecord } from '@powr/formats';

import { announce } from '#ui/announcer';

import type { AlertStatusReport, WakeLockStatus } from '../app/container';
import { useContainer } from '../app/container-context';
import { useObservable } from './use-observable';
import { useTimerKit } from './use-timer-kit';

/**
 * Alert settings (SET-03, SET-04, SET-10), stored in the settings record as `alerts`. Absent
 * fields mean the defaults below (product-owner decision 2026-11-24: pre-alert on at 10 s, 3-2-1
 * off, the "Resting – ends at" notice on, volume 80%, keep the screen on; M4v: the timed set's
 * 3-2-1 lead-in, its automatic stop at the target and the tempo metronome off); a change writes
 * the whole object.
 */
export type AlertSettings = Required<NonNullable<SettingsRecord['alerts']>>;

/** SET-03: the pre-alert timings to choose from. */
export const PRE_ALERT_SECONDS = [
  5, 10, 15,
] as const satisfies readonly AlertSettings['preAlertSeconds'][];

type OptionalAlertSwitch = 'setTimerLeadIn' | 'setTimerAutoStop' | 'tempoCues';

/** The fields the stored `alerts` object always carries (the strict v2 record requires them). */
const STORED_DEFAULTS: Omit<AlertSettings, OptionalAlertSwitch> = {
  sound: true,
  volume: 0.8,
  vibration: true,
  preAlert: true,
  preAlertSeconds: 10,
  countdown: false,
  restingNotice: true,
  keepScreenOn: true,
};

/** M4v's optional switches are stored only once changed: absent means off. */
const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  ...STORED_DEFAULTS,
  setTimerLeadIn: false,
  setTimerAutoStop: false,
  tempoCues: false,
};

export function useAlertSettings(): AlertSettings & { readonly loaded: boolean } {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.settings(), [deps]);
  const settings = useObservable(observable);
  const stored = settings.loaded ? settings.value?.alerts : undefined;
  return useMemo(
    () => ({ ...DEFAULT_ALERT_SETTINGS, ...stored, loaded: settings.loaded }),
    [stored, settings.loaded],
  );
}

/**
 * Persists a change of the alert settings. Written through the unit of work like the theme;
 * M3a/M3b may move it into a `setAlertSettings` use case (IMPLEMENTATION_NOTES.md, M3t).
 */
export function useSetAlertSettings() {
  const { deps, platform } = useContainer();
  return useCallback(
    async (patch: Partial<AlertSettings>) => {
      if (patch.keepScreenOn !== undefined)
        platform.timers.current()?.screenWake.setEnabled(patch.keepScreenOn);
      await deps.uow.write(['settings'], async (repos) => {
        const current = await repos.settings.get();
        const alerts = { ...STORED_DEFAULTS, ...current?.alerts, ...patch };
        await repos.settings.put({
          ...current,
          id: 'me',
          theme: current?.theme ?? 'system',
          alerts,
        });
      });
    },
    [deps, platform],
  );
}

/** Notification permission, requested only by a tap after an in-app explanation (§8.8.4). */
export function useNotificationPermission() {
  const { platform } = useContainer();
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    platform.notifications.permission(),
  );
  useEffect(() => {
    // The user may change it in the browser's site settings while the app is open.
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const update = () => setPermission(platform.notifications.permission());
    void navigator.permissions
      ?.query({ name: 'notifications' })
      .then((result) => {
        if (cancelled) return;
        status = result;
        result.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      status?.removeEventListener('change', update);
    };
  }, [platform]);
  const request = useCallback(async () => {
    const result = await platform.notifications.request();
    setPermission(result);
    return result;
  }, [platform]);
  return { permission, request };
}

/**
 * "Alerts while screen is locked: Supported / Limited / Not supported" for this browser (§8.8.5),
 * re-evaluated when the permission or the resting-notice setting changes. Null while loading.
 */
export function useAlertStatus(
  permission: NotificationPermissionState,
  restingNotice: boolean,
): AlertStatusReport | null {
  const timers = useTimerKit();
  const [report, setReport] = useState<AlertStatusReport | null>(null);
  const variant = timers.labs.audioKeepAlive() ? 'E' : restingNotice ? 'D' : 'C';
  useEffect(() => {
    let cancelled = false;
    void timers.alertStatus(variant, permission).then((next) => {
      if (!cancelled) setReport(next);
    });
    return () => {
      cancelled = true;
    };
  }, [timers, variant, permission]);
  return report;
}

export function useWakeLockStatus(): WakeLockStatus {
  const { screenWake } = useTimerKit();
  return useSyncExternalStore(screenWake.subscribe, screenWake.status);
}

/**
 * "Test alert" (SET-04): the rest-end alert now, with the current settings, in every channel
 * (sound at the in-app volume, vibration, the polite announcement); the caller shows the done
 * state. Runs in the tap, so it also unlocks audio.
 */
export function useTestAlert() {
  const { platform } = useContainer();
  const { audio } = useTimerKit();
  const settings = useAlertSettings();
  const { t } = useLingui();
  return useCallback(async () => {
    const unlocked = await audio.unlock();
    if (settings.sound && unlocked) audio.play('restEnd', settings.volume);
    const vibrated = settings.vibration && platform.haptics.vibrate([200, 100, 200]);
    announce(t`Test alert: rest over`);
    return { sound: settings.sound && unlocked, vibrated };
  }, [platform, audio, settings, t]);
}
