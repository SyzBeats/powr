import type {
  AlertScheduler as AlertTransport,
  HapticsPort,
  NotificationPort,
} from '@powr/application';

import type { AlertAudio } from '../platform/audio';
import type { TimerEngine } from './engine';
import type { PageLifecycle, TimerFunctions } from './lifecycle';
import { MAX_SW_TIMER_MS, REST_NOTIFICATION_TAG, VIBRATION } from './patterns';
import { alertKey, ENDING_MS, type TimerState } from './timer';

/**
 * The rest-alert scheduler (technical concept §8.8.2 and §8.8.4, TMR-05, TMR-06, PWA-07, PWA-08,
 * ADR-0019). It takes `TimerState` values (M3a's timer effects: arm, re-arm after an adjust,
 * disarm by id) and plain, already translated texts.
 *
 * **Visible:** one-shot timeouts for the optional pre-alert (10 s), the optional 3-2-1 and the end,
 * each with sound (Web Audio, in-app volume) and vibration where enabled and supported. The UI
 * shows the done state and announces politely (it subscribes to the events).
 *
 * **Hidden** (screen locked, app switched): every available path is armed for the alert's key
 * (the timer and its current end): (1) a single, unchained page timeout at the end; (2) the
 * service-worker timer (`ARM_REST`, held with `waitUntil` only when the end is at most 5 minutes
 * away; a longer rest arms it from the page 5 minutes before the end if the page still runs);
 * (3) the optional silent "Resting – ends at 14:32" notification, and "Rest over" with `renotify`
 * and vibration from whichever path fires, all with the tag `rest`; (4) dedupe: every path claims
 * `fired:<key>` in `powr-runtime` first, so only one alert per end can appear.
 *
 * **Return:** disarm everything, close the `rest` notifications, recompute, and report "ended
 * while hidden" with the time since the end (the UI shows "Rest over · +0:42", TMR-04) with a
 * gentle cue. Nothing runs while no timer is armed (NFR-PERF-10).
 */
export type AlertPath = 'visible' | 'page-timeout' | 'sw-timer' | 'on-return';
export type HiddenPath = 'page-timeout' | 'sw-timer' | 'resting-notice';

export interface RestAlertTexts {
  /** "Rest over" notification. */
  readonly restOver: { readonly title: string; readonly body: string };
  /** The silent "Resting – ends at 14:32" notification shown on hide. */
  readonly resting: { readonly title: string; readonly body: string };
}

export interface AlertOptions {
  readonly sound: boolean;
  /** In-app volume 0–1, applied as gain (TMR-05). */
  readonly volume: number;
  readonly vibration: boolean;
  /** Pre-alert before the end (SET-03). */
  readonly preAlert: boolean;
  /** How long before the end the pre-alert fires: 5, 10 or 15 s (SET-03; default 10 s). */
  readonly preAlertMs?: number;
  /** 3-2-1 beeps (SET-03). */
  readonly countdown: boolean;
  /** The silent "Resting – ends at …" notification when the page hides (§8.8.4). */
  readonly restingNotice: boolean;
  /** Labs (OQ-T3 = B, off by default): quiet audio with a media session while a timer runs. */
  readonly keepAlive: false | { readonly gain: number };
  /** The S-1 harness's variants A/B arm one path only; production arms both. */
  readonly paths?: { readonly page: boolean; readonly serviceWorker: boolean };
  /** Where a notification tap leads (default `/session`). */
  readonly url?: string;
}

