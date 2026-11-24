import type { PageLifecycle } from './lifecycle';
import type { FrameFunctions } from './ticker';
import type { TimerState } from './timer';

/**
 * Fakes for the unit tests of the timer engine, ticker, scheduler and wake-lock policy (not
 * bundled: only tests import it). One fake clock drives the wall clock, the monotonic clock and
 * the timeouts; `sleep` models a device in deep sleep (Android's monotonic clock stops, the wall
 * clock and frozen timers do not run) and `jumpWall` a device clock change.
 */
export interface FakeClock {
  readonly wall: () => number;
  readonly mono: () => number;
  readonly frames: FrameFunctions;
  /** Moves both clocks forward, running due timeouts in order. */
  readonly advance: (ms: number) => void;
  /** The wall clock moves, the monotonic clock and the timeouts do not (deep sleep, a freeze). */
  readonly sleep: (ms: number) => void;
  /** A device clock change: only the wall clock moves. */
  readonly jumpWall: (ms: number) => void;
  readonly pending: () => number;
}

export const T0 = Date.UTC(2026, 10, 24, 12, 0, 0);

export function fakeClock(start = T0): FakeClock {
  let wall = start;
  let mono = 1000;
  let nextId = 1;
  const timeouts = new Map<number, { at: number; callback: () => void }>();
  const setTimeout = (callback: () => void, ms: number) => {
    const id = nextId++;
    timeouts.set(id, { at: mono + Math.max(0, ms), callback });
    return id;
  };
  const clearTimeout = (id: number) => {
    timeouts.delete(id);
  };
  return {
    wall: () => wall,
    mono: () => mono,
    frames: {
      setTimeout,
      clearTimeout,
      requestFrame: (callback) => setTimeout(callback, 16),
      cancelFrame: clearTimeout,
      now: () => mono,
    },
    advance(ms) {
      const target = mono + ms;
      for (;;) {
        let next: [number, { at: number; callback: () => void }] | null = null;
        for (const entry of timeouts) {
          if (entry[1].at <= target && (!next || entry[1].at < next[1].at)) next = entry;
        }
        if (!next) break;
        wall += next[1].at - mono;
        mono = next[1].at;
        timeouts.delete(next[0]);
        next[1].callback();
      }
      wall += target - mono;
      mono = target;
    },
    sleep(ms) {
      wall += ms;
    },
    jumpWall(ms) {
      wall += ms;
    },
    pending: () => timeouts.size,
  };
}

export interface FakeLifecycle extends PageLifecycle {
  readonly set: (state: 'visible' | 'hidden') => void;
  /** `pageshow` or `resume` without a visibility change. */
  readonly show: () => void;
  readonly listeners: () => number;
}

export function fakeLifecycle(initial: 'visible' | 'hidden' = 'visible'): FakeLifecycle {
  let state = initial;
  const callbacks = new Set<(state: 'visible' | 'hidden') => void>();
  return {
    visible: () => state === 'visible',
    listen(callback) {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    set(next) {
      state = next;
      for (const callback of callbacks) callback(next);
    },
    show() {
      for (const callback of callbacks) callback('visible');
    },
    listeners: () => callbacks.size,
  };
}

export function timer(overrides: Partial<TimerState> = {}): TimerState {
  return {
    id: 'timer-1',
    kind: 'rest',
    mode: 'countdown',
    startedAtEpochMs: T0,
    targetMs: 150_000,
    adjustMs: 0,
    fired: {},
    ...overrides,
  };
}
