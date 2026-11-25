import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { announce } from '#ui/announcer';

import type {
  AlertEvent,
  AlertOptions,
  RestAlertTexts,
  TimerDisplay,
  TimerState,
  WakeLockStatus,
} from '../app/container';
import { formatDurationLong, formatTime } from '../i18n/format';
import { useAlertSettings, useWakeLockStatus } from './use-alert-settings';
import { useTimerKit } from './use-timer-kit';

/*
 * Timers and alerts for screens (technical concept §8.8; M3t). The session screen (M3b) wires the
 * session core's timer (M3a: `TimerState` in the session record) to these hooks; see
 * IMPLEMENTATION_NOTES.md, "M3t timers and alerts". The kit behind them is a lazy chunk (M3b):
 * every hook here suspends until it is loaded, so use them inside a `<Suspense>`.
 */
export type {
  AlertEvent,
  AlertOptions,
  AlertPath,
  TimerDisplay,
  TimerState,
} from '../app/container';

/**
 * The live display of a timer: remaining or elapsed time, phase and done (§8.8.1). Computed from
 * the timer's timestamps about 4 times a second while visible, never while hidden, and at once
 * when the page becomes visible again. `now` freezes the display at that epoch (no ticking).
 */
export function useTimerDisplay(timer: TimerState | null, now?: number): TimerDisplay {
  const timers = useTimerKit();
  const store = useMemo(() => timers.displayStore(timer, now), [timers, timer, now]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Creates and resumes the audio context; call it in the "Start session" tap (§8.8.2). */
export function useUnlockAudio(): () => Promise<boolean> {
  const { audio } = useTimerKit();
  return useCallback(() => audio.unlock(), [audio]);
}

/**
 * Keeps the screen on while `active` (an active session's UI is mounted) and the setting is on
 * (PWA-06, SET-10, §8.8.3). Re-acquired when the page is visible again, released when `active`
 * turns false (finish, discard), the component unmounts or the setting is switched off.
 */
export function useScreenWakeLock(active: boolean): WakeLockStatus {
  const { screenWake } = useTimerKit();
  const { keepScreenOn, loaded } = useAlertSettings();
  useEffect(() => {
    if (loaded) screenWake.setEnabled(keepScreenOn);
  }, [screenWake, keepScreenOn, loaded]);
  useEffect(() => (active ? screenWake.hold() : undefined), [screenWake, active]);
  return useWakeLockStatus();
}

/** The alert texts, translated (notification titles and bodies). */
function useRestAlertTexts(): (timer: TimerState) => RestAlertTexts {
  const { t } = useLingui();
  return useCallback(
    (timer: TimerState) => {
      const endsAt = formatTime(timer.startedAtEpochMs + timer.targetMs + timer.adjustMs);
      const restOver =
        timer.kind === 'set'
          ? { title: t`Time is up`, body: t`Your set timer has ended.` }
          : timer.kind === 'transition'
            ? { title: t`Next exercise`, body: t`Time to switch to the next exercise.` }
            : timer.mode === 'countup'
              ? { title: t`Ready when you are`, body: t`Your minimum rest is over.` }
              : { title: t`Rest over`, body: t`Time for your next set.` };
      return { restOver, resting: { title: t`Resting`, body: t`Ends at ${endsAt}` } };
    },
    [t],
  );
}

/**
 * Arms the alerts of the running timer (§8.8.2, §8.8.4) and announces its state changes politely
 * (NFR-A11Y-06): "Rest started, 2 minutes, 30 seconds", "10 seconds left" (pre-alert on), "Rest
 * over", "Rest over, 42 seconds ago" on return. Never per second. Re-arms when the timer gets a
 * new end (an adjust), disarms when it is null or the component unmounts. Mount it once while a
 * session runs (the shell's mini timer, TMR-12).
 *
 * Returns whether the current timer ended while the page was hidden (show "Rest over · +0:42").
 */
export function useTimerAlerts(
  timer: TimerState | null,
  options: { readonly url?: string } = {},
): { readonly endedWhileHidden: boolean } {
  const { restAlerts, labs } = useTimerKit();
  const settings = useAlertSettings();
  const texts = useRestAlertTexts();
  const announcement = useAnnouncement();
  const [endedWhileHidden, setEndedWhileHidden] = useState<string | null>(null);
  const keepAlive = labs.audioKeepAlive() ? { gain: labs.keepAliveGain } : false;
  const alertOptions: AlertOptions = {
    sound: settings.sound,
    volume: settings.volume,
    vibration: settings.vibration,
    preAlert: settings.preAlert,
    preAlertMs: settings.preAlertSeconds * 1000,
    countdown: settings.countdown,
    restingNotice: settings.restingNotice,
    keepAlive,
    ...(options.url ? { url: options.url } : {}),
  };
  const optionsKey = JSON.stringify(alertOptions);
  const timerId = timer?.id ?? null;

  // Order matters: subscribe before arming, because a loaded scheduler emits `armed` at once.
  useEffect(() => {
    if (!timerId) return undefined;
    return restAlerts.subscribe((event: AlertEvent) => {
      if (event.type === 'disarmed' || event.timer.id !== timerId) return;
      const message = announcement(event);
      if (message) announce(message);
      if (event.type === 'visible' && event.endedWhileHidden) setEndedWhileHidden(event.key);
      if (event.type === 'armed') setEndedWhileHidden(null);
    });
  }, [restAlerts, timerId, announcement]);

  useEffect(() => (timerId ? () => restAlerts.disarm(timerId) : undefined), [restAlerts, timerId]);

  useEffect(() => {
    if (!timer || !settings.loaded) return;
    restAlerts.arm(timer, texts(timer), JSON.parse(optionsKey) as AlertOptions);
  }, [restAlerts, timer, texts, optionsKey, settings.loaded]);

  return { endedWhileHidden: endedWhileHidden !== null && timerId !== null };
}

/** The polite announcement for an alert event, or null (never per second, NFR-A11Y-06). */
function useAnnouncement(): (event: Exclude<AlertEvent, { type: 'disarmed' }>) => string | null {
  const { t } = useLingui();
  return useCallback(
    (event) => {
      const { kind, mode } = event.timer;
      switch (event.type) {
        case 'armed': {
          if (event.remainingMs <= 0) return null;
          const duration = formatDurationLong(event.remainingMs);
          if (event.rearmed) return t`${duration} left`;
          if (kind === 'set') return t`Set timer started, ${duration}`;
          if (kind === 'transition') return t`Next exercise in ${duration}`;
          return mode === 'countup'
            ? t`Rest started, minimum ${duration}`
            : t`Rest started, ${duration}`;
        }
        case 'pre-alert': {
          const duration = formatDurationLong(event.remainingMs);
          return t`${duration} left`;
        }
        case 'end':
          // Fired while hidden: announced when the user is back ('visible').
          if (event.hidden) return null;
          if (kind === 'set') return t`Time is up`;
          if (kind === 'transition') return t`Next exercise`;
          return mode === 'countup' ? t`Minimum rest reached` : t`Rest over`;
        case 'visible': {
          if (!event.endedWhileHidden) return null;
          const ago = formatDurationLong(event.overMs);
          return kind === 'rest' ? t`Rest over, ${ago} ago` : t`Time is up, ${ago} ago`;
        }
        default:
          // The 3-2-1 beeps, hiding and the keep-alive are not announced (no flooding).
          return null;
      }
    },
    [t],
  );
}