export type AlertEvent =
  | {
      readonly type: 'armed';
      readonly timer: TimerState;
      readonly key: string;
      /** A new end for an armed timer (an adjust), not a new timer. */
      readonly rearmed: boolean;
      readonly remainingMs: number;
    }
  | { readonly type: 'pre-alert'; readonly timer: TimerState; readonly remainingMs: number }
  | { readonly type: 'countdown'; readonly timer: TimerState; readonly secondsLeft: number }
  | {
      readonly type: 'end';
      readonly timer: TimerState;
      readonly key: string;
      /** The first path that alerted (`on-return`: none did, it was noticed on return). */
      readonly path: AlertPath;
      /** How late the first alert was (or the time since the end for `on-return`). */
      readonly delayMs: number;
      readonly hidden: boolean;
    }
  | {
      readonly type: 'hidden';
      readonly timer: TimerState;
      readonly key: string;
      readonly paths: readonly HiddenPath[];
    }
  | {
      readonly type: 'visible';
      readonly timer: TimerState;
      readonly key: string;
      /** The end passed while the page was hidden: show "Rest over · +0:42" (TMR-04). */
      readonly endedWhileHidden: boolean;
      readonly overMs: number;
    }
  | { readonly type: 'disarmed'; readonly timerId: string }
  /** The Labs audio keep-alive started (or failed to start) for this timer. */
  | { readonly type: 'keep-alive'; readonly timer: TimerState; readonly playing: boolean };

export interface RestAlerts {
  /** Arms a timer, or re-arms it after an adjust (same `id`, new end); idempotent otherwise. */
  arm(timer: TimerState, texts: RestAlertTexts, options: AlertOptions): void;
  disarm(timerId: string): void;
  /** Session finished or discarded: disarm everything and suspend the audio context (§8.8.6). */
  stopAll(): void;
  subscribe(listener: (event: AlertEvent) => void): () => void;
  /** Resolves when every queued step has run (tests, the S-1 harness). */
  settled(): Promise<void>;
}

export interface RestAlertDeps {
  readonly engine: TimerEngine;
  readonly lifecycle: PageLifecycle;
  readonly timers: TimerFunctions;
  /** The wall clock, the frame of the service worker and of hidden pages. */
  readonly wall: () => number;
  readonly audio: Pick<AlertAudio, 'play' | 'startKeepAlive' | 'stopKeepAlive' | 'suspend'>;
  readonly haptics: HapticsPort;
  readonly notifications: NotificationPort;
  /** `ARM_REST` / `DISARM` to the service worker and the `fired:<key>` flags in `powr-runtime`. */
  readonly transport: AlertTransport;
  /** Deletes `fired:` flags older than `ms` (they are only needed while a rest runs). */
  readonly pruneFired?: (olderThanMs: number) => Promise<void>;
  readonly onError?: (error: unknown) => void;
}

/** An end alert later than this is "late": noticed on return or after a reload, a gentle cue. */
const LATE_MS = 1000;
const FIRED_FLAG_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_URL = '/session';

interface Entry {
  timer: TimerState;
  key: string;
  texts: RestAlertTexts;
  options: AlertOptions;
  visibleHandles: number[];
  hiddenHandles: number[];
  /** The first path that alerted for this key, or null. */
  firedPath: AlertPath | null;
  /** Wall-clock end computed when the page hid (null while visible). */
  endWall: number | null;
  swArmed: boolean;
  notified: boolean;
}

