import type { TimerFunctions } from './lifecycle';

/*
 * The 3-2-1 lead-in before a timed set (TMR-09, TD-48; M4v): three one-second counts, each with
 * the `countdown` cue and a short vibration (as the alert settings allow), then `onDone` starts
 * the set timer. Only the count changes (once a second), so nothing flashes; cancelling clears
 * the one pending timeout. It is page state only: a reload during the lead-in loses it, and no
 * timer has started yet.
 */

const LEAD_IN_COUNTS = 3;
const COUNT_MS = 1000;
export const LEAD_IN_VIBRATION: readonly number[] = [60];

export interface LeadInOptions {
  readonly sound: boolean;
  readonly volume: number;
  readonly vibration: boolean;
}

export interface LeadIn {
  /** Starts the counts (restarts a running lead-in); `onDone` runs after the last one. */
  readonly start: (options: LeadInOptions, onDone: () => void) => void;
  readonly cancel: () => void;
  /** 3, 2, 1 while counting, else null. */
  readonly count: () => number | null;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createLeadIn(deps: {
  readonly timers: TimerFunctions;
  readonly beep: (volume: number) => void;
  readonly vibrate: (pattern: readonly number[]) => void;
}): LeadIn {
  const listeners = new Set<() => void>();
  let count: number | null = null;
  let pending: number | null = null;

  const set = (next: number | null) => {
    count = next;
    for (const listener of listeners) listener();
  };

  const cancel = () => {
    if (pending !== null) deps.timers.clearTimeout(pending);
    pending = null;
    if (count !== null) set(null);
  };

  return {
    start(options, onDone) {
      cancel();
      const tick = (remaining: number) => {
        if (remaining === 0) {
          pending = null;
          onDone();
          set(null);
          return;
        }
        set(remaining);
        if (options.sound) deps.beep(options.volume);
        if (options.vibration) deps.vibrate(LEAD_IN_VIBRATION);
        pending = deps.timers.setTimeout(() => tick(remaining - 1), COUNT_MS);
      };
      tick(LEAD_IN_COUNTS);
    },
    cancel,
    count: () => count,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
