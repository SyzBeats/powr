import type {
  AlertScheduler as AlertTransport,
  DiagnosticsPort,
  HapticsPort,
  NotificationPermissionState,
  NotificationPort,
} from '@powr/application';

import type { AlertAudio } from '../platform/audio';
import { pruneFiredFlags } from '../runtime-db';
import { currentBrowser, type BrowserInfo } from './browser';
import { createTimerEngine, type TimerEngine } from './engine';
import { labs, type LabsFlags } from './labs';
import { browserLifecycle, browserTimers } from './lifecycle';
import type { AlertEvent, RestAlerts } from './scheduler';
import type { AlertStatusReport, ProductionVariant } from './status';
import { createDisplayStore, createTicker, type DisplayStore, type Ticker } from './ticker';
import type { TimerState } from './timer';
import { createWakeLockPolicy, type WakeLockPolicy } from './wake-lock-policy';

/**
 * Timers and alerts for the composition root (technical concept §8.8). In the entry chunk: the
 * timer engine and its 4 Hz ticker (the mini timer shows on every screen, TMR-12), the wake-lock
 * policy and the facade of the rest-alert scheduler. The scheduler itself and the honest status
 * with the capability matrix are lazy chunks, loaded on the first arm or Settings → Alerts.
 */
export interface TimerKit {
  readonly engine: TimerEngine;
  readonly ticker: Ticker;
  readonly restAlerts: RestAlerts;
  readonly screenWake: WakeLockPolicy;
  readonly labs: LabsFlags;
  /** A `useSyncExternalStore` store for one timer's display (`at`: frozen, no ticking). */
  displayStore(timer: TimerState | null, at?: number): DisplayStore;
  /** The honest screen-locked status for the variant the app runs and the known permission. */
  alertStatus(
    variant: ProductionVariant,
    permission: NotificationPermissionState,
  ): Promise<AlertStatusReport>;
  /** Browser family, version, platform and display mode (the matrix keys). */
  browser(): BrowserInfo;
}

export function createTimerKit(deps: {
  readonly audio: AlertAudio;
  readonly haptics: HapticsPort;
  readonly notifications: NotificationPort;
  readonly transport: AlertTransport;
  readonly log: DiagnosticsPort['log'];
}): TimerKit {
  const lifecycle = browserLifecycle();
  const engine = createTimerEngine({
    onClockJump: ({ deltaMs }) =>
      deps.log('info', 'timer.clockJump', { deltaMs, visibility: document.visibilityState }),
  });
  const ticker = createTicker({
    engine,
    lifecycle,
    frames: {
      ...browserTimers,
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (handle) => cancelAnimationFrame(handle),
      now: () => performance.now(),
    },
  });
  const screenWake = createWakeLockPolicy({
    api: 'wakeLock' in navigator ? navigator.wakeLock : null,
    lifecycle,
    log: (state, reason) => deps.log('info', 'wakeLock.state', { state, reason }),
  });
  const restAlerts = lazyRestAlerts(async () => {
    const { createRestAlerts } = await import('./scheduler');
    return createRestAlerts({
      engine,
      lifecycle,
      timers: browserTimers,
      wall: () => Date.now(),
      audio: deps.audio,
      haptics: deps.haptics,
      notifications: deps.notifications,
      transport: deps.transport,
      pruneFired: async (olderThanMs) => {
        await pruneFiredFlags(olderThanMs);
      },
      onError: (error) =>
        deps.log('error', 'alerts.error', {
          name: error instanceof Error ? error.name : 'unknown',
        }),
    });
  }, logEnd(deps.log));
  return {
    engine,
    ticker,
    restAlerts,
    screenWake,
    labs,
    displayStore: (timer, at) => createDisplayStore(engine, ticker, timer, at),
    browser: currentBrowser,
    async alertStatus(variant, permission) {
      const { detectAlertStatus } = await import('./status');
      return detectAlertStatus(variant, permission);
    },
  };
}

function logEnd(log: DiagnosticsPort['log']) {
  return (event: AlertEvent) => {
    if (event.type !== 'end') return;
    log('info', 'alerts.end', {
      path: event.path,
      delayMs: Math.round(event.delayMs),
      kind: event.timer.kind,
      hidden: event.hidden,
    });
  };
}

/**
 * The scheduler's facade: calls before the chunk has loaded are queued in order; listeners can
 * subscribe at any time.
 */
function lazyRestAlerts(
  load: () => Promise<RestAlerts>,
  onEvent: (event: AlertEvent) => void,
): RestAlerts {
  const listeners = new Set<(event: AlertEvent) => void>();
  let instance: RestAlerts | null = null;
  let loading: Promise<RestAlerts> | null = null;
  const get = () =>
    (loading ??= load().then((loaded) => {
      instance = loaded;
      loaded.subscribe((event) => {
        onEvent(event);
        for (const listener of listeners) listener(event);
      });
      return loaded;
    }));
  const run = (task: (scheduler: RestAlerts) => void) => {
    if (instance) task(instance);
    else void get().then(task);
  };
  return {
    arm: (timer, texts, options) => run((scheduler) => scheduler.arm(timer, texts, options)),
    disarm: (timerId) => {
      if (instance || loading) run((scheduler) => scheduler.disarm(timerId));
    },
    stopAll: () => {
      if (instance || loading) run((scheduler) => scheduler.stopAll());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async settled() {
      if (loading) await (await loading).settled();
    },
  };
}

export type { TimerState, TimerDisplay } from './timer';
export type { AlertEvent, AlertOptions, AlertPath, RestAlerts, RestAlertTexts } from './scheduler';
export type { AlertLevel, AlertStatusReport } from './status';
export type { WakeLockStatus } from './wake-lock-policy';