export function createRestAlerts(deps: RestAlertDeps): RestAlerts {
  const { engine, lifecycle, timers, transport, notifications } = deps;
  const entries = new Map<string, Entry>();
  const listeners = new Set<(event: AlertEvent) => void>();
  let unlisten: (() => void) | null = null;
  let keepAliveOn = false;
  let queue: Promise<void> = Promise.resolve();

  const emit = (event: AlertEvent) => {
    for (const listener of listeners) listener(event);
  };
  const enqueue = (task: () => Promise<void> | void): Promise<void> => {
    queue = queue.then(task).catch((error: unknown) => deps.onError?.(error));
    return queue;
  };
  const clear = (handles: number[]) => {
    for (const handle of handles.splice(0)) timers.clearTimeout(handle);
  };
  const live = (entry: Entry) => entries.get(entry.timer.id) === entry;

  const cue = (entry: Entry, kind: 'restEnd' | 'preAlert' | 'countdown' | 'gentle') => {
    const { sound, volume, vibration } = entry.options;
    if (sound) deps.audio.play(kind, volume);
    if (vibration) deps.haptics.vibrate(VIBRATION[kind]);
  };

  const updateKeepAlive = () => {
    const wanted = [...entries.values()].find(
      (entry) => entry.options.keepAlive && entry.firedPath === null,
    );
    if (wanted && !keepAliveOn && wanted.options.keepAlive) {
      keepAliveOn = true;
      void deps.audio
        .startKeepAlive({ title: wanted.texts.resting.title, gain: wanted.options.keepAlive.gain })
        .then((playing) => emit({ type: 'keep-alive', timer: wanted.timer, playing }));
    } else if (!wanted && keepAliveOn) {
      keepAliveOn = false;
      deps.audio.stopKeepAlive();
    }
  };

  /** Another path claimed the key first: record and report it (the S-1 harness needs it). */
  const reportOtherPath = async (
    entry: Entry,
    known?: { readonly by: 'page' | 'sw'; readonly at: number },
  ) => {
    const fired = known ?? (await transport.firedBy(entry.key));
    entry.firedPath = fired?.by === 'sw' ? 'sw-timer' : 'page-timeout';
    updateKeepAlive();
    if (!fired) return;
    const endWall = entry.endWall ?? fired.at;
    emit({
      type: 'end',
      timer: entry.timer,
      key: entry.key,
      path: entry.firedPath,
      delayMs: Math.max(0, fired.at - endWall),
      hidden: true,
    });
  };

  /** The first path to claim `fired:<key>` alerts; every other path stays silent (§8.8.4). */
  const fireEnd = async (entry: Entry, path: AlertPath) => {
    if (!live(entry) || entry.firedPath || entry.timer.fired.end) return;
    entry.firedPath = path;
    clear(entry.visibleHandles);
    if (path !== 'visible') clear(entry.hiddenHandles);
    const claimed = await transport.claimFired(entry.key, 'page');
    if (!claimed) {
      // Another path was first: the service worker (the page timeout ran late, e.g. after a
      // freeze), or this page before a reload.
      await reportOtherPath(entry);
      return;
    }
    const delayMs =
      path === 'visible' || entry.endWall === null
        ? engine.display(entry.timer).overMs
        : Math.max(0, deps.wall() - entry.endWall);
    const countUp = entry.timer.mode === 'countup';
    cue(entry, countUp ? 'gentle' : 'restEnd');
    if (path === 'page-timeout') {
      entry.notified = await notifications.show({
        ...entry.texts.restOver,
        tag: REST_NOTIFICATION_TAG,
        url: entry.options.url ?? DEFAULT_URL,
        renotify: true,
      });
    }
    updateKeepAlive();
    emit({
      type: 'end',
      timer: entry.timer,
      key: entry.key,
      path,
      delayMs,
      hidden: path !== 'visible',
    });
  };

  /** Visible: one-shot timeouts for the pre-alert, the 3-2-1 and the end (TMR-05). */
  const scheduleVisible = async (entry: Entry) => {
    clear(entry.visibleHandles);
    if (!live(entry) || entry.firedPath || entry.timer.fired.end) return;
    const display = engine.display(entry.timer);
    if (display.done) {
      await endedWhileAway(entry, display.overMs);
      return;
    }
    const remaining = display.remainingMs;
    const at = (ms: number, task: () => void) =>
      entry.visibleHandles.push(timers.setTimeout(task, Math.max(0, remaining - ms)));
    if (entry.timer.mode === 'countdown') {
      const { preAlert, countdown } = entry.options;
      const preAlertMs = entry.options.preAlertMs ?? ENDING_MS;
      if (preAlert && !entry.timer.fired.preAlert && remaining > preAlertMs) {
        at(preAlertMs, () => {
          cue(entry, 'preAlert');
          emit({ type: 'pre-alert', timer: entry.timer, remainingMs: preAlertMs });
        });
      }
      if (countdown) {
        for (const seconds of [3, 2, 1]) {
          if (remaining <= seconds * 1000) continue;
          at(seconds * 1000, () => {
            cue(entry, 'countdown');
            emit({ type: 'countdown', timer: entry.timer, secondsLeft: seconds });
          });
        }
      }
    }
    at(0, () => void enqueue(() => fireEnd(entry, 'visible')));
  };

  /** The end passed before anything here could alert (a reload, a late arm, a missed rest). */
  const endedWhileAway = async (entry: Entry, overMs: number) => {
    if (entry.firedPath || entry.timer.fired.end) return;
    if (overMs <= LATE_MS) {
      await fireEnd(entry, 'visible');
      return;
    }
    entry.firedPath = 'on-return';
    if (!(await transport.claimFired(entry.key, 'page'))) {
      // Another path alerted before (the service worker, or this page before a reload).
      await reportOtherPath(entry);
      return;
    }
    cue(entry, 'gentle');
    updateKeepAlive();
    emit({
      type: 'end',
      timer: entry.timer,
      key: entry.key,
      path: 'on-return',
      delayMs: overMs,
      hidden: true,
    });
  };

  const armServiceWorker = async (entry: Entry) => {
    if (!live(entry) || entry.firedPath || entry.endWall === null) return;
    await transport.armRestEnd({
      timerId: entry.key,
      endsAtEpochMs: entry.endWall,
      ...entry.texts.restOver,
      url: entry.options.url ?? DEFAULT_URL,
    });
    // Disarmed (or returned) while the message was on its way: take it back at once.
    if (!live(entry) || entry.endWall === null) await transport.disarm(entry.key);
    else entry.swArmed = true;
  };

  /** Hidden: arm every available path for the key (§8.8.4, §6.2). */
  const goHidden = async (entry: Entry) => {
    clear(entry.visibleHandles);
    clear(entry.hiddenHandles);
    if (!live(entry) || entry.firedPath || entry.timer.fired.end) return;
    const display = engine.display(entry.timer);
    if (display.done) return;
    const remaining = display.remainingMs;
    entry.endWall = deps.wall() + remaining;
    const paths = entry.options.paths ?? { page: true, serviceWorker: true };
    const armed: HiddenPath[] = [];
    if (paths.page) {
      // One unchained timeout: Chrome's intensive throttling only hits chained timers.
      entry.hiddenHandles.push(
        timers.setTimeout(() => void enqueue(() => fireEnd(entry, 'page-timeout')), remaining),
      );
      armed.push('page-timeout');
    }
    if (paths.serviceWorker) {
      if (remaining <= MAX_SW_TIMER_MS) {
        await armServiceWorker(entry);
      } else if (paths.page) {
        // Chromium ends service-worker events after 5 minutes: arm it later, if the page runs.
        entry.hiddenHandles.push(
          timers.setTimeout(
            () => void enqueue(() => armServiceWorker(entry)),
            remaining - MAX_SW_TIMER_MS + 1000,
          ),
        );
      }
      armed.push('sw-timer');
    }
    if (!live(entry)) return;
    if (entry.options.restingNotice) {
      const shown = await notifications.show({
        ...entry.texts.resting,
        tag: REST_NOTIFICATION_TAG,
        url: entry.options.url ?? DEFAULT_URL,
        silent: true,
      });
      if (!live(entry)) {
        if (shown) await notifications.closeByTag(REST_NOTIFICATION_TAG);
        return;
      }
      entry.notified ||= shown;
      if (shown) armed.push('resting-notice');
    }
    emit({ type: 'hidden', timer: entry.timer, key: entry.key, paths: armed });
  };

  /** Visible again: disarm, close the notifications, recompute, report (§8.8.4 step 5). */
  const returnVisible = async (entry: Entry) => {
    clear(entry.hiddenHandles);
    if (!live(entry)) return;
    const wasHidden = entry.endWall !== null;
    if (entry.swArmed) {
      entry.swArmed = false;
      await transport.disarm(entry.key);
    }
    if (!wasHidden) {
      // `pageshow` or `resume` without a hide: timeouts may have been frozen, so reschedule.
      await scheduleVisible(entry);
      return;
    }
    if (!entry.firedPath && !entry.timer.fired.end) {
      const fired = await transport.firedBy(entry.key);
      if (fired?.by === 'sw') await reportOtherPath(entry, fired);
    }
    entry.endWall = null;
    await notifications.closeByTag(REST_NOTIFICATION_TAG).catch(() => undefined);
    entry.notified = false;
    const display = engine.display(entry.timer);
    if (!display.done) {
      emit({
        type: 'visible',
        timer: entry.timer,
        key: entry.key,
        endedWhileHidden: false,
        overMs: 0,
      });
      await scheduleVisible(entry);
      return;
    }
    if (!entry.firedPath && !entry.timer.fired.end) {
      await endedWhileAway(entry, display.overMs);
    } else if (display.overMs > LATE_MS) {
      // A notification or a hidden beep already alerted: a non-intrusive cue now (TMR-04).
      cue(entry, 'gentle');
    }
    updateKeepAlive();
    emit({
      type: 'visible',
      timer: entry.timer,
      key: entry.key,
      endedWhileHidden: entry.firedPath !== 'visible',
      overMs: display.overMs,
    });
  };

  const onLifecycle = (state: 'visible' | 'hidden') => {
    if (state === 'visible') engine.resume();
    for (const entry of entries.values()) {
      void enqueue(() => (state === 'hidden' ? goHidden(entry) : returnVisible(entry)));
    }
  };

  const listen = () => {
    if (entries.size > 0 && !unlisten) unlisten = lifecycle.listen(onLifecycle);
    if (entries.size === 0 && unlisten) {
      unlisten();
      unlisten = null;
    }
  };

  const teardown = (entry: Entry) => {
    clear(entry.visibleHandles);
    clear(entry.hiddenHandles);
    const { swArmed, notified, key } = entry;
    entry.swArmed = false;
    entry.notified = false;
    if (swArmed || notified) {
      void enqueue(async () => {
        if (swArmed) await transport.disarm(key);
        if (notified) await notifications.closeByTag(REST_NOTIFICATION_TAG);
      });
    }
  };

  const restAlerts: RestAlerts = {
    arm(timer, texts, options) {
      const key = alertKey(timer);
      const existing = entries.get(timer.id);
      if (existing && existing.key === key) {
        const changed = JSON.stringify(existing.options) !== JSON.stringify(options);
        existing.timer = timer;
        existing.texts = texts;
        existing.options = options;
        if (changed && lifecycle.visible()) void enqueue(() => scheduleVisible(existing));
        updateKeepAlive();
        return;
      }
      if (existing) teardown(existing);
      const entry: Entry = {
        timer,
        key,
        texts,
        options,
        visibleHandles: [],
        hiddenHandles: [],
        firedPath: null,
        endWall: null,
        swArmed: false,
        notified: false,
      };
      entries.set(timer.id, entry);
      listen();
      emit({
        type: 'armed',
        timer,
        key,
        rearmed: existing !== undefined,
        remainingMs: engine.display(timer).remainingMs,
      });
      updateKeepAlive();
      void enqueue(() => (lifecycle.visible() ? scheduleVisible(entry) : goHidden(entry)));
    },

    disarm(timerId) {
      const entry = entries.get(timerId);
      if (!entry) return;
      entries.delete(timerId);
      teardown(entry);
      listen();
      updateKeepAlive();
      emit({ type: 'disarmed', timerId });
    },

    stopAll() {
      for (const timerId of entries.keys()) restAlerts.disarm(timerId);
      void enqueue(async () => {
        await deps.audio.suspend();
        await deps.pruneFired?.(FIRED_FLAG_TTL_MS);
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async settled() {
      // Steps can queue further steps (an end fired from a timeout): wait until it is quiet.
      let current: Promise<void>;
      do {
        current = queue;
        await current;
      } while (current !== queue);
    },
  };
  return restAlerts;
}
