import type { TimerEngine } from './engine';
import type { PageLifecycle, TimerFunctions } from './lifecycle';
import { IDLE_DISPLAY, type TimerDisplay, type TimerState } from './timer';

/**
 * The display clock (§8.8.1, NFR-PERF-10): about 4 updates per second, each aligned to an
 * animation frame, only while something subscribes and the page is visible. Hidden pages get no
 * callbacks at all; on `visibilitychange → visible`, `pageshow` and `resume` the engine re-anchors
 * and every subscriber recomputes at once (correct display within 500 ms, NFR-PERF-02).
 */
export interface Ticker {
  subscribe(listener: () => void): () => void;
}

export interface FrameFunctions extends TimerFunctions {
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
  /** Monotonic milliseconds (`performance.now()`), to keep the ticks on a 250 ms grid. */
  now(): number;
}

const TICK_MS = 250;

export function createTicker(options: {
  readonly engine: TimerEngine;
  readonly lifecycle: PageLifecycle;
  readonly frames: FrameFunctions;
  readonly intervalMs?: number;
}): Ticker {
  const { engine, lifecycle, frames } = options;
  const intervalMs = options.intervalMs ?? TICK_MS;
  const listeners = new Set<() => void>();
  let timeout: number | null = null;
  let frame: number | null = null;
  let unlisten: (() => void) | null = null;
  /** When the next tick is due; frame latency does not accumulate. */
  let due = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };
  const stop = () => {
    if (timeout !== null) frames.clearTimeout(timeout);
    if (frame !== null) frames.cancelFrame(frame);
    timeout = null;
    frame = null;
  };
  const schedule = (restart: boolean) => {
    if (timeout !== null || frame !== null) return;
    const now = frames.now();
    due = restart || due + intervalMs <= now ? now + intervalMs : due + intervalMs;
    timeout = frames.setTimeout(() => {
      timeout = null;
      frame = frames.requestFrame(() => {
        frame = null;
        if (listeners.size === 0 || !lifecycle.visible()) return;
        notify();
        schedule(false);
      });
    }, due - now);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        unlisten = lifecycle.listen((state) => {
          if (state === 'hidden') {
            stop();
            return;
          }
          engine.resume();
          notify();
          schedule(true);
        });
        if (lifecycle.visible()) schedule(true);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        stop();
        unlisten?.();
        unlisten = null;
      };
    },
  };
}

/**
 * A `useSyncExternalStore` store for one timer: the snapshot object changes only when the display
 * changes by a tick (about 4 times a second while running), so React renders at most that often.
 * With a fixed `at` the display is frozen and nothing subscribes.
 */
export interface DisplayStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => TimerDisplay;
}

export function createDisplayStore(
  engine: TimerEngine,
  ticker: Ticker,
  timer: TimerState | null,
  at?: number,
): DisplayStore {
  let snapshot: TimerDisplay | null = null;
  const compute = () => {
    const next = engine.display(timer, at);
    if (
      snapshot &&
      snapshot.phase === next.phase &&
      Math.floor(snapshot.elapsedMs / TICK_MS) === Math.floor(next.elapsedMs / TICK_MS)
    ) {
      return false;
    }
    snapshot = next;
    return true;
  };
  return {
    subscribe(listener) {
      if (!timer || at !== undefined) return () => {};
      return ticker.subscribe(() => {
        if (compute()) listener();
      });
    },
    getSnapshot() {
      if (!timer) return IDLE_DISPLAY;
      if (!snapshot) compute();
      return snapshot ?? IDLE_DISPLAY;
    },
  };
}
